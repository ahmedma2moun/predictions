import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SignJWT } from 'jose';
import { signAdminToken, verifyAdminToken } from '@/lib/admin-mobile-token';

const mocks = vi.hoisted(() => ({ headers: vi.fn(), webAuth: vi.fn(), findUnique: vi.fn() }));
vi.mock('next/headers', () => ({ headers: mocks.headers }));
vi.mock('@/lib/auth', () => ({ auth: mocks.webAuth, isSessionAdmin: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: { user: { findUnique: mocks.findUnique } } }));
import { auth } from '@/lib/admin-auth';

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('MOBILE_JWT_SECRET', 'test-only-admin-token-secret-with-enough-entropy');
  mocks.headers.mockResolvedValue(new Headers());
  mocks.webAuth.mockResolvedValue(null);
});

describe('native admin token isolation', () => {
  it('accepts a dedicated signed admin token', async () => {
    expect(await verifyAdminToken(await signAdminToken(42))).toBe(42);
  });
  it('rejects ordinary mobile tokens even when their role says admin', async () => {
    const token = await new SignJWT({ id: '42', role: 'admin' })
      .setProtectedHeader({ alg: 'HS256' }).setExpirationTime('30d')
      .sign(new TextEncoder().encode(process.env.MOBILE_JWT_SECRET));
    expect(await verifyAdminToken(token)).toBeNull();
  });
  it('rejects expired tokens', async () => {
    const token = await new SignJWT({ scope: 'admin' }).setSubject('42')
      .setAudience('football-prediction-admin').setIssuer('football-prediction-admin')
      .setProtectedHeader({ alg: 'HS256' }).setExpirationTime('1 second ago')
      .sign(new TextEncoder().encode(process.env.MOBILE_JWT_SECRET));
    expect(await verifyAdminToken(token)).toBeNull();
  });
  it('rejects forged tokens', async () => {
    const token = await signAdminToken(42);
    const parts = token.split('.');
    parts[1] = Buffer.from(JSON.stringify({ sub: '1', scope: 'admin' })).toString('base64url');
    expect(await verifyAdminToken(parts.join('.'))).toBeNull();
  });
});

describe('admin request authorization', () => {
  it('denies unauthenticated requests', async () => {
    expect(await auth()).toBeNull();
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });
  it('reloads current admin permissions for a bearer token', async () => {
    mocks.headers.mockResolvedValue(new Headers({ Authorization: `Bearer ${await signAdminToken(42)}` }));
    mocks.findUnique.mockResolvedValue({ id: 42, name: 'Admin', email: 'admin@example.com', role: 'admin' });
    expect((await auth())?.user).toMatchObject({ id: '42', role: 'admin' });
    expect(mocks.webAuth).not.toHaveBeenCalled();
  });
  it.each([null, { id: 42, role: 'user' }])('denies deleted or demoted accounts: %j', async user => {
    mocks.headers.mockResolvedValue(new Headers({ Authorization: `Bearer ${await signAdminToken(42)}` }));
    mocks.findUnique.mockResolvedValue(user);
    expect(await auth()).toBeNull();
  });
  it('preserves web admin sessions, with a current database role check', async () => {
    mocks.webAuth.mockResolvedValue({ user: { id: '42', role: 'admin' } });
    mocks.findUnique.mockResolvedValue({ id: 42, role: 'admin' });
    expect(await auth()).not.toBeNull();
    mocks.findUnique.mockResolvedValue({ id: 42, role: 'user' });
    expect(await auth()).toBeNull();
  });
  it('never falls back to cookies for an invalid bearer token', async () => {
    mocks.headers.mockResolvedValue(new Headers({ Authorization: 'Bearer invalid' }));
    mocks.webAuth.mockResolvedValue({ user: { id: '42', role: 'admin' } });
    expect(await auth()).toBeNull();
    expect(mocks.webAuth).not.toHaveBeenCalled();
  });
});
