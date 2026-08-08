import { getQStashClient, testNotificationWebhookUrl } from '@/lib/qstash';
import { sendPushToUsers } from '@/lib/fcm';
import { logger } from '@/lib/logger';

// Deliberately independent of live-goal-service.ts / Match state — this only
// proves the QStash round trip (publish → wait → webhook → signature verify →
// push) works, without needing a real live match or predictors to observe it.
export const TEST_NOTIFICATION_DELAY_SECONDS = 60;

/** Schedules a delayed test push to a specific user via QStash. */
export async function scheduleTestNotification(userId: number): Promise<void> {
  await getQStashClient().publishJSON({
    url: testNotificationWebhookUrl(),
    body: { userId },
    delay: TEST_NOTIFICATION_DELAY_SECONDS,
    deduplicationId: `qstash-test-${userId}-${Date.now()}`,
  });
}

/** Called by the webhook once QStash delivers the delayed message. */
export async function sendScheduledTestNotification(userId: number): Promise<void> {
  await sendPushToUsers([userId], {
    title: 'QStash Test Notification',
    body: `This push was scheduled ${TEST_NOTIFICATION_DELAY_SECONDS}s ago from the admin panel — if you're seeing it, the QStash pipeline (publish → wait → webhook → signature verify → push) works end-to-end.`,
    data: { type: 'qstash_pipeline_test' },
  });
  logger.info('[qstash-test] Delayed test notification sent', { userId });
}
