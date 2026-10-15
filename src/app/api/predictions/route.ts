import { NextRequest, NextResponse } from 'next/server';
import { auth, getSessionUser } from '@/lib/auth';
import { serializeMatch } from '@/models/Match';
import { getUserPredictions, upsertPrediction } from '@/lib/services/prediction-service';
import { safeParseBody } from '@/lib/request';
import { withApiLogging } from '@/lib/logging/with-api-logging';
import { logPredictionUpsert } from '@/lib/logging/prediction-events';

export const GET = withApiLogging('predictions.get', async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: userId } = getSessionUser(session);
  const predictions = await getUserPredictions(userId);

  return NextResponse.json(predictions.map(p => ({
    ...p,
    _id: p.id.toString(),
    userId: p.userId.toString(),
    matchId: serializeMatch(p.match),
  })));
});

export const POST = withApiLogging('predictions.post', async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const loggedUserId = getSessionUser(session).id;
  const body = await safeParseBody<{ matchId?: unknown; homeScore?: unknown; awayScore?: unknown }>(req);
  if (!body) {
    logPredictionUpsert({ platform: 'web', userId: loggedUserId, outcome: 'invalid_body' });
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const { matchId, homeScore, awayScore } = body;

  if (typeof homeScore !== 'number' || typeof awayScore !== 'number' || homeScore < 0 || awayScore < 0) {
    logPredictionUpsert({ platform: 'web', userId: loggedUserId, body, outcome: 'invalid_scores' });
    return NextResponse.json({ error: 'Invalid scores' }, { status: 400 });
  }

  const { id: userId } = getSessionUser(session);
  const result = await upsertPrediction(userId, Number(matchId), homeScore, awayScore);

  if (result.error) {
    logPredictionUpsert({
      platform: 'web', userId, body,
      outcome: result.status === 404 ? 'not_found' : result.status === 409 ? 'locked' : 'invalid_scores',
      reason: result.lockReason, msToKickoff: result.msToKickoff,
    });
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  logPredictionUpsert({ platform: 'web', userId, body, outcome: 'ok' });

  return NextResponse.json({
    success: true,
    prediction: { ...result.prediction, _id: result.prediction!.id.toString() },
  });
});
