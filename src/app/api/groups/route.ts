import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Admin: returns all groups. Others: returns groups the current user belongs to.
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const isAdmin = (session.user as any).role === 'admin';

  const headers = { 'Cache-Control': 's-maxage=60, stale-while-revalidate=120' };

  if (isAdmin) {
    const allGroups = await prisma.group.findMany({
      select: { id: true, name: true, isDefault: true },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
    return NextResponse.json(
      allGroups.map(g => ({ id: g.id.toString(), name: g.name, isDefault: g.isDefault })),
      { headers },
    );
  }

  const userId = Number((session.user as any).id);
  const memberships = await prisma.groupMember.findMany({
    where: { userId },
    include: { group: { select: { id: true, name: true, isDefault: true } } },
    orderBy: { group: { isDefault: 'desc' } },
  });

  return NextResponse.json(
    memberships.map(m => ({
      id:        m.group.id.toString(),
      name:      m.group.name,
      isDefault: m.group.isDefault,
    })),
    { headers },
  );
}
