import { NextRequest, NextResponse } from 'next/server';
import { auth, getSessionUser } from '@/lib/auth';
import { getMatchById } from '@/lib/services/match-service';
import { fetchFixtureById, mapFixtureStatus } from '@/lib/football/service';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ matchId: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { matchId } = await params;
  const { id: userId, role } = getSessionUser(session);
  const isAdmin = role === 'admin';

  const data = await getMatchById(Number(matchId), { userId, isAdmin });
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { match } = data;
  if (!match.externalId) {
    return NextResponse.json({ error: 'No external match' }, { status: 400 });
  }

  const fixture = await fetchFixtureById(match.externalId).catch(() => null);
  if (!fixture) return NextResponse.json({ error: 'Failed to fetch live data' }, { status: 502 });

  return NextResponse.json({
    status: mapFixtureStatus(fixture.fixture.status.short),
    homeScore: fixture.score.fulltime.home ?? fixture.goals.home,
    awayScore: fixture.score.fulltime.away ?? fixture.goals.away,
  });
}
