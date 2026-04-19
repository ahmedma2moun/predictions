import { TeamService } from '@/lib/services/team-service';
import { LeagueService } from '@/lib/services/league-service';
import { TeamLeagueRepository } from '@/lib/repositories/team-league-repository';
import { NextRequest, NextResponse } from 'next/server';
import { auth, isSessionAdmin } from '@/lib/auth';
import { fetchTeams, type APITeam } from '@/lib/football/service';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || !isSessionAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const leagueId = searchParams.get('leagueId');
  if (!leagueId) return NextResponse.json({ error: 'leagueId required' }, { status: 400 });

  const teams = await TeamService.getByLeagueId(Number(leagueId));
  return NextResponse.json(teams.map(t => ({ ...t, _id: t.id.toString(), leagueId: t.leagueId.toString() })));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || !isSessionAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { leagueId } = await req.json();
  const league = await LeagueService.getById({ where: { id: Number(leagueId) } });
  if (!league) return NextResponse.json({ error: 'League not found' }, { status: 404 });

  const [apiTeams, existingLinks] = await Promise.all([
    fetchTeams(league.externalId, league.season),
    TeamLeagueRepository.findMany({
      where: { leagueId: league.id },
      include: { team: true },
    }),
  ]);

  const activeSet = new Set(existingLinks.filter(tl => tl.isActive).map(tl => tl.team.externalId));
  const dbMap = new Map(existingLinks.map(tl => [tl.team.externalId, tl.team.id.toString()]));

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
    const { team, teamLeague } = await TeamService.syncTeamWithLeague({
      externalId,
      name,
      logo,
      leagueId: Number(leagueId),
      externalLeagueId,
    });
    return NextResponse.json({
      ...team,
      _id: team.id.toString(),
      leagueId: teamLeague.leagueId.toString(),
      externalLeagueId: teamLeague.externalLeagueId,
      isActive: teamLeague.isActive,
    });
  } else {
    await TeamService.removeFromLeague(externalId, Number(leagueId));
    return NextResponse.json({ success: true });
  }
}
