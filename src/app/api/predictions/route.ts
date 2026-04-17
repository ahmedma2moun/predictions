import { NextRequest, NextResponse } from 'next/server';
import { auth, getSessionUser } from '@/lib/auth';
import { serializeMatch } from '@/models/Match';
import { getUserPredictions, upsertPrediction } from '@/lib/services/prediction-service';

export async function GET() {
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
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { matchId, homeScore, awayScore } = body;

  if (typeof homeScore !== 'number' || typeof awayScore !== 'number' || homeScore < 0 || awayScore < 0) {
    return NextResponse.json({ error: 'Invalid scores' }, { status: 400 });
  }

  const { id: userId } = getSessionUser(session);
  const result = await upsertPrediction(userId, Number(matchId), homeScore, awayScore);

  if (result.error) return NextResponse.json({ error: result.error }, { status: result.status });

  return NextResponse.json({
    success: true,
    prediction: { ...result.prediction, _id: result.prediction!.id.toString() },
  });
}
