import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ matches: vi.fn(), cronEmail: vi.fn(), auth: vi.fn() }));
vi.mock('@/lib/repositories/match-repository', () => ({ MatchRepository: { findMany: mocks.matches } }));
vi.mock('@/lib/repositories/prediction-repository', () => ({ PredictionRepository: {} }));
vi.mock('@/lib/services/user-service', () => ({ UserService: {} }));
vi.mock('@/lib/services/device-service', () => ({ DeviceTokenService: {} }));
vi.mock('@/lib/email', () => ({ sendDailyReminderEmail: vi.fn(), sendCronRunEmail: mocks.cronEmail }));
vi.mock('@/lib/fcm', () => ({ sendPushToUsers: vi.fn() }));
vi.mock('@/lib/cron-auth', () => ({ verifyCronRequest: mocks.auth }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/logging/with-api-logging', () => ({ withApiLogging: (_name: string, handler: unknown) => handler }));

import { GET } from '@/app/api/cron/daily-reminder/route';

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue(true);
  mocks.matches.mockResolvedValue([]);
});

it('only considers prediction-enabled matches, so reminder-only fixtures never trigger reminders', async () => {
  await (GET as any)(new Request('http://localhost/api/cron/daily-reminder'));
  expect(mocks.matches).toHaveBeenCalledWith(expect.objectContaining({
    where: expect.objectContaining({ status: 'scheduled', predictionsEnabled: true }),
  }));
});
