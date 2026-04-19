import { LeagueService } from '@/lib/services/league-service';
import { TeamService } from '@/lib/services/team-service';
import { NextRequest, NextResponse } from 'next/server';
import { auth, isSessionAdmin } from '@/lib/auth';
import { fetchLeagues, type APILeague } from '@/lib/football/service';

export async function GET() {
  const session = await auth();
  if (!session || !isSessionAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const leagues = await LeagueService.getAll({ orderBy: { name: 'asc' } });
  return NextResponse.json(leagues.map(l => ({ ...l, _id: l.id.toString() })));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || !isSessionAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();

  if (body.action === 'fetch') {
    const [apiLeagues, dbLeagues] = await Promise.all([
      fetchLeagues(),
      LeagueService.getAll(),
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
  if (!session || !isSessionAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { externalId, name, country, logo, season, isActive } = await req.json();

  if (isActive) {
    const doc = await LeagueService.upsert({
      where: { externalId },
      create: { externalId, name, country, logo, season, isActive: true },
      update: { name, country, logo, season, isActive: true },
    });
    return NextResponse.json({ ...doc, _id: doc.id.toString() });
  } else {
    const league = await LeagueService.getById({ where: { externalId } });
    if (league) {
      await TeamService.deleteOrphansForLeague(league.id);
      await LeagueService.remove({ where: { externalId } }).catch(() => null);
    }
    return NextResponse.json({ success: true });
  }
}
