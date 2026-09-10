import { prisma } from '@/lib/prisma';
import { getQStashClient, matchReminderWebhookUrl } from '@/lib/qstash';
import { REMINDER_KINDS, reminderWindow } from './policy';

export async function planMatchReminders(matchId: number, now = new Date()) {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) return;
  await prisma.reminderJob.updateMany({
    where: { matchId, status: { in: ['pending', 'queued'] },
      ...(match.status === 'scheduled' ? { kickoffTime: { not: match.kickoffTime } }
        : match.status === 'live' ? { OR: [{ kickoffTime: { not: match.kickoffTime } }, { kind: 'before' }] } : {}),
    },
    data: { status: 'superseded' },
  });
  if (match.status !== 'scheduled') return;
  for (const kind of REMINDER_KINDS) {
    const window = reminderWindow(match.kickoffTime, kind);
    // Late subscriptions do not replay a reminder whose nominal time has passed.
    if (window.dueAt < now) continue;
    // A fixture can be reinstated at its original time after postponement.
    // Keep accepted delivery records, but re-arm an undelivered superseded job.
    await prisma.reminderJob.updateMany({ where: { matchId, kickoffTime: match.kickoffTime, kind, status: 'superseded' }, data: { status: 'pending', queuedAt: null } });
    await prisma.reminderJob.createMany({ data: [{ matchId, kickoffTime: match.kickoffTime, kind, ...window }], skipDuplicates: true });
  }
}

export async function publishReminderJobs(now = new Date()) {
  const jobs = await prisma.reminderJob.findMany({
    where: { expiresAt: { gt: now }, OR: [
      { status: 'pending' },
      { status: 'queued', dueAt: { lt: new Date(now.getTime() - 60_000) }, queuedAt: { lt: new Date(now.getTime() - 60_000) } },
    ] }, orderBy: { dueAt: 'asc' }, take: 100,
  });
  for (const job of jobs) {
    try {
      await getQStashClient().publishJSON({
        url: matchReminderWebhookUrl(), body: { jobId: job.id },
        notBefore: Math.max(Math.floor(job.dueAt.getTime() / 1000), Math.floor(now.getTime() / 1000)),
        retries: 3, deduplicationId: `reminder-job-${job.id}-${Math.floor(now.getTime() / 60_000)}`,
        flowControl: { key: 'match-reminders', parallelism: 3 },
      });
      await prisma.reminderJob.updateMany({ where: { id: job.id, status: { in: ['pending', 'queued'] } }, data: { status: 'queued', queuedAt: now, lastError: null } });
    } catch (error) {
      await prisma.reminderJob.update({ where: { id: job.id }, data: { lastError: error instanceof Error ? error.message : 'Queue publication failed' } });
    }
  }
}
