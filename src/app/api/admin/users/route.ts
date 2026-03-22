import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { User } from '@/models/User';
import bcrypt from 'bcryptjs';

export async function GET() {
  const session = await auth();
  if (!session || (session.user as any).role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await connectDB();
  const users = await User.find({}, '-password').sort({ createdAt: -1 }).lean();
  return NextResponse.json(users.map(u => ({ ...u, _id: u._id.toString() })));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as any).role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await connectDB();
  const { name, email, password, role } = await req.json();
  if (!name || !email || !password) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) return NextResponse.json({ error: 'Email already exists' }, { status: 400 });
  const hashed = await bcrypt.hash(password, 12);
  const user = await User.create({ name, email: email.toLowerCase(), password: hashed, role: role || 'user' });
  const { password: _, ...userObj } = user.toObject();
  return NextResponse.json({ ...userObj, _id: userObj._id.toString() });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as any).role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await connectDB();
  const { id, name, role, password } = await req.json();
  const update: any = {};
  if (name) update.name = name;
  if (role) update.role = role;
  if (password) update.password = await bcrypt.hash(password, 12);
  const user = await User.findByIdAndUpdate(id, update, { new: true }).select('-password');
  return NextResponse.json({ ...user?.toObject(), _id: user?._id.toString() });
}
