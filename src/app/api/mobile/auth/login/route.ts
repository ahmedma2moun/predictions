import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { signMobileJwt } from '@/lib/mobile-auth';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const email = (body?.email as string | undefined)?.toLowerCase().trim();
  const password = body?.password as string | undefined;

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
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
