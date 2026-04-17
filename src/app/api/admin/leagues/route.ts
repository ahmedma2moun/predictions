import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { fetchLeagues, type APILeague } from '@/lib/football/service';

export async function GET() {
  const session = await auth();
  if (!session || (session.user as any).role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const leagues = await prisma.league.findMany({ orderBy: { name: 'asc' } });
  return NextResponse.json(leagues.map(l => ({ ...l, _id: l.id.toString() })));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as any).role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();

  if (body.action === 'fetch') {
    const [apiLeagues, dbLeagues] = await Promise.all([
      fetchLeagues(),
      prisma.league.findMany(),
    ]);
    const activeSet = new Set(dbLeagues.map(l => l.externalId));
    const dbMap = new Map(dbLeagues.map(l => [l.externalId, l.id.toString()]));

    const result = apiLeagues.flatMap(l =>
      l.seasons.filter((s: APILeague['seasons'][number]) => s.current).map((s: APILeague['seasons'][number]) => ({
        externalId: l.league.id,
        name: l.league.name,
        country: l.country.name,
        logo: l.league.logo,
        season: s.year,
        isActive: activeSet.has(l.league.id),
        _id: dbMap.get(l.league.id) ?? null,
      }))
    );
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as any).role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { externalId, name, country, logo, season, isActive } = await req.json();

  if (isActive) {
    const doc = await prisma.league.upsert({
      where: { externalId },
      create: { externalId, name, country, logo, season, isActive: true },
      update: { name, country, logo, season, isActive: true },
    });
    return NextResponse.json({ ...doc, _id: doc.id.toString() });
  } else {
    // onDelete: Cascade on Team handles team cleanup automatically
    await prisma.league.delete({ where: { externalId } }).catch(() => null);
    return NextResponse.json({ success: true });
  }
}
