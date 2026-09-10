import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ match: vi.fn(), job: vi.fn(), deliver: vi.fn(), plan: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: { match: { findUnique: mocks.match }, reminderJob: { findUnique: mocks.job } } }));
vi.mock('@/lib/reminders/worker', () => ({ deliverReminderJob: mocks.deliver }));
vi.mock('@/lib/reminders/planner', () => ({ planMatchReminders: mocks.plan }));
import { sendMatchKickoffReminder, registerMatchReminderChain } from '@/lib/match-reminder-service';
import { reminderPolicies, reminderWindow, isReminderKind } from '@/lib/reminders/policy';
import { predictionDigestWhere } from '@/lib/reminders/prediction-digest';
beforeEach(() => vi.resetAllMocks());
it.each([
  [true, 'before', true], [true, 'kickoff', false], [false, 'before', false], [false, 'kickoff', false],
] as const)('prediction policy for enabled=%s kind=%s is %s', (enabled, kind, broadcast) => {
  expect(reminderPolicies(enabled, kind)).toEqual({ predictionPreKickoff: broadcast, followedMatch: true });
});
it('excludes reminder-only fixtures from prediction digests', () => {
  expect(predictionDigestWhere(new Date(0), new Date(1))).toEqual({ predictionsEnabled: true, status: 'scheduled', kickoffTime: { gte: new Date(0), lte: new Date(1) } });
});
it('uses a five-minute transport grace without moving the nominal reminder time', () => {
  const kickoff = new Date('2026-09-12T18:00:00Z');
  expect(reminderWindow(kickoff, 'before')).toEqual({ dueAt: new Date('2026-09-12T17:00:00Z'), expiresAt: new Date('2026-09-12T17:05:00Z') });
});
it.each([null, 0, 'bad', {}, undefined])('rejects invalid kind %s', value => expect(isReminderKind(value)).toBe(false));
it('maps existing legacy callbacks to a durable job without creating a new schedule', async () => {
  const kickoffTime = new Date(); mocks.match.mockResolvedValue({ id: 1, kickoffTime }); mocks.job.mockResolvedValue({ id: 9 });
  await sendMatchKickoffReminder(200);
  expect(mocks.job).toHaveBeenCalledWith({ where: { matchId_kickoffTime_kind: { matchId: 1, kickoffTime, kind: 'before' } } });
  expect(mocks.deliver).toHaveBeenCalledWith(9); expect(mocks.plan).not.toHaveBeenCalled();
});
it('ignores a legacy callback with no durable job', async () => {
  mocks.match.mockResolvedValue({ id: 1, kickoffTime: new Date() }); mocks.job.mockResolvedValue(null);
  expect(await sendMatchKickoffReminder(200)).toEqual({ outcome: 'legacy_job_not_planned' });
  expect(mocks.deliver).not.toHaveBeenCalled();
});
it('ignores missing fixtures', async () => {
  mocks.match.mockResolvedValue(null); expect(await sendMatchKickoffReminder(200)).toEqual({ outcome: 'match_not_found' });
});
it('plans by internal match id for legacy producers', async () => {
  mocks.match.mockResolvedValue({ id: 1 }); await registerMatchReminderChain({ externalId: 200, kickoffTime: new Date() });
  expect(mocks.plan).toHaveBeenCalledWith(1);
});
