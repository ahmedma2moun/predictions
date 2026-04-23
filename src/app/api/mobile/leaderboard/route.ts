import { NextRequest, NextResponse } from 'next/server';
import { getMobileSession } from '@/lib/mobile-auth';
import { getLeaderboard } from '@/lib/services/leaderboard-service';

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const leagueIds = searchParams.getAll('leagueId').map(Number).filter(Boolean);
  const groupId   = searchParams.get('groupId');
  const from      = searchParams.get('from') ?? undefined;
  const to        = searchParams.get('to') ?? undefined;

  const entries = await getLeaderboard({
    leagueIds,
    groupId: groupId ? Number(groupId) : undefined,
    from,
    to,
  });

  return NextResponse.json(
    entries.map((entry, idx) => ({
      rank: idx + 1,
      userId: entry.userId.toString(),
      name: entry.name,
      avatarUrl: entry.avatarUrl,
      totalPoints: entry.totalPoints,
      predictionsCount: entry.predictionsCount,
      accuracy: entry.accuracy,
      currentStreak: entry.currentStreak,
      badges: entry.badges,
    })),
    { headers: { 'Cache-Control': 's-maxage=30, stale-while-revalidate=60' } },
  );
}
