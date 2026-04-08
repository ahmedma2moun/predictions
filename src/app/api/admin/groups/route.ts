import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await auth();
  if (!session || (session.user as any).role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const groups = await prisma.group.findMany({
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    include: {
      _count: { select: { members: true } },
      groupLeagues: { include: { league: { select: { id: true, name: true, country: true, logo: true } } } },
      groupTeams:   { include: { team:   { select: { id: true, name: true, logo: true } } } },
    },
  });

  return NextResponse.json(groups.map(g => ({
    _id: g.id.toString(),
    id: g.id,
    name: g.name,
    isDefault: g.isDefault,
    memberCount: g._count.members,
    leagues: g.groupLeagues.map(gl => gl.league),
    teams:   g.groupTeams.map(gt => gt.team),
    createdAt: g.createdAt,
  })));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as any).role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

  const group = await prisma.group.create({ data: { name: name.trim() } });
  return NextResponse.json({ _id: group.id.toString(), ...group });
}
