import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { Prediction } from '@/models/Prediction';
import { User } from '@/models/User';
import { Match } from '@/models/Match';
import { Types } from 'mongoose';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await connectDB();
  const { searchParams } = new URL(req.url);
  const period = searchParams.get('period') || 'all';
  const leagueId = searchParams.get('leagueId');

  let matchFilter: any = { status: 'finished' };
  if (leagueId) matchFilter.externalLeagueId = Number(leagueId);

  const now = new Date();
  if (period === 'week') {
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    matchFilter.kickoffTime = { $gte: weekAgo };
  } else if (period === 'month') {
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    matchFilter.kickoffTime = { $gte: monthAgo };
  }

  const finishedMatches = await Match.find(matchFilter, '_id').lean();
  const matchIds = finishedMatches.map(m => m._id);

  const leaderboard = await Prediction.aggregate([
    { $match: { matchId: { $in: matchIds } } },
    { $group: {
      _id: '$userId',
      totalPoints: { $sum: '$pointsAwarded' },
      predictionsCount: { $sum: 1 },
      correctPredictions: { $sum: { $cond: [{ $gt: ['$pointsAwarded', 0] }, 1, 0] } },
    }},
    { $sort: { totalPoints: -1 } },
    { $limit: 100 },
  ]);

  const userIds = leaderboard.map(l => l._id);
  const users = await User.find({ _id: { $in: userIds } }, 'name email avatarUrl').lean();
  const userMap = new Map(users.map(u => [u._id.toString(), u]));

  const result = leaderboard.map((entry, idx) => {
    const user = userMap.get(entry._id.toString());
    return {
      rank: idx + 1,
      userId: entry._id.toString(),
      name: user?.name ?? 'Unknown',
      email: user?.email ?? '',
      avatarUrl: user?.avatarUrl,
      totalPoints: entry.totalPoints,
      predictionsCount: entry.predictionsCount,
      correctPredictions: entry.correctPredictions,
      accuracy: entry.predictionsCount > 0 ? Math.round((entry.correctPredictions / entry.predictionsCount) * 100) : 0,
    };
  });

  return NextResponse.json(result);
}
