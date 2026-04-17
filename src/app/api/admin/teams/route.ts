import { TeamService } from '@/lib/services/team-service';
import { LeagueService } from '@/lib/services/league-service';
import { NextRequest, NextResponse } from 'next/server';
import { auth, isSessionAdmin } from '@/lib/auth';
import { fetchTeams, type APITeam } from '@/lib/football/service';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || !isSessionAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const leagueId = searchParams.get('leagueId');
  const where = leagueId ? { leagueId: Number(leagueId) } : {};

  const teams = await TeamService.getAll({ where, orderBy: { name: 'asc' } });
  return NextResponse.json(teams.map(t => ({ ...t, _id: t.id.toString(), leagueId: t.leagueId.toString() })));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || !isSessionAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { leagueId } = await req.json();
  const league = await LeagueService.getById({ where: { id: Number(leagueId) } });
  if (!league) return NextResponse.json({ error: 'League not found' }, { status: 404 });

  const [apiTeams, dbTeams] = await Promise.all([
    fetchTeams(league.externalId, league.season),
    TeamService.getAll({ where: { leagueId: league.id } }),
  ]);

  const activeSet = new Set(dbTeams.map(t => t.externalId));
  const dbMap = new Map(dbTeams.map(t => [t.externalId, t.id.toString()]));

  const result = apiTeams.map((t: APITeam) => ({
    externalId: t.team.id,
    name: t.team.name,
    logo: t.team.logo,
    leagueId: league.id.toString(),
    externalLeagueId: league.externalId,
    isActive: activeSet.has(t.team.id),
    _id: dbMap.get(t.team.id) ?? null,
  }));

  return NextResponse.json(result);
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session || !isSessionAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { externalId, name, logo, leagueId, externalLeagueId, isActive } = await req.json();

  if (isActive) {
    const doc = await TeamService.upsert({
      where: { externalId },
      create: { externalId, name, logo, leagueId: Number(leagueId), externalLeagueId, isActive: true },
      update: { name, logo, leagueId: Number(leagueId), externalLeagueId, isActive: true },
    });
    return NextResponse.json({ ...doc, _id: doc.id.toString(), leagueId: doc.leagueId.toString() });
  } else {
    await TeamService.remove({ where: { externalId } }).catch(() => null);
    return NextResponse.json({ success: true });
  }
}
