import { NextRequest, NextResponse } from 'next/server';
import { auth, isSessionAdmin } from '@/lib/auth';
import { UserService } from '@/lib/services/user-service';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';

export async function GET() {
  const session = await auth();
  if (!session || !isSessionAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const users = await UserService.getAllUsers();
  return NextResponse.json(users.map(u => ({ ...u, _id: u.id.toString() })));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || !isSessionAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { name, email, password, role } = await req.json();
  if (!name || !email || !password) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  const exists = await UserService.checkEmailExists(email);
  if (exists) return NextResponse.json({ error: 'Email already exists' }, { status: 400 });

  const hashed = await bcrypt.hash(password, 12);
  const user = await UserService.createUser({ name, email, password: hashed, role: role || 'user' });

  const { password: _, ...userObj } = user;
  return NextResponse.json({ ...userObj, _id: user.id.toString() });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session || !isSessionAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id, name, role, password, notificationEmail } = await req.json();

  if (!id || !Number.isInteger(Number(id))) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const data: Prisma.UserUpdateInput = {};
  if (name) data.name = name;
  if (role) data.role = role;
  if (password) data.password = await bcrypt.hash(password, 12);
  if (notificationEmail !== undefined) data.notificationEmail = notificationEmail || null;

  const user = await UserService.updateUser(Number(id), data);
  return NextResponse.json({ ...user, _id: user.id.toString() });
}
