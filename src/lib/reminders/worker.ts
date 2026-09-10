import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { sendKickoffReminderEmail } from '@/lib/email';
import { sendPushToDevices } from '@/lib/fcm';
import { reminderAudience, reminderTargets } from './audience';
import { isReminderKind } from './policy';
import { getQStashClient, matchReminderWebhookUrl } from '@/lib/qstash';

const BATCH_SIZE = 10;
const CONCURRENCY = 5;
const LEASE_MS = 120_000;
const MAX_ATTEMPTS = 5;

export async function deliverReminderJob(jobId: number, now = new Date()) {
  const job = await prisma.reminderJob.findUnique({ where: { id: jobId }, include: { match: { include: { league: true } } } });
  if (!job) return { outcome: 'job_not_found' };
  if (['completed', 'superseded', 'expired'].includes(job.status)) return { outcome: job.status };
  if (!isReminderKind(job.kind)) throw new Error('Invalid stored reminder kind');
  const { match } = job;
  const kind = job.kind;
  // Kickoff can already be live when the at-kickoff message arrives.
  const validStatus = match.status === 'scheduled' || (kind === 'kickoff' && match.status === 'live');
  if (!validStatus || match.kickoffTime.getTime() !== job.kickoffTime.getTime()) {
    await prisma.reminderJob.update({ where: { id: job.id }, data: { status: 'superseded' } });
    return { outcome: 'superseded' };
  }
  if (now >= job.expiresAt) {
    await prisma.reminderJob.update({ where: { id: job.id }, data: { status: 'expired' } });
    return { outcome: 'expired' };
  }
  if (now < job.dueAt) throw new Error('Reminder is not due yet');
  const audience = await reminderAudience(match, kind);
  const targets = await reminderTargets(audience);
  if (targets.length) await prisma.reminderDelivery.createMany({ data: targets.map(target => ({ jobId, ...target, nextAttemptAt: now })), skipDuplicates: true });
  const deliveries = await prisma.reminderDelivery.findMany({
    where: { jobId, OR: [
      { status: { in: ['pending', 'retry'] }, nextAttemptAt: { lte: now } },
      { status: 'sending', leaseUntil: { lt: now } },
    ] }, orderBy: { id: 'asc' }, take: BATCH_SIZE,
  });
  for (let i = 0; i < deliveries.length; i += CONCURRENCY) {
    await Promise.all(deliveries.slice(i, i + CONCURRENCY).map(async delivery => {
      const token = randomUUID();
      const claimed = await prisma.reminderDelivery.updateMany({
        where: { id: delivery.id, OR: [
          { status: { in: ['pending', 'retry'] }, nextAttemptAt: { lte: now } },
          { status: 'sending', leaseUntil: { lt: now } },
        ] },
        data: { status: 'sending', leaseToken: token, leaseUntil: new Date(now.getTime() + LEASE_MS), attempts: { increment: 1 } },
      });
      if (!claimed.count) return;
      const finish = (data: { status: string; lastError?: string | null; acceptedAt?: Date; nextAttemptAt?: Date }) => prisma.reminderDelivery.updateMany({
        where: { id: delivery.id, leaseToken: token }, data: { ...data, leaseToken: null, leaseUntil: null },
      });
      try {
        if (delivery.attempts >= MAX_ATTEMPTS) { await finish({ status: 'failed', lastError: 'Retry budget exhausted' }); return; }
        // Check again after claiming: preferences and match timing may change between retries.
        const current = await prisma.match.findUnique({ where: { id: match.id } });
        if (!current || current.kickoffTime.getTime() !== job.kickoffTime.getTime() ||
          !(current.status === 'scheduled' || (kind === 'kickoff' && current.status === 'live')) || new Date() >= job.expiresAt) {
          await finish({ status: 'skipped', lastError: 'Fixture changed or reminder expired' }); return;
        }
        const recipients = await reminderAudience(current, kind);
        if (recipients !== null && !recipients.includes(delivery.userId)) {
          await finish({ status: 'skipped', lastError: 'No longer subscribed' }); return;
        }
        if (delivery.channel === 'email') {
          const user = await prisma.user.findUnique({ where: { id: delivery.userId }, select: { notificationEmail: true } });
          if (!user?.notificationEmail) { await finish({ status: 'skipped', lastError: 'No notification email' }); return; }
          await sendKickoffReminderEmail(user.notificationEmail, {
            homeTeamName: current.homeTeamName, awayTeamName: current.awayTeamName,
            kickoffTime: current.kickoffTime, leagueName: match.league?.name ?? 'Others',
          }, kind);
        } else {
          const device = await prisma.deviceToken.findFirst({ where: { id: Number(delivery.targetKey), userId: delivery.userId } });
          if (!device) { await finish({ status: 'skipped', lastError: 'Device removed' }); return; }
          const [result] = await sendPushToDevices([device], {
            title: kind === 'before' ? 'Kickoff in 60 minutes!' : 'Kickoff now!',
            body: `${current.homeTeamName} vs ${current.awayTeamName} ${kind === 'before' ? 'kicks off soon.' : 'is starting now.'}`,
            data: { type: 'match_reminder', matchId: String(current.id), reminderId: String(job.id) },
          });
          if (!result?.success) {
            if (result?.errorCode === 'messaging/registration-token-not-registered' || result?.errorCode === 'messaging/invalid-registration-token') {
              await finish({ status: 'failed', lastError: result.errorCode }); return;
            }
            throw new Error(result?.errorCode ?? 'Push provider did not accept message');
          }
        }
        await finish({ status: 'accepted', acceptedAt: new Date(), lastError: null });
      } catch (error) {
        await finish({
          status: delivery.attempts + 1 >= MAX_ATTEMPTS ? 'failed' : 'retry',
          nextAttemptAt: new Date(Date.now() + Math.min(60_000, 5_000 * 2 ** delivery.attempts)),
          lastError: error instanceof Error ? error.message : 'Provider failure',
        });
      }
    }));
  }
  const pending = await prisma.reminderDelivery.count({ where: { jobId, status: { in: ['pending', 'retry', 'sending'] } } });
  if (pending) {
    const remaining = await prisma.reminderDelivery.findMany({ where: { jobId, status: { in: ['pending', 'retry', 'sending'] } }, select: { status: true, nextAttemptAt: true, leaseUntil: true } });
    const nextAt = Math.min(...remaining.map(row => row.status === 'sending' ? (row.leaseUntil?.getTime() ?? Date.now()) : row.nextAttemptAt.getTime()));
    // Explicit continuations let large audiences finish across bounded requests;
    // broker retries and reconciliation recover a failed continuation publish.
    await getQStashClient().publishJSON({ url: matchReminderWebhookUrl(), body: { jobId },
      notBefore: Math.ceil(Math.max(Date.now() + 1000, nextAt) / 1000), retries: 3,
      flowControl: { key: 'match-reminders', parallelism: 3 },
    });
    return { outcome: 'processing', pending };
  }
  const failed = await prisma.reminderDelivery.count({ where: { jobId, status: 'failed' } });
  await prisma.reminderJob.update({ where: { id: jobId }, data: { status: 'completed', lastError: failed ? `${failed} deliveries failed` : null } });
  return { outcome: targets.length ? 'completed' : 'no_subscribers', failed };
}
