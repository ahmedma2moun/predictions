import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getLeaderboard } from '@/lib/services/leaderboard-service';

export async function GET(req: NextRequest) {
  const session = await auth();
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
      ...entry,
      userId: entry.userId.toString(),
    })),
    { headers: { 'Cache-Control': 's-maxage=30, stale-while-revalidate=60' } },
  );
}
