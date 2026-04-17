import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { UserService } from '@/lib/services/user-service';
import { signMobileJwt } from '@/lib/mobile-auth';
import { safeParseBody } from '@/lib/request';
import { rateLimit } from '@/lib/rate-limit';

const limiter = rateLimit({
  interval: 60 * 1000, // 60 seconds
  uniqueTokenPerInterval: 500,
});

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') ?? '127.0.0.1';
    await limiter.check(5, ip);
  } catch {
    return NextResponse.json({ error: 'Too Many Requests' }, { status: 429, headers: { 'Retry-After': '60' } });
  }

  const body = await safeParseBody<any>(req);
  if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  const email = (body?.email as string | undefined)?.toLowerCase().trim();
  const password = body?.password as string | undefined;

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
  }

  const user = await UserService.getByEmail(email);
  if (!user) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const token = await signMobileJwt({
    id: user.id.toString(),
    email: user.email,
    name: user.name,
    role: user.role,
  });

  return NextResponse.json({
    token,
    user: {
      id: user.id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
}
