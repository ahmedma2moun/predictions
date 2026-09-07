import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({ getByEmail: vi.fn(), compare: vi.fn(), sign: vi.fn(), check: vi.fn() }));
vi.mock('@/lib/services/user-service', () => ({ UserService: { getByEmail: mocks.getByEmail } }));
vi.mock('bcryptjs', () => ({ default: { compare: mocks.compare } }));
vi.mock('@/lib/admin-mobile-token', () => ({ signAdminToken: mocks.sign }));
vi.mock('@/lib/rate-limit', () => ({ rateLimit: () => ({ check: mocks.check }) }));
import { POST } from '@/app/api/mobile/admin/auth/login/route';

const request = (body: unknown) => new NextRequest('https://example.com/api/mobile/admin/auth/login', {
  method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' },
});
beforeEach(() => {
  vi.resetAllMocks();
  mocks.getByEmail.mockResolvedValue({ id: 42, name: 'Admin', email: 'admin@example.com', role: 'admin', password: 'hash' });
  mocks.compare.mockResolvedValue(true);
  mocks.sign.mockResolvedValue('dedicated-admin-token');
});
it('issues an admin token and never returns a password', async () => {
  const response = await POST(request({ email: ' ADMIN@example.com ', password: 'password' }));
  expect(response.status).toBe(200);
  expect(mocks.getByEmail).toHaveBeenCalledWith('admin@example.com');
  expect(await response.json()).toEqual({ token: 'dedicated-admin-token', user: { id: '42', name: 'Admin', email: 'admin@example.com', role: 'admin' } });
  expect(response.headers.get('Cache-Control')).toBe('no-store');
});
it('refuses valid player credentials without issuing a token', async () => {
  mocks.getByEmail.mockResolvedValue({ id: 1, role: 'user', password: 'hash' });
  expect((await POST(request({ email: 'user@example.com', password: 'password' }))).status).toBe(401);
  expect(mocks.sign).not.toHaveBeenCalled();
});
it('refuses incorrect passwords', async () => {
  mocks.compare.mockResolvedValue(false);
  expect((await POST(request({ email: 'admin@example.com', password: 'wrong' }))).status).toBe(401);
  expect(mocks.sign).not.toHaveBeenCalled();
});
it.each([{ email: 123, password: 'x' }, { email: 'a', password: {} }, { email: '', password: '' }, null])('rejects malformed credentials %j', async body => {
  expect((await POST(request(body))).status).toBe(400);
  expect(mocks.getByEmail).not.toHaveBeenCalled();
});
it('rate limits login attempts before reading credentials', async () => {
  mocks.check.mockRejectedValue(new Error('rate limited'));
  const response = await POST(request({ email: 'admin@example.com', password: 'password' }));
  expect(response.status).toBe(429);
  expect(response.headers.get('Retry-After')).toBe('60');
  expect(mocks.getByEmail).not.toHaveBeenCalled();
});
