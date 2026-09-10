import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  publishJSON: vi.fn(), verify: vi.fn(), fetch: vi.fn(),
  eligible: vi.fn(), preferences: vi.fn(), transaction: vi.fn(),
  deleteMany: vi.fn(), createMany: vi.fn(), outbox: vi.fn(), drain: vi.fn(),
}));
vi.mock('@/lib/qstash', () => ({
  getQStashClient: () => ({ publishJSON: mocks.publishJSON }),
  getQStashReceiver: () => ({ verify: mocks.verify }),
  reminderFixtureRefreshWebhookUrl: () => 'https://example.com/api/webhooks/qstash/reminder-fixtures',
}));
vi.mock('@/lib/reminders/outbox', () => ({ drainReminderRefreshes: mocks.drain }));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }));
vi.mock('@/lib/prisma', () => ({ prisma: {
  teamLeague: { findMany: mocks.eligible },
  userReminderTeam: { findMany: mocks.preferences },
  $transaction: mocks.transaction,
} }));
import { saveUserReminderPreferences } from '@/lib/services/reminder-service';
import { POST } from '@/app/api/webhooks/qstash/reminder-fixtures/route';
import { NextRequest } from 'next/server';

beforeEach(() => {
  vi.resetAllMocks();
  mocks.transaction.mockImplementation(async callback => callback({ userReminderTeam: {
    deleteMany: mocks.deleteMany, createMany: mocks.createMany,
  }, reminderRefresh: { upsert: mocks.outbox } }));
  mocks.preferences.mockResolvedValue([]);
  mocks.publishJSON.mockResolvedValue({});
  mocks.fetch.mockResolvedValue({ errors: 0 });
  mocks.verify.mockResolvedValue(true);
});
afterEach(() => vi.useRealTimers());

describe('preference save queues fixture ingestion', () => {
  it('commits before queuing each selected league once, including repeated saves', async () => {
    mocks.eligible.mockResolvedValue([
      { id: 1, leagueId: 10 }, { id: 2, leagueId: 10 },
      { id: 3, leagueId: 20 }, { id: 4, leagueId: 20 },
    ]);
    await saveUserReminderPreferences(7, [1, 2, 3, 4]);
    expect(mocks.publishJSON.mock.calls.map(([job]) => job.body)).toEqual([{ leagueId: 10 }, { leagueId: 20 }]);
    expect(mocks.createMany.mock.invocationCallOrder[0]).toBeLessThan(mocks.publishJSON.mock.invocationCallOrder[0]);
    await saveUserReminderPreferences(7, [1, 2, 3, 4]);
    expect(mocks.publishJSON).toHaveBeenCalledTimes(4);
  });
  it('does not queue on invalid selections or clearing preferences', async () => {
    mocks.eligible.mockResolvedValue([{ id: 1, leagueId: 10 }]);
    await expect(saveUserReminderPreferences(7, [1])).rejects.toThrow('at least two');
    expect(mocks.transaction).not.toHaveBeenCalled();
    mocks.eligible.mockResolvedValue([]);
    await saveUserReminderPreferences(7, []);
    expect(mocks.publishJSON).not.toHaveBeenCalled();
  });
  it('does not queue if the preference transaction fails', async () => {
    mocks.eligible.mockResolvedValue([{ id: 1, leagueId: 10 }, { id: 2, leagueId: 10 }]);
    mocks.transaction.mockRejectedValue(new Error('db unavailable'));
    await expect(saveUserReminderPreferences(7, [1, 2])).rejects.toThrow('db unavailable');
    expect(mocks.publishJSON).not.toHaveBeenCalled();
  });
  it('keeps successful saves backed by the outbox when the wake-up queue is down', async () => {
    mocks.eligible.mockResolvedValue([{ id: 1, leagueId: 10 }, { id: 2, leagueId: 10 }]);
    mocks.publishJSON.mockRejectedValue(new Error('queue unavailable'));
    await expect(saveUserReminderPreferences(7, [1, 2])).resolves.toEqual([]);
    expect(mocks.outbox).toHaveBeenCalled();
    expect(mocks.createMany).toHaveBeenCalled();
  });
});


function request(body: string) {
  return new NextRequest('https://example.com/api/webhooks/qstash/reminder-fixtures', {
    method: 'POST', body, headers: { 'upstash-signature': 'test' },
  });
}
it('rejects unsigned callbacks before fetching', async () => {
  mocks.verify.mockResolvedValue(false);
  expect((await POST(request('{"leagueId":10}'))).status).toBe(401);
  expect(mocks.fetch).not.toHaveBeenCalled();
});
it.each(['null', '{}', '{"leagueId":0}', '{"leagueId":"10"}', 'bad json'])('rejects invalid payload %s', async body => {
  expect((await POST(request(body))).status).toBe(400);
  expect(mocks.fetch).not.toHaveBeenCalled();
});
it('returns 500 for retry when ingestion or scheduling reports errors', async () => {
  mocks.drain.mockRejectedValueOnce(new Error('database unavailable'));
  expect((await POST(request('{"leagueId":10}'))).status).toBe(500);
  mocks.drain.mockResolvedValue(undefined);
  expect((await POST(request('{"leagueId":10}'))).status).toBe(200);
});
