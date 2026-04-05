import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function GET() {
  const session = await auth();
  if (!session || (session.user as any).role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, avatarUrl: true, createdAt: true, updatedAt: true },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(users.map(u => ({ ...u, _id: u.id.toString() })));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as any).role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { name, email, password, role } = await req.json();
  if (!name || !email || !password) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) return NextResponse.json({ error: 'Email already exists' }, { status: 400 });

  const hashed = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { name, email: email.toLowerCase(), password: hashed, role: role || 'user' },
  });
  const { password: _, ...userObj } = user;
  return NextResponse.json({ ...userObj, _id: user.id.toString() });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as any).role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id, name, role, password } = await req.json();
  const data: any = {};
  if (name) data.name = name;
  if (role) data.role = role;
  if (password) data.password = await bcrypt.hash(password, 12);

  const user = await prisma.user.update({
    where: { id: Number(id) },
    data,
    select: { id: true, name: true, email: true, role: true, avatarUrl: true, createdAt: true, updatedAt: true },
  });
  return NextResponse.json({ ...user, _id: user.id.toString() });
}
