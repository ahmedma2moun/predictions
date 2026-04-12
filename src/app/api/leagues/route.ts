import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const leagues = await prisma.league.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    select: { id: true, externalId: true, name: true, country: true, logo: true },
  });

  return NextResponse.json(
    leagues.map(l => ({ ...l, id: l.id.toString() })),
    { headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=120' } },
  );
}
