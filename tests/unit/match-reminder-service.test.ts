import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  match: vi.fn(), users: vi.fn(), devices: vi.fn(), subscribers: vi.fn(),
  email: vi.fn(), push: vi.fn(),
}));
vi.mock('@/lib/repositories/match-repository', () => ({ MatchRepository: { findUnique: mocks.match } }));
vi.mock('@/lib/repositories/user-repository', () => ({ UserRepository: { findMany: mocks.users } }));
vi.mock('@/lib/repositories/device-repository', () => ({ DeviceTokenRepository: { findMany: mocks.devices } }));
vi.mock('@/lib/services/reminder-service', () => ({ getReminderRecipientIds: mocks.subscribers }));
vi.mock('@/lib/email', () => ({ sendKickoffReminderEmail: mocks.email }));
vi.mock('@/lib/fcm', () => ({ sendPushToUsers: mocks.push }));
vi.mock('@/lib/qstash', () => ({}));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), error: vi.fn() } }));

import { sendMatchKickoffReminder } from '@/lib/match-reminder-service';

const fixture = {
  id: 100, externalId: 200, predictionsEnabled: true, status: 'scheduled',
  homeTeamName: 'Home', awayTeamName: 'Away', externalLeagueId: 10,
  homeTeamExtId: 1, awayTeamExtId: 2,
  kickoffTime: new Date('2026-09-12T18:00:00Z'), league: { name: 'League' },
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.match.mockResolvedValue(fixture);
  mocks.users.mockResolvedValue([{ id: 7, notificationEmail: 'test@example.invalid' }]);
  mocks.devices.mockResolvedValue([{ userId: 8 }]);
  mocks.subscribers.mockResolvedValue([]);
});

it('broadcasts prediction-game pre-kickoff reminders without team subscriptions, including push-only users', async () => {
  expect(await sendMatchKickoffReminder(200, 'before')).toEqual({ outcome: 'sent' });
  expect(mocks.subscribers).not.toHaveBeenCalled();
  expect(mocks.users).toHaveBeenCalledWith({
    where: { notificationEmail: { not: null } }, select: { id: true, notificationEmail: true },
  });
  expect(mocks.email).toHaveBeenCalledWith('test@example.invalid', expect.any(Object), 'before');
  expect(mocks.devices).toHaveBeenCalledWith({ select: { userId: true }, distinct: ['userId'] });
  expect(mocks.push).toHaveBeenCalledWith([8], expect.objectContaining({ title: 'Kickoff in 60 minutes!' }));
});

it('keeps older queued jobs without a kind on the pre-kickoff broadcast path', async () => {
  await sendMatchKickoffReminder(200);
  expect(mocks.subscribers).not.toHaveBeenCalled();
  expect(mocks.push).toHaveBeenCalled();
});

it('sends push even when no users have a notification email', async () => {
  mocks.users.mockResolvedValue([]);
  await sendMatchKickoffReminder(200);
  expect(mocks.email).not.toHaveBeenCalled();
  expect(mocks.push).toHaveBeenCalledWith([8], expect.any(Object));
});

it.each(['before', 'kickoff'] as const)('keeps reminder-only %s notifications restricted to subscribers', async kind => {
  mocks.match.mockResolvedValue({ ...fixture, predictionsEnabled: false });
  mocks.subscribers.mockResolvedValue([7]);
  await sendMatchKickoffReminder(200, kind);
  expect(mocks.users).toHaveBeenCalledWith(expect.objectContaining({
    where: { id: { in: [7] }, notificationEmail: { not: null } },
  }));
  expect(mocks.push).toHaveBeenCalledWith([7], expect.any(Object));
  expect(mocks.devices).not.toHaveBeenCalled();
});

it.each(['before', 'kickoff'] as const)('does not broadcast reminder-only %s notifications with no subscribers', async kind => {
  mocks.match.mockResolvedValue({ ...fixture, predictionsEnabled: false });
  expect(await sendMatchKickoffReminder(200, kind)).toEqual({ outcome: 'no_subscribers' });
  expect(mocks.email).not.toHaveBeenCalled();
  expect(mocks.push).not.toHaveBeenCalled();
  expect(mocks.users).not.toHaveBeenCalled();
});

it('does not expand prediction-game kickoff alerts to all users', async () => {
  expect(await sendMatchKickoffReminder(200, 'kickoff')).toEqual({ outcome: 'no_subscribers' });
  expect(mocks.subscribers).toHaveBeenCalledWith(fixture);
  expect(mocks.push).not.toHaveBeenCalled();
});

it.each(['finished', 'cancelled', 'postponed'])('skips %s matches', async status => {
  mocks.match.mockResolvedValue({ ...fixture, status });
  expect(await sendMatchKickoffReminder(200)).toEqual({ outcome: `skipped_status_${status}` });
  expect(mocks.users).not.toHaveBeenCalled();
  expect(mocks.push).not.toHaveBeenCalled();
});

it('skips missing matches', async () => {
  mocks.match.mockResolvedValue(null);
  expect(await sendMatchKickoffReminder(200)).toEqual({ outcome: 'match_not_found' });
  expect(mocks.push).not.toHaveBeenCalled();
});
