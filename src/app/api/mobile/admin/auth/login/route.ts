import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { UserService } from '@/lib/services/user-service';
import { signAdminToken } from '@/lib/admin-mobile-token';
import { safeParseBody } from '@/lib/request';
import { rateLimit } from '@/lib/rate-limit';

const limiter = rateLimit({ interval: 60_000, uniqueTokenPerInterval: 500 });

export async function POST(req: NextRequest) {
  try {
    await limiter.check(5, req.headers.get('x-forwarded-for') ?? '127.0.0.1');
  } catch {
    return NextResponse.json({ error: 'Too many attempts. Try again in a minute.' }, {
      status: 429, headers: { 'Retry-After': '60' },
    });
  }
  const body = await safeParseBody<{ email?: unknown; password?: unknown }>(req);
  if (typeof body?.email !== 'string' || typeof body.password !== 'string' ||
      !body.email.trim() || !body.password || body.email.length > 320 || body.password.length > 1024) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
  }
  const user = await UserService.getByEmail(body.email.toLowerCase().trim());
  if (!user || !(await bcrypt.compare(body.password, user.password)) || user.role !== 'admin') {
    return NextResponse.json({ error: 'Sign in with a valid admin account.' }, { status: 401 });
  }
  return NextResponse.json({
    token: await signAdminToken(user.id),
    user: { id: String(user.id), name: user.name, email: user.email, role: user.role },
  }, { headers: { 'Cache-Control': 'no-store' } });
}
