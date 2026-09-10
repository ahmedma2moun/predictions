import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ send: vi.fn(), remove: vi.fn() }));
vi.mock('firebase-admin/app', () => ({ getApps: () => [{}] }));
vi.mock('firebase-admin/messaging', () => ({ getMessaging: () => ({ sendEachForMulticast: mocks.send }) }));
vi.mock('@/lib/prisma', () => ({ prisma: { deviceToken: { deleteMany: mocks.remove } } }));
import { sendPushToDevices } from '@/lib/fcm';
beforeEach(() => vi.resetAllMocks());
it('splits a 501-device audience into valid batches and retains all outcomes', async () => {
  mocks.send.mockImplementation(async ({ tokens }) => ({ responses: tokens.map(() => ({ success: true })) }));
  const devices = Array.from({ length: 501 }, (_, id) => ({ id, token: `test-token-${id}` }));
  const result = await sendPushToDevices(devices, { title: 'Test', body: 'Test' });
  expect(mocks.send.mock.calls.map(([message]) => message.tokens.length)).toEqual([500, 1]);
  expect(result).toHaveLength(501);
  expect(result.every(row => row.success)).toBe(true);
});
it('returns individual failures and removes only unregistered devices', async () => {
  mocks.send.mockResolvedValue({ responses: [{ success: false, error: { code: 'messaging/registration-token-not-registered' } }, { success: false, error: { code: 'messaging/internal-error' } }] });
  const result = await sendPushToDevices([{ id: 1, token: 'old' }, { id: 2, token: 'retry' }], { title: 'Test', body: 'Test' });
  expect(result.map(row => row.success)).toEqual([false, false]);
  expect(mocks.remove).toHaveBeenCalledWith({ where: { id: { in: [1] } } });
});
