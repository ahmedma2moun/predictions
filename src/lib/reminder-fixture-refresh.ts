import { getQStashClient, reminderFixtureRefreshWebhookUrl } from '@/lib/qstash';
import { prisma } from '@/lib/prisma';
import { fetchFixtures, fetchFixtureById, mapFixtureStatus } from '@/lib/football/service';
import { getReminderPairsByLeagueMap, reminderPairKey } from '@/lib/reminders/subscriptions';
import { planMatchReminders } from '@/lib/reminders/planner';

/** Best-effort wake-up only. The transactionally persisted outbox is authoritative. */
export async function enqueueReminderFixtureRefresh(leagueId: number): Promise<void> {
  await getQStashClient().publishJSON({
    url: reminderFixtureRefreshWebhookUrl(), body: { leagueId }, retries: 3,
    flowControl: { key: 'reminder-fixture-refresh', parallelism: 1 },
  });
}

/** Import only subscribed fixtures. Never modify prediction eligibility or announce games. */
export async function refreshReminderFixtures(leagueId: number): Promise<void> {
  const league = await prisma.league.findFirst({ where: { id: leagueId, isActive: true } });
  if (!league) return;
  const pairs = (await getReminderPairsByLeagueMap(league.externalId)).get(league.externalId);
  const existing = await prisma.match.findMany({ where: { leagueId, status: { in: ['scheduled', 'postponed'] }, kickoffTime: { gte: new Date(Date.now() - 86_400_000), lte: new Date(Date.now() + 8 * 86_400_000) } }, select: { externalId: true } });
  const existingIds = new Set(existing.map(match => match.externalId));
  if (!pairs?.size && !existingIds.size) return;
  const fromDate = new Date(); fromDate.setUTCHours(0, 0, 0, 0);
  const toDate = new Date(fromDate); toDate.setUTCDate(toDate.getUTCDate() + 7);
  const fixtures = await fetchFixtures({ league: league.externalId, season: league.season,
    from: fromDate.toISOString().slice(0, 10), to: toDate.toISOString().slice(0, 10) });
  // Rescheduling may move a stored fixture outside the date-window response.
  const returnedIds = new Set(fixtures.map(fixture => fixture.fixture.id));
  for (const row of existing) {
    if (row.externalId == null || returnedIds.has(row.externalId)) continue;
    const updated = await fetchFixtureById(row.externalId);
    if (updated) fixtures.push(updated);
  }
  for (const fixture of fixtures) {
    if (!existingIds.has(fixture.fixture.id) && !pairs?.has(reminderPairKey(fixture.teams.home.id, fixture.teams.away.id))) continue;
    const facts = {
      kickoffTime: new Date(fixture.fixture.date), status: mapFixtureStatus(fixture.fixture.status.short),
      homeTeamName: fixture.teams.home.name, awayTeamName: fixture.teams.away.name,
    };
    const match = await prisma.match.upsert({
      where: { externalId: fixture.fixture.id },
      create: { ...facts, externalId: fixture.fixture.id, leagueId, externalLeagueId: league.externalId,
        homeTeamExtId: fixture.teams.home.id, awayTeamExtId: fixture.teams.away.id,
        homeTeamLogo: fixture.teams.home.logo, awayTeamLogo: fixture.teams.away.logo,
        predictionsEnabled: false, weekStart: fromDate,
        stage: fixture.fixture.stage ?? null, matchday: fixture.fixture.matchday ?? null,
      },
      // Result processing owns live/finished transitions for prediction games.
      update: { ...facts, status: ['scheduled', 'postponed', 'cancelled'].includes(facts.status) ? facts.status : undefined },
    });
    await planMatchReminders(match.id);
  }
}
