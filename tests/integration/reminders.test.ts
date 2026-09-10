import { beforeEach, afterAll, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ email: vi.fn(), push: vi.fn(), publish: vi.fn(), fixtures: vi.fn(), fixtureById: vi.fn() }));
vi.mock('@/lib/email', () => ({ sendKickoffReminderEmail: mocks.email }));
vi.mock('@/lib/fcm', () => ({ sendPushToDevices: mocks.push }));
vi.mock('@/lib/qstash', () => ({ getQStashClient: () => ({ publishJSON: mocks.publish }), matchReminderWebhookUrl: () => 'https://example.invalid/reminder', reminderFixtureRefreshWebhookUrl: () => 'https://example.invalid/refresh' }));
vi.mock('@/lib/football/service', () => ({ fetchFixtures: mocks.fixtures, fetchFixtureById: mocks.fixtureById, mapFixtureStatus: () => 'scheduled' }));
import { prisma } from '@/lib/prisma';
import { resetDb } from '../helpers/db';
import { planMatchReminders, publishReminderJobs } from '@/lib/reminders/planner';
import { deliverReminderJob } from '@/lib/reminders/worker';
import { saveUserReminderPreferences } from '@/lib/services/reminder-service';
import { refreshReminderFixtures } from '@/lib/reminder-fixture-refresh';
import { drainReminderRefreshes } from '@/lib/reminders/outbox';
import { predictionDigestWhere } from '@/lib/reminders/prediction-digest';
import { reconcileReminders } from '@/lib/reminders/reconcile';

beforeEach(async () => {
  vi.resetAllMocks();
  mocks.email.mockResolvedValue(undefined);
  mocks.push.mockResolvedValue([{ success: true }]);
  mocks.publish.mockResolvedValue({ messageId: 'mock-message' });
  mocks.fixtures.mockResolvedValue([]);
  mocks.fixtureById.mockResolvedValue(null);
  await resetDb();
});
afterAll(() => prisma.$disconnect());
async function user(id: number, email = true) {
  return prisma.user.create({ data: { id, name: `User ${id}`, email: `user${id}@example.invalid`, notificationEmail: email ? `notify${id}@example.invalid` : null, password: 'not-used' } });
}
async function fixture(predictionsEnabled = true, externalId: number | null = 100) {
  return prisma.match.create({ data: {
    externalId, externalLeagueId: 10, homeTeamExtId: 1, awayTeamExtId: 2,
    homeTeamName: 'Home', awayTeamName: 'Away', predictionsEnabled,
    kickoffTime: new Date(Date.now() + 3_700_000), weekStart: new Date(),
  } });
}
async function dueJob(matchId: number, kind = 'before') {
  await planMatchReminders(matchId);
  const job = await prisma.reminderJob.findFirstOrThrow({ where: { matchId, kind } });
  return prisma.reminderJob.update({ where: { id: job.id }, data: { dueAt: new Date(Date.now() - 1000), expiresAt: new Date(Date.now() + 300_000) } });
}
async function teams() {
  const league = await prisma.league.create({ data: { id: 10, externalId: 10, name: 'League', country: 'Test', season: 2026, isActive: true } });
  const links = [];
  for (const id of [1, 2, 3]) {
    const team = await prisma.team.create({ data: { id, externalId: id, name: `Team ${id}` } });
    links.push(await prisma.teamLeague.create({ data: { id, teamId: team.id, leagueId: league.id, externalLeagueId: 10, reminderEnabled: true, isActive: false } }));
  }
  return links;
}

it('persists one logical job across repeated and concurrent planning, including custom matches', async () => {
  const match = await fixture(true, null);
  await Promise.all([planMatchReminders(match.id), planMatchReminders(match.id)]);
  await planMatchReminders(match.id);
  expect(await prisma.reminderJob.count()).toBe(2);
});
it('preserves the kickoff job when a fixture has just become live', async () => {
  const match = await fixture();
  await planMatchReminders(match.id);
  await prisma.match.update({ where: { id: match.id }, data: { status: 'live' } });
  await planMatchReminders(match.id);
  expect(await prisma.reminderJob.findFirst({ where: { matchId: match.id, kind: 'before' } })).toMatchObject({ status: 'superseded' });
  expect(await prisma.reminderJob.findFirst({ where: { matchId: match.id, kind: 'kickoff' } })).toMatchObject({ status: 'pending' });
});
it('broadcasts prediction reminders, includes push-only users, and deduplicates concurrent callbacks', async () => {
  await user(1); await user(2, false);
  await prisma.deviceToken.create({ data: { userId: 2, token: 'push-only-device' } });
  const match = await fixture(); const job = await dueJob(match.id);
  await Promise.allSettled([deliverReminderJob(job.id), deliverReminderJob(job.id)]);
  await deliverReminderJob(job.id);
  expect(mocks.email).toHaveBeenCalledTimes(1); expect(mocks.push).toHaveBeenCalledTimes(1);
  expect(await prisma.reminderDelivery.count({ where: { status: 'accepted' } })).toBe(2);
});
it('retries only failed recipients after partial email failure', async () => {
  await user(1); await user(2);
  const match = await fixture(); const job = await dueJob(match.id);
  mocks.email.mockImplementation(async (email: string) => { if (email.includes('notify2')) throw new Error('temporary'); });
  expect(await deliverReminderJob(job.id)).toMatchObject({ outcome: 'processing' });
  expect(await prisma.reminderDelivery.count({ where: { status: 'accepted' } })).toBe(1);
  await prisma.reminderDelivery.updateMany({ where: { status: 'retry' }, data: { nextAttemptAt: new Date(0) } });
  mocks.email.mockResolvedValue(undefined);
  await deliverReminderJob(job.id);
  expect(mocks.email.mock.calls.filter(([email]) => email.includes('notify1'))).toHaveLength(1);
  expect(mocks.email.mock.calls.filter(([email]) => email.includes('notify2'))).toHaveLength(2);
});
it('retries per-device failures without re-sending an accepted device', async () => {
  await user(1, false);
  await prisma.deviceToken.createMany({ data: [{ userId: 1, token: 'good' }, { userId: 1, token: 'bad' }] });
  const match = await fixture(); const job = await dueJob(match.id);
  mocks.push.mockImplementation(async ([device]) => [{ success: device.token === 'good', errorCode: 'messaging/internal-error' }]);
  expect(await deliverReminderJob(job.id)).toMatchObject({ outcome: 'processing' });
  await prisma.reminderDelivery.updateMany({ where: { status: 'retry' }, data: { nextAttemptAt: new Date(0) } });
  mocks.push.mockResolvedValue([{ success: true }]); await deliverReminderJob(job.id);
  expect(mocks.push.mock.calls.filter(([[device]]) => device.token === 'good')).toHaveLength(1);
});
it('requires both teams selected by the same user, with no cross-user union', async () => {
  await user(1); await user(2); await teams();
  await prisma.userReminderTeam.createMany({ data: [{ userId: 1, teamLeagueId: 1 }, { userId: 2, teamLeagueId: 2 }] });
  const match = await fixture(false); const job = await dueJob(match.id);
  expect(await deliverReminderJob(job.id)).toMatchObject({ outcome: 'no_subscribers' });
  expect(mocks.email).not.toHaveBeenCalled();
});
it('sends a followed-team reminder once to a subscriber, and leaves prediction kickoff alerts opt-in', async () => {
  await user(1); await user(2); await teams();
  await prisma.userReminderTeam.createMany({ data: [{ userId: 1, teamLeagueId: 1 }, { userId: 1, teamLeagueId: 2 }] });
  const match = await fixture(false); const before = await dueJob(match.id);
  await deliverReminderJob(before.id);
  expect(mocks.email).toHaveBeenCalledTimes(1);
  await prisma.match.update({ where: { id: match.id }, data: { predictionsEnabled: true } });
  const kickoff = await dueJob(match.id, 'kickoff'); await deliverReminderJob(kickoff.id);
  expect(mocks.email).toHaveBeenCalledTimes(2);
  expect(mocks.email.mock.calls.every(([email]) => email.includes('notify1'))).toBe(true);
});
it('unsubscribing suppresses a retry instead of sending an old audience snapshot', async () => {
  await user(1); await teams();
  await prisma.userReminderTeam.createMany({ data: [{ userId: 1, teamLeagueId: 1 }, { userId: 1, teamLeagueId: 2 }] });
  const match = await fixture(false); const job = await dueJob(match.id);
  mocks.email.mockRejectedValue(new Error('temporary'));
  expect(await deliverReminderJob(job.id)).toMatchObject({ outcome: 'processing' });
  await prisma.userReminderTeam.deleteMany();
  await prisma.reminderDelivery.updateMany({ data: { nextAttemptAt: new Date(0) } });
  await deliverReminderJob(job.id);
  expect(mocks.email).toHaveBeenCalledTimes(1);
  expect(await prisma.reminderDelivery.count({ where: { status: 'skipped' } })).toBe(1);
});
it('supersedes old kickoff versions and rejects late delivery', async () => {
  await user(1); const match = await fixture(); const old = await dueJob(match.id);
  await prisma.match.update({ where: { id: match.id }, data: { kickoffTime: new Date(Date.now() + 86_400_000) } });
  await planMatchReminders(match.id);
  expect(await deliverReminderJob(old.id)).toEqual({ outcome: 'superseded' });
  const job = await prisma.reminderJob.findFirstOrThrow({ where: { matchId: match.id, status: 'pending' } });
  await prisma.reminderJob.update({ where: { id: job.id }, data: { expiresAt: new Date(0) } });
  expect(await deliverReminderJob(job.id)).toEqual({ outcome: 'expired' });
  expect(mocks.email).not.toHaveBeenCalled();
});
it('persists preference changes and outbox atomically during queue outage; retries drain it', async () => {
  await user(1); await teams(); mocks.publish.mockRejectedValue(new Error('queue down'));
  await saveUserReminderPreferences(1, [1, 2]);
  expect(await prisma.userReminderTeam.count()).toBe(2);
  expect(await prisma.reminderRefresh.findUnique({ where: { leagueId: 10 } })).toMatchObject({ revision: 1, completedRevision: 0 });
  await drainReminderRefreshes();
  expect(await prisma.reminderRefresh.findUnique({ where: { leagueId: 10 } })).toMatchObject({ completedRevision: 1 });
});
it('does not lose a newer preference revision while an earlier refresh runs', async () => {
  await user(1); await teams(); await saveUserReminderPreferences(1, [1, 2]);
  mocks.fixtures.mockImplementationOnce(async () => { await saveUserReminderPreferences(1, [1, 3]); return []; });
  await drainReminderRefreshes();
  expect(await prisma.reminderRefresh.findUnique({ where: { leagueId: 10 } })).toMatchObject({ revision: 2, completedRevision: 1 });
  await drainReminderRefreshes();
  expect(await prisma.reminderRefresh.findUnique({ where: { leagueId: 10 } })).toMatchObject({ completedRevision: 2 });
});
it('imports subscribed fixtures only and preserves existing prediction eligibility', async () => {
  await user(1); await teams(); await saveUserReminderPreferences(1, [1, 2]);
  const existing = await fixture(true, 100);
  const apiFixture = (id: number, away: number) => ({ fixture: { id, date: new Date(Date.now() + 7_200_000).toISOString(), status: { short: 'NS' } }, teams: { home: { id: 1, name: 'Home', logo: null }, away: { id: away, name: 'Away', logo: null } } });
  mocks.fixtures.mockResolvedValue([apiFixture(100, 2), apiFixture(101, 2), apiFixture(102, 3)]);
  await refreshReminderFixtures(10);
  expect(await prisma.match.findUnique({ where: { id: existing.id } })).toMatchObject({ predictionsEnabled: true });
  expect(await prisma.match.findUnique({ where: { externalId: 101 } })).toMatchObject({ predictionsEnabled: false });
  expect(await prisma.match.findUnique({ where: { externalId: 102 } })).toBeNull();
});
it('filters reminder-only games from real digest queries', async () => {
  const prediction = await fixture(); await fixture(false, 101);
  const matches = await prisma.match.findMany({ where: predictionDigestWhere(new Date(), new Date(Date.now() + 86_400_000)) });
  expect(matches.map(match => match.id)).toEqual([prediction.id]);
});
it('retains pending jobs on broker outage and reconciliation repairs missing schedules', async () => {
  const match = await fixture(true, null); mocks.publish.mockRejectedValue(new Error('broker down'));
  await reconcileReminders();
  expect(await prisma.reminderJob.count({ where: { matchId: match.id, status: 'pending' } })).toBe(2);
  mocks.publish.mockResolvedValue({ messageId: 'accepted' }); await publishReminderJobs();
  expect(await prisma.reminderJob.count({ where: { status: 'queued' } })).toBe(2);
});

it('continues a multi-batch audience without repeating accepted recipients', async () => {
  for (let i = 1; i <= 23; i++) await user(i);
  const match = await fixture(); const job = await dueJob(match.id);
  expect(await deliverReminderJob(job.id)).toMatchObject({ outcome: 'processing' });
  expect(mocks.email).toHaveBeenCalledTimes(10);
  await deliverReminderJob(job.id); await deliverReminderJob(job.id); await deliverReminderJob(job.id);
  expect(mocks.email).toHaveBeenCalledTimes(23);
  expect(await prisma.reminderDelivery.count({ where: { status: 'accepted' } })).toBe(23);
});

it('recovers expired delivery leases after a crashed worker', async () => {
  await user(1); const match = await fixture(); const job = await dueJob(match.id);
  await prisma.reminderDelivery.create({ data: { jobId: job.id, userId: 1, channel: 'email', targetKey: 'email', status: 'sending', leaseToken: 'old-worker', leaseUntil: new Date(0), attempts: 1 } });
  await deliverReminderJob(job.id);
  expect(mocks.email).toHaveBeenCalledTimes(1);
  expect(await prisma.reminderDelivery.findFirst()).toMatchObject({ status: 'accepted', leaseToken: null, attempts: 2 });
});

it('re-arms a postponed fixture reinstated at the original future kickoff', async () => {
  const match = await fixture(); await planMatchReminders(match.id);
  await prisma.match.update({ where: { id: match.id }, data: { status: 'postponed' } });
  await planMatchReminders(match.id);
  expect(await prisma.reminderJob.count({ where: { status: 'superseded' } })).toBe(2);
  await prisma.match.update({ where: { id: match.id }, data: { status: 'scheduled' } });
  await planMatchReminders(match.id);
  expect(await prisma.reminderJob.count({ where: { status: 'pending' } })).toBe(2);
});

it('refreshes existing fixtures moved outside the date window without demoting predictions', async () => {
  await teams(); const match = await fixture();
  await prisma.match.update({ where: { id: match.id }, data: { leagueId: 10 } });
  const kickoff = new Date(Date.now() + 20 * 86_400_000);
  mocks.fixtureById.mockResolvedValue({ fixture: { id: 100, date: kickoff.toISOString(), status: { short: 'NS' } }, teams: { home: { id: 1, name: 'Home', logo: null }, away: { id: 2, name: 'Away', logo: null } } });
  await refreshReminderFixtures(10);
  expect(await prisma.match.findUnique({ where: { id: match.id } })).toMatchObject({ kickoffTime: kickoff, predictionsEnabled: true });
});
