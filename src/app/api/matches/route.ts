import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { serializeMatch } from '@/models/Match';
import { getMatches } from '@/lib/services/match-service';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const isAdmin = (session.user as any).role === 'admin';
  const userId  = Number((session.user as any).id);

  const items = await getMatches(
    {
      leagueId: searchParams.get('leagueId') ? Number(searchParams.get('leagueId')) : undefined,
      status:   searchParams.get('status') ?? undefined,
      week:     searchParams.get('week') ?? undefined,
    },
    { userId, isAdmin, withStandings: false },
  );

  const result = items.map(({ match, prediction }) => ({
    ...serializeMatch(match),
    prediction,
  }));

  return NextResponse.json(result, {
    headers: { 'Cache-Control': 's-maxage=30, stale-while-revalidate=60' },
  });
}
