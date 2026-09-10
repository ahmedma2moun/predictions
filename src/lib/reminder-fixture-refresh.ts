import { getQStashClient, reminderFixtureRefreshWebhookUrl } from '@/lib/qstash';

export async function enqueueReminderFixtureRefresh(leagueId: number): Promise<void> {
  await getQStashClient().publishJSON({
    url: reminderFixtureRefreshWebhookUrl(),
    body: { leagueId },
    retries: 3,
    flowControl: { key: 'reminder-fixture-refresh', parallelism: 1 },
  });
}

export async function refreshReminderFixtures(leagueId: number): Promise<void> {
  // Deferred import avoids a module initialization cycle with reminder-service.
  const { fetchAndInsertMatches } = await import('@/lib/matches-processor');
  const fromDate = new Date();
  fromDate.setUTCHours(0, 0, 0, 0);
  const toDate = new Date(fromDate);
  toDate.setUTCDate(toDate.getUTCDate() + 6);
  const result = await fetchAndInsertMatches({
    from: fromDate.toISOString().slice(0, 10),
    to: toDate.toISOString().slice(0, 10),
    fromDate,
    leagueId,
    filterByTeams: true,
    sendNotifications: false,
    strictReminderScheduling: true,
    logPrefix: 'reminder-fixture-refresh',
  });
  if (result.errors) throw new Error('Reminder fixture refresh failed');
}
