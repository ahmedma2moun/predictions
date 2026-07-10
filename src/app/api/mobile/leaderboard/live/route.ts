import { NextRequest, NextResponse } from 'next/server';
import { getMobileSession } from '@/lib/mobile-auth';
import { getLiveGroupStanding } from '@/lib/services/live-standing-service';
import { SeasonService } from '@/lib/services/season-service';

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const groupId = searchParams.get('groupId');

  const activeSeason = await SeasonService.getActiveSeason();
  if (!activeSeason) {
    return NextResponse.json(
      { hasLiveMatches: false, matches: [], standings: [] },
      { headers: { 'X-Season-Status': 'off' } },
    );
  }

  const data = await getLiveGroupStanding({
    groupId: groupId ? Number(groupId) : undefined,
    seasonId: activeSeason.id,
  });

  return NextResponse.json(
    {
      hasLiveMatches: data.hasLiveMatches,
      matches: data.matches.map(m => ({
        matchId: m.matchId.toString(),
        homeTeamName: m.homeTeamName,
        homeTeamLogo: m.homeTeamLogo,
        awayTeamName: m.awayTeamName,
        awayTeamLogo: m.awayTeamLogo,
        homeScore: m.homeScore,
        awayScore: m.awayScore,
        status: m.status,
        kickoffTime: m.kickoffTime.toISOString(),
      })),
      standings: data.standings.map(e => ({
        userId: e.userId.toString(),
        name: e.name,
        avatarUrl: e.avatarUrl,
        previousRank: e.previousRank,
        rank: e.rank,
        movement: e.movement,
        points: e.points,
        livePoints: e.livePoints,
        liveTotalPoints: e.liveTotalPoints,
      })),
    },
    { headers: {
      'Cache-Control':   's-maxage=30, stale-while-revalidate=30',
      'X-Season-Status': 'active',
      'X-Season-Id':     activeSeason.id.toString(),
    }},
  );
}
