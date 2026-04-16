import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getMobileSession } from '@/lib/mobile-auth';

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
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
