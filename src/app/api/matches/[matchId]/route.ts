import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { Match } from '@/models/Match';
import { Prediction } from '@/models/Prediction';

export async function GET(req: NextRequest, { params }: { params: Promise<{ matchId: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { matchId } = await params;
  await connectDB();
  const match = await Match.findById(matchId).lean();
  if (!match) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const userId = (session.user as any).id;
  const prediction = await Prediction.findOne({ userId, matchId: match._id }).lean();

  return NextResponse.json({
    ...match,
    _id: match._id.toString(),
    leagueId: match.leagueId.toString(),
    prediction: prediction ? {
      homeScore: prediction.homeScore,
      awayScore: prediction.awayScore,
      predictedWinner: prediction.predictedWinner,
      pointsAwarded: prediction.pointsAwarded,
    } : null,
  });
}
