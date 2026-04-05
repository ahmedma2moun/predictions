import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await auth();
  if (!session || (session.user as any).role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const rules = await prisma.scoringRule.findMany({ orderBy: { priority: 'asc' } });
  return NextResponse.json(rules.map(r => ({ ...r, _id: r.id.toString() })));
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as any).role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id, points, isActive } = await req.json();
  const data: any = {};
  if (typeof points === 'number') data.points = points;
  if (typeof isActive === 'boolean') data.isActive = isActive;

  const rule = await prisma.scoringRule.update({ where: { id: Number(id) }, data });
  return NextResponse.json({ ...rule, _id: rule.id.toString() });
}
