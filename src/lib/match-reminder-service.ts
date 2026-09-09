import { MatchRepository } from '@/lib/repositories/match-repository';
import { UserRepository } from '@/lib/repositories/user-repository';
import { DeviceTokenRepository } from '@/lib/repositories/device-repository';
import { sendKickoffReminderEmail, type MatchForEmail } from '@/lib/email';
import { sendPushToUsers } from '@/lib/fcm';
import { getQStashClient, matchReminderWebhookUrl } from '@/lib/qstash';
import { logger } from '@/lib/logger';
import { getReminderRecipientIds } from '@/lib/services/reminder-service';

const REMINDER_LEAD_SECONDS = 60 * 60;
const FLOW_CONTROL_KEY = 'match-reminders';
const FLOW_CONTROL_PARALLELISM = 3; // several fixtures can share a kickoff slot; keep headroom under QStash's account-wide cap

/**
 * Registers two reminders for a fixture: one 60 minutes before kickoff and one
 * at kickoff. Prediction-game pre-kickoff reminders reach all notification users;
 * other reminders use each user's selected team pairs at delivery time.
 * Called from matches-processor.ts right after a fixture
 * with a real externalId is inserted, alongside registerLiveGoalChain.
 */
export async function registerMatchReminderChain(match: { externalId: number; kickoffTime: Date }): Promise<void> {
  const kickoffAt = Math.floor(match.kickoffTime.getTime() / 1000);
  const fireAt = kickoffAt - REMINDER_LEAD_SECONDS;
  const now = Math.floor(Date.now() / 1000);
  const client = getQStashClient();
  const jobs = [
    { kind: 'before', at: fireAt },
    { kind: 'kickoff', at: kickoffAt },
  ].filter(job => job.at > now);
  await Promise.all(jobs.map(job => client.publishJSON({
    url: matchReminderWebhookUrl(),
    body: { externalId: match.externalId, kind: job.kind },
    notBefore: job.at,
    // Keep the original id for the 60-minute job so deployments do not
    // duplicate reminders that were already queued under the old schedule.
    deduplicationId: job.kind === 'before' ? `match-reminder-${match.externalId}` : `match-reminder-kickoff-${match.externalId}`,
    flowControl: { key: FLOW_CONTROL_KEY, parallelism: FLOW_CONTROL_PARALLELISM },
  })));
}

/** Called by the webhook once QStash delivers the scheduled reminder. */
export async function sendMatchKickoffReminder(externalId: number, kind: 'before' | 'kickoff' = 'before'): Promise<{ outcome: string }> {
  const match = await MatchRepository.findUnique({
    where: { externalId },
    include: { league: { select: { name: true } } },
  });
  if (!match) return { outcome: 'match_not_found' };
  if (match.status !== 'scheduled') return { outcome: `skipped_status_${match.status}` };

  const matchForEmail: MatchForEmail = {
    homeTeamName: match.homeTeamName,
    awayTeamName: match.awayTeamName,
    kickoffTime: match.kickoffTime,
    leagueName: match.externalLeagueId === 0 ? 'Others' : (match.league?.name ?? 'Unknown League'),
  };

  // Restore the original prediction-game 60-minute broadcast. Kickoff alerts
  // and reminder-only fixtures remain opt-in, requiring both teams selected.
  const broadcast = match.predictionsEnabled && kind === 'before';
  const recipientIds = broadcast ? null : await getReminderRecipientIds(match);
  if (recipientIds?.length === 0) return { outcome: 'no_subscribers' };

  const recipients = await UserRepository.findMany({
    where: { ...(recipientIds === null ? {} : { id: { in: recipientIds } }), notificationEmail: { not: null } },
    select: { id: true, notificationEmail: true },
  });
  let emailCount = 0;
  for (const user of recipients) {
    if (!user.notificationEmail) continue;
    try {
      await sendKickoffReminderEmail(user.notificationEmail, matchForEmail, kind);
      emailCount++;
    } catch (e) {
      logger.error('[match-reminder] Failed to email reminder:', {
        matchId: match.id,
        to: user.notificationEmail,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  // Resolve devices independently of email so push-only users are included.
  const pushRecipientIds = recipientIds ?? (await DeviceTokenRepository.findMany({
    select: { userId: true },
    distinct: ['userId'],
  })).map(device => device.userId);
  if (pushRecipientIds.length > 0) {
    try {
      await sendPushToUsers(pushRecipientIds, {
        title: kind === 'kickoff' ? 'Kickoff now!' : 'Kickoff in 60 minutes!',
        body: kind === 'kickoff' ? `${match.homeTeamName} vs ${match.awayTeamName} is starting now.` : `${match.homeTeamName} vs ${match.awayTeamName} kicks off soon.`,
        data: { type: 'match_reminder', matchId: String(match.id) },
      });
    } catch (e) {
      logger.error('[match-reminder] FCM push failed:', { matchId: match.id, error: e instanceof Error ? e.message : String(e) });
    }
  }

  logger.info('[match-reminder] Reminder sent', { matchId: match.id, emailCount, pushCount: pushRecipientIds.length });
  return { outcome: 'sent' };
}
