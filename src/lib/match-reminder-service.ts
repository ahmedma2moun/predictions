import { MatchRepository } from '@/lib/repositories/match-repository';
import { UserRepository } from '@/lib/repositories/user-repository';
import { DeviceTokenRepository } from '@/lib/repositories/device-repository';
import { sendKickoffReminderEmail, type MatchForEmail } from '@/lib/email';
import { sendPushToUsers } from '@/lib/fcm';
import { getQStashClient, matchReminderWebhookUrl } from '@/lib/qstash';
import { logger } from '@/lib/logger';

const REMINDER_LEAD_SECONDS = 60 * 60; // fire 60 minutes before kickoff
const FLOW_CONTROL_KEY = 'match-reminders';
const FLOW_CONTROL_PARALLELISM = 3; // several fixtures can share a kickoff slot; keep headroom under QStash's account-wide cap

/**
 * Registers the pre-kickoff reminder for a newly-inserted match — fires once,
 * REMINDER_LEAD_SECONDS before kickoff, to every user regardless of whether
 * they've predicted it. Called from matches-processor.ts right after a fixture
 * with a real externalId is inserted, alongside registerLiveGoalChain.
 */
export async function registerMatchReminderChain(match: { externalId: number; kickoffTime: Date }): Promise<void> {
  const fireAt = Math.floor(match.kickoffTime.getTime() / 1000) - REMINDER_LEAD_SECONDS;
  const now = Math.floor(Date.now() / 1000);
  if (fireAt <= now) return; // kickoff is already inside the lead window — nothing to schedule

  await getQStashClient().publishJSON({
    url: matchReminderWebhookUrl(),
    body: { externalId: match.externalId },
    notBefore: fireAt,
    deduplicationId: `match-reminder-${match.externalId}`,
    flowControl: { key: FLOW_CONTROL_KEY, parallelism: FLOW_CONTROL_PARALLELISM },
  });
}

/** Called by the webhook once QStash delivers the scheduled reminder. */
export async function sendMatchKickoffReminder(externalId: number): Promise<{ outcome: string }> {
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

  // Email — every user with a notification email set, predicted or not.
  const recipients = await UserRepository.findMany({
    where: { notificationEmail: { not: null } },
    select: { notificationEmail: true },
  });
  let emailCount = 0;
  for (const user of recipients) {
    if (!user.notificationEmail) continue;
    try {
      await sendKickoffReminderEmail(user.notificationEmail, matchForEmail);
      emailCount++;
    } catch (e) {
      logger.error('[match-reminder] Failed to email reminder:', {
        matchId: match.id,
        to: user.notificationEmail,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  // Push — every user with a registered device token, predicted or not.
  const mobileUserIds = (await DeviceTokenRepository.findMany({
    select: { userId: true },
    distinct: ['userId'],
  })).map(d => d.userId);

  if (mobileUserIds.length > 0) {
    try {
      await sendPushToUsers(mobileUserIds, {
        title: 'Kickoff in 60 minutes!',
        body: `${match.homeTeamName} vs ${match.awayTeamName} kicks off soon.`,
        data: { type: 'match_reminder', matchId: String(match.id) },
      });
    } catch (e) {
      logger.error('[match-reminder] FCM push failed:', { matchId: match.id, error: e instanceof Error ? e.message : String(e) });
    }
  }

  logger.info('[match-reminder] Reminder sent', { matchId: match.id, emailCount, pushCount: mobileUserIds.length });
  return { outcome: 'sent' };
}
