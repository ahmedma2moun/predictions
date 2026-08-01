import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getLeaderboard } from '@/lib/services/leaderboard-service';
import { SeasonService } from '@/lib/services/season-service';
import { parseLeaderboardQuery } from '@/lib/query-params';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { leagueIds, groupId, from, to } = parseLeaderboardQuery(req);

  const activeSeason = await SeasonService.getActiveSeason();

  // No active season → leaderboard is cleared until a new season starts
  if (!activeSeason) {
    const allSeasons = await SeasonService.getPublicSeasons();
    const lastEnded  = allSeasons.find(s => s.status === 'ENDED');
    const headers: Record<string, string> = {
      'Cache-Control':   's-maxage=30, stale-while-revalidate=60',
      'X-Season-Status': 'off',
    };
    if (lastEnded) headers['X-Last-Season-Id'] = lastEnded.id.toString();
    return NextResponse.json([], { headers });
  }

  const entries = await getLeaderboard({
    leagueIds,
    groupId,
    from,
    to,
    seasonId: activeSeason.id,
  });

  return NextResponse.json(
    entries.map((entry, idx) => ({
      rank: idx + 1,
      ...entry,
      userId: entry.userId.toString(),
    })),
    { headers: {
      'Cache-Control':   's-maxage=30, stale-while-revalidate=60',
      'X-Season-Status': 'active',
      'X-Season-Id':     activeSeason.id.toString(),
    }},
  );
}
