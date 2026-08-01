import { NextRequest, NextResponse } from 'next/server';
import { getMobileSession } from '@/lib/mobile-auth';
import { getLeaderboard } from '@/lib/services/leaderboard-service';
import { SeasonService } from '@/lib/services/season-service';
import { parseLeaderboardQuery } from '@/lib/query-params';

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { leagueIds, groupId, from, to } = parseLeaderboardQuery(req);

  const activeSeason = await SeasonService.getActiveSeason();

  if (!activeSeason) {
    return NextResponse.json([], {
      headers: { 'Cache-Control': 's-maxage=30, stale-while-revalidate=60', 'X-Season-Status': 'off' },
    });
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
      userId: entry.userId.toString(),
      name: entry.name,
      avatarUrl: entry.avatarUrl,
      totalPoints: entry.totalPoints,
      championBonusPoints: entry.championBonusPoints,
      predictionsCount: entry.predictionsCount,
      accuracy: entry.accuracy,
      currentStreak: entry.currentStreak,
      longestStreak: entry.longestStreak,
      badges: entry.badges,
      exactScoreCount: entry.exactScoreCount,
      isGroupChampion: entry.isGroupChampion,
    })),
    { headers: {
      'Cache-Control':   's-maxage=30, stale-while-revalidate=60',
      'X-Season-Status': 'active',
      'X-Season-Id':     activeSeason.id.toString(),
    }},
  );
}
