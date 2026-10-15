import { NextRequest, NextResponse } from 'next/server';
import { auth, getSessionUser } from '@/lib/auth';
import { getMatchById } from '@/lib/services/match-service';
import { fetchFixtureById, mapFixtureStatus } from '@/lib/football/service';
import { getLivePredictionPoints } from '@/lib/services/live-standing-service';
import { withApiLogging } from '@/lib/logging/with-api-logging';

export const GET = withApiLogging('matches.[matchId].live.get', async function GET(_req: NextRequest, { params }: { params: Promise<{ matchId: string }> }) {
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

  const status = mapFixtureStatus(fixture.fixture.status.short);
  const homeScore = fixture.score.fulltime.home ?? fixture.goals.home;
  const awayScore = fixture.score.fulltime.away ?? fixture.goals.away;
  const livePoints = status === 'live' || status === 'finished'
    ? await getLivePredictionPoints(data.prediction, { homeScore, awayScore }, data.odds)
    : null;

  return NextResponse.json({ status, homeScore, awayScore, livePoints, events: fixture.events });
});
