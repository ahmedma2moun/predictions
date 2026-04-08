import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Returns all groups the current user belongs to (for leaderboard selector)
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
    }))
  );
}
