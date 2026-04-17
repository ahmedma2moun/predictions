import { NextRequest, NextResponse } from 'next/server';
import { getMobileSession } from '@/lib/mobile-auth';
import { serializeMatchForMobile } from '@/models/Match';
import { getUserPredictions, upsertPrediction } from '@/lib/services/prediction-service';

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = Number(session.id);
  const predictions = await getUserPredictions(userId);

  type RuleRow = { key?: string; ruleId?: number; ruleName: string; pointsAwarded: number; matched: boolean };

  return NextResponse.json(predictions.map(p => ({
    ...p,
    id: p.id.toString(),
    userId: p.userId.toString(),
    matchId: p.matchId.toString(),
    scoringBreakdown: ((p.scoringBreakdown as { rules?: RuleRow[] } | null)?.rules ?? null)
      ?.map(r => ({ key: r.key ?? String(r.ruleId ?? ''), name: r.ruleName, points: r.pointsAwarded, awarded: r.matched })) ?? null,
    match: serializeMatchForMobile({ ...p.match, leagueName: p.match.league?.name ?? null }),
  })));
}

export async function POST(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { matchId, homeScore, awayScore } = body;

  if (typeof homeScore !== 'number' || typeof awayScore !== 'number' || homeScore < 0 || awayScore < 0) {
    return NextResponse.json({ error: 'Invalid scores' }, { status: 400 });
  }

  const userId = Number(session.id);
  const result = await upsertPrediction(userId, Number(matchId), homeScore, awayScore);

  if (result.error) return NextResponse.json({ error: result.error }, { status: result.status });

  return NextResponse.json({
    success: true,
    prediction: { ...result.prediction, id: result.prediction!.id.toString(), userId: result.prediction!.userId.toString() },
  });
}
