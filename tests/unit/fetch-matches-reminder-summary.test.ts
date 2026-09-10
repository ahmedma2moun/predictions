import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  selections: vi.fn(), users: vi.fn(), matches: vi.fn(), createMany: vi.fn(),
  fixtures: vi.fn(), schedule: vi.fn(), sendMail: vi.fn(), activeTeams: vi.fn(), liveGoals: vi.fn(),
}));
vi.mock('@/lib/prisma', () => ({ prisma: {
  userReminderTeam: { findMany: mocks.selections }, user: { findMany: mocks.users },
} }));
vi.mock('@/lib/reminder-fixture-refresh', () => ({ enqueueReminderFixtureRefresh: vi.fn() }));
vi.mock('@/lib/services/team-service', () => ({ TeamService: { getActiveTeamsByLeagueMap: mocks.activeTeams } }));
vi.mock('@/lib/services/league-service', () => ({ LeagueService: { getAll: async () => [{ id: 1, externalId: 10, name: 'League', season: 2026 }] } }));
vi.mock('@/lib/services/season-service', () => ({ SeasonService: { getActiveSeason: async () => null } }));
vi.mock('@/lib/repositories/match-repository', () => ({ MatchRepository: { findMany: mocks.matches, createMany: mocks.createMany } }));
vi.mock('@/lib/repositories/user-repository', () => ({ UserRepository: {} }));
vi.mock('@/lib/repositories/device-repository', () => ({ DeviceTokenRepository: {} }));
vi.mock('@/lib/football/service', () => ({ fetchFixtures: mocks.fixtures, mapFixtureStatus: () => 'scheduled' }));
vi.mock('@/lib/live-goal-service', () => ({ registerLiveGoalChain: mocks.liveGoals }));
vi.mock('@/lib/match-reminder-service', () => ({ registerMatchReminderChain: mocks.schedule }));
vi.mock('@/lib/fcm', () => ({ sendPushToUsers: vi.fn() }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), error: vi.fn() } }));
vi.mock('nodemailer', () => ({ default: { createTransport: () => ({ sendMail: mocks.sendMail }) } }));

import { fetchAndInsertMatches, buildReminderOnlyNotices } from '@/lib/matches-processor';
import { getReminderRecipients } from '@/lib/services/reminder-service';
import { sendFetchMatchesCronEmail } from '@/lib/email';

const kickoffTime = new Date('2026-09-12T18:00:00Z');
const match = { externalLeagueId: 10, homeTeamExtId: 1, awayTeamExtId: 2 };

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-10T12:00:00Z'));
  mocks.activeTeams.mockResolvedValue(new Map());
  mocks.liveGoals.mockResolvedValue(undefined);
  mocks.selections.mockResolvedValue([1, 2].map(externalId => ({
    userId: 7, teamLeague: { externalLeagueId: 10, team: { externalId } },
  })));
  mocks.users.mockResolvedValue([{ name: 'Push User', notificationEmail: null }]);
  mocks.matches.mockResolvedValue([{ id: 100, externalId: 200, predictionsEnabled: false }]);
  mocks.fixtures.mockResolvedValue([{
    fixture: { id: 200, date: kickoffTime.toISOString(), status: { short: 'NS' } },
    teams: { home: { id: 1, name: 'Home' }, away: { id: 2, name: 'Away' } },
  }]);
  mocks.schedule.mockResolvedValue(undefined);
});
afterEach(() => vi.useRealTimers());

it('includes subscribers without email in the summary for an existing scheduled game', async () => {
  const summary = await fetchAndInsertMatches({
    from: '2026-09-10', to: '2026-09-16', fromDate: new Date('2026-09-10T00:00:00Z'),
    filterByTeams: true, sendNotifications: false, logPrefix: 'test',
  });
  expect(summary).toMatchObject({ inserted: 0, skipped: 1, errors: 0 });
  expect(mocks.createMany).not.toHaveBeenCalled();
  expect(mocks.schedule).not.toHaveBeenCalled();
  const reminderOnlyMatches = await buildReminderOnlyNotices([...summary.insertedMatches, ...summary.skippedMatches]);
  await sendFetchMatchesCronEmail({ ...summary, reminderOnlyMatches, from: '2026-09-10', to: '2026-09-16' });
  const html = mocks.sendMail.mock.calls[0][0].html;
  expect(html).toContain('Push User (no notification email configured)');
  expect(html).not.toContain('no one selected both teams');
});

it.each([false, true])('queues only newly inserted games when predictionsEnabled=%s, including repeated fetches', async predictionsEnabled => {
  if (predictionsEnabled) mocks.activeTeams.mockResolvedValue(new Map([[10, new Set([1])]]));
  const existing = { id: 100, externalId: 200, predictionsEnabled };
  mocks.matches.mockResolvedValueOnce([existing]).mockResolvedValueOnce([]);
  const fixture = (id: number) => ({
    fixture: { id, date: kickoffTime.toISOString(), status: { short: 'NS' } },
    teams: { home: { id: 1, name: 'Home' }, away: { id: 2, name: 'Away' } },
  });
  mocks.fixtures.mockResolvedValue([fixture(200), fixture(201)]);
  const params = {
    from: '2026-09-10', to: '2026-09-16', fromDate: new Date('2026-09-10T00:00:00Z'),
    filterByTeams: true, sendNotifications: false, strictReminderScheduling: true, logPrefix: 'test',
  };
  expect(await fetchAndInsertMatches(params)).toMatchObject({ inserted: 1, skipped: 1, errors: 0 });
  expect(mocks.schedule).toHaveBeenCalledExactlyOnceWith({ externalId: 201, kickoffTime });
  expect(mocks.liveGoals).toHaveBeenCalledTimes(predictionsEnabled ? 1 : 0);

  mocks.matches.mockResolvedValue([existing, { id: 101, externalId: 201, predictionsEnabled }]);
  expect(await fetchAndInsertMatches(params)).toMatchObject({ inserted: 0, skipped: 2, errors: 0 });
  expect(mocks.schedule).toHaveBeenCalledTimes(1);
  expect(mocks.liveGoals).toHaveBeenCalledTimes(predictionsEnabled ? 1 : 0);
});

it('preserves notification email addresses for email subscribers', async () => {
  mocks.users.mockResolvedValue([{ name: 'Email User', notificationEmail: 'reminders@example.invalid' }]);
  expect(await getReminderRecipients(match)).toEqual([{ name: 'Email User', email: 'reminders@example.invalid' }]);
});

it('does not count a user who selected only one of the teams', async () => {
  mocks.selections.mockResolvedValue([{ userId: 7, teamLeague: { team: { externalId: 1 } } }]);
  expect(await getReminderRecipients(match)).toEqual([]);
  expect(mocks.users).not.toHaveBeenCalled();
  await sendFetchMatchesCronEmail({
    inserted: 0, skipped: 1, errors: 0, insertedMatches: [], skippedMatches: [],
    reminderOnlyMatches: [{ leagueName: 'League', homeTeamName: 'Home', awayTeamName: 'Away', kickoffTime, recipients: [] }],
    from: '2026-09-10', to: '2026-09-16',
  });
  expect(mocks.sendMail.mock.calls[0][0].html).toContain('no one selected both teams');
});
