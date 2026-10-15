import { NextRequest, NextResponse } from 'next/server';
import { getMobileSession } from '@/lib/mobile-auth';
import { serializeMatchForMobile } from '@/models/Match';
import { getUserPredictions, upsertPrediction } from '@/lib/services/prediction-service';
import { safeParseBody } from '@/lib/request';
import { withApiLogging } from '@/lib/logging/with-api-logging';
import { logPredictionUpsert } from '@/lib/logging/prediction-events';
import { serializeBreakdown } from '@/models/Prediction';

export const GET = withApiLogging('predictions.get', async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = Number(session.id);
  const predictions = await getUserPredictions(userId);

  return NextResponse.json(predictions.map(p => ({
    ...p,
    id: p.id.toString(),
    userId: p.userId.toString(),
    matchId: p.matchId.toString(),
    baseScore: p.baseScore,
    outcomeOdds: Number(p.outcomeOdds),
    scoringBreakdown: serializeBreakdown(p.scoringBreakdown),
    oddsBonus: (p.scoringBreakdown as { odds?: { outcomeOdds: number; baseScore: number; finalScore: number } } | null)?.odds ?? null,
    match: {
      ...serializeMatchForMobile({ ...p.match, leagueName: p.match.league?.name ?? null }),
      odds: p.match.matchOdds
        ? {
            homeWin: Number(p.match.matchOdds.homeWinOdds),
            draw:    Number(p.match.matchOdds.drawOdds),
            awayWin: Number(p.match.matchOdds.awayWinOdds),
            locked:  !!p.match.matchOdds.lockedAt,
            votes: {
              homeWin: p.match.matchOdds.homeWinVotes,
              draw:    p.match.matchOdds.drawVotes,
              awayWin: p.match.matchOdds.awayWinVotes,
            },
          }
        : null,
    },
  })));
});

export const POST = withApiLogging('predictions.post', async function POST(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const loggedUserId = Number(session.id);
  const body = await safeParseBody<{ matchId?: unknown; homeScore?: unknown; awayScore?: unknown }>(req);
  if (!body) {
    logPredictionUpsert({ platform: 'mobile', userId: loggedUserId, outcome: 'invalid_body' });
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const { matchId, homeScore, awayScore } = body;

  if (typeof homeScore !== 'number' || typeof awayScore !== 'number' || homeScore < 0 || awayScore < 0) {
    logPredictionUpsert({ platform: 'mobile', userId: loggedUserId, body, outcome: 'invalid_scores' });
    return NextResponse.json({ error: 'Invalid scores' }, { status: 400 });
  }

  const userId = Number(session.id);
  const result = await upsertPrediction(userId, Number(matchId), homeScore, awayScore);

  if (result.error) {
    logPredictionUpsert({
      platform: 'mobile', userId, body,
      outcome: result.status === 404 ? 'not_found' : result.status === 409 ? 'locked' : 'invalid_scores',
      reason: result.lockReason, msToKickoff: result.msToKickoff,
    });
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  logPredictionUpsert({ platform: 'mobile', userId, body, outcome: 'ok' });

  return NextResponse.json({
    success: true,
    prediction: { ...result.prediction, id: result.prediction!.id.toString(), userId: result.prediction!.userId.toString() },
  });
});
