import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getMobileSession } from '@/lib/mobile-auth';

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = Number(session.id);

  const memberships = await prisma.groupMember.findMany({
    where: { userId },
    include: { group: { select: { id: true, name: true, isDefault: true } } },
  });

  const groups = memberships.map(m => ({
    id: m.group.id.toString(),
    name: m.group.name,
    isDefault: m.group.isDefault,
  }));

  // Sort: non-default first, then default
  groups.sort((a, b) => {
    if (a.isDefault !== b.isDefault) return a.isDefault ? 1 : -1;
    return a.name.localeCompare(b.name);
  });

  return NextResponse.json(groups);
}
