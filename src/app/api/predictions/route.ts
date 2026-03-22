import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { Match } from '@/models/Match';
import { Prediction } from '@/models/Prediction';
import { getWinner } from '@/lib/utils';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await connectDB();
  const userId = (session.user as any).id;
  const predictions = await Prediction.find({ userId })
    .populate('matchId')
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  return NextResponse.json(predictions.map(p => ({
    ...p,
    _id: p._id.toString(),
    userId: p.userId.toString(),
    matchId: p.matchId,
  })));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await connectDB();
  const body = await req.json();
  const { matchId, homeScore, awayScore } = body;

  if (typeof homeScore !== 'number' || typeof awayScore !== 'number' || homeScore < 0 || awayScore < 0) {
    return NextResponse.json({ error: 'Invalid scores' }, { status: 400 });
  }

  const match = await Match.findById(matchId);
  if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });
  if (new Date() >= match.kickoffTime) {
    return NextResponse.json({ error: 'Cannot predict after match has started' }, { status: 400 });
  }

  const userId = (session.user as any).id;
  const predictedWinner = getWinner(homeScore, awayScore);

  const prediction = await Prediction.findOneAndUpdate(
    { userId, matchId },
    { userId, matchId, homeScore, awayScore, predictedWinner },
    { upsert: true, new: true }
  );

  return NextResponse.json({ success: true, prediction });
}
