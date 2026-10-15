import { NextRequest, NextResponse } from 'next/server';
import { auth, getSessionUser } from '@/lib/auth';
import { getGroupPredictionsForMatch } from '@/lib/services/prediction-service';
import { serializeBreakdown } from '@/models/Prediction';
import { logGroupViewDenied } from '@/lib/logging/prediction-events';
import { withApiLogging } from '@/lib/logging/with-api-logging';

export const GET = withApiLogging('matches.group-predictions', async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ matchId: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { matchId } = await params;
  const { id: userId, role } = getSessionUser(session);
  const isAdmin = role === 'admin';

  const groupIdParam = req.nextUrl.searchParams.get('groupId');
  if (!groupIdParam) return NextResponse.json({ error: 'groupId is required' }, { status: 400 });
  const groupId = Number(groupIdParam);
  if (!Number.isInteger(groupId) || groupId <= 0) {
    return NextResponse.json({ error: 'Invalid groupId' }, { status: 400 });
  }

  const liveHome = req.nextUrl.searchParams.get('liveHomeScore');
  const liveAway = req.nextUrl.searchParams.get('liveAwayScore');
  const liveResult =
    liveHome !== null && liveAway !== null && Number.isInteger(Number(liveHome)) && Number.isInteger(Number(liveAway))
      ? { homeScore: Number(liveHome), awayScore: Number(liveAway) }
      : null;

  const result = await getGroupPredictionsForMatch(Number(matchId), groupId, userId, isAdmin, liveResult);
  if ('error' in result) {
    if (result.status === 403) logGroupViewDenied('web', userId, matchId, groupId, result.error);
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(
    result.entries.map(e => ({ ...e, scoringBreakdown: serializeBreakdown(e.scoringBreakdown) })),
  );
});
