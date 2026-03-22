import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { Match } from '@/models/Match';
import { Prediction } from '@/models/Prediction';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await connectDB();
  const { searchParams } = new URL(req.url);
  const filter: any = {};

  const leagueId = searchParams.get('leagueId');
  const status = searchParams.get('status');
  const week = searchParams.get('week');

  if (leagueId) filter.externalLeagueId = Number(leagueId);
  if (status) filter.status = status;
  else filter.status = { $in: ['scheduled', 'live', 'finished'] };
  if (week) filter.weekStart = new Date(week);

  const matches = await Match.find(filter)
    .sort({ kickoffTime: 1 })
    .limit(100)
    .lean();

  // Attach user's predictions
  const userId = (session.user as any).id;
  const matchIds = matches.map(m => m._id);
  const predictions = await Prediction.find({ userId, matchId: { $in: matchIds } }).lean();
  const predMap = new Map(predictions.map(p => [p.matchId.toString(), p]));

  const result = matches.map(m => ({
    ...m,
    _id: m._id.toString(),
    leagueId: m.leagueId.toString(),
    prediction: predMap.get(m._id.toString()) ? {
      homeScore: predMap.get(m._id.toString())!.homeScore,
      awayScore: predMap.get(m._id.toString())!.awayScore,
      predictedWinner: predMap.get(m._id.toString())!.predictedWinner,
      pointsAwarded: predMap.get(m._id.toString())!.pointsAwarded,
    } : null,
  }));

  return NextResponse.json(result);
}
