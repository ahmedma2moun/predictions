import { NextResponse } from 'next/server';
import { auth } from '@/lib/admin-auth';
import { MatchRepository } from '@/lib/repositories/match-repository';
import { serializeMatchForMobile } from '@/models/Match';
import { getStandingsMap, standingKey } from '@/lib/standings';

export async function GET() {
  if (!await auth()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const matches = await MatchRepository.findMany({
    where: { predictionsEnabled: true, status: { in: ['scheduled', 'live'] } },
    orderBy: { kickoffTime: 'asc' },
    include: { league: { select: { name: true } }, season: { select: { name: true } } },
  });
  const leagues = [...new Set(matches.map(m => m.externalLeagueId))];
  const standings = matches.length
    ? await getStandingsMap(leagues.map(externalLeagueId => ({ externalLeagueId, season: 0 })))
    : new Map();
  return NextResponse.json(matches.map(match => ({
    ...serializeMatchForMobile({ ...match, leagueName: match.league?.name ?? match.season?.name }),
    homeStanding: standings.get(standingKey(match.homeTeamExtId, match.externalLeagueId)) ?? null,
    awayStanding: standings.get(standingKey(match.awayTeamExtId, match.externalLeagueId)) ?? null,
  })));
}
