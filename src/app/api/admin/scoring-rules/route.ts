import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { ScoringRule } from '@/models/ScoringRule';

export async function GET() {
  const session = await auth();
  if (!session || (session.user as any).role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await connectDB();
  const rules = await ScoringRule.find().sort({ priority: 1 }).lean();
  return NextResponse.json(rules.map(r => ({ ...r, _id: r._id.toString() })));
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as any).role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await connectDB();
  const { id, points, isActive } = await req.json();
  const update: any = {};
  if (typeof points === 'number') update.points = points;
  if (typeof isActive === 'boolean') update.isActive = isActive;
  const rule = await ScoringRule.findByIdAndUpdate(id, update, { new: true });
  return NextResponse.json({ ...rule?.toObject(), _id: rule?._id.toString() });
}
