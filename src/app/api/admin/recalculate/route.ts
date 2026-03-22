import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { Match } from '@/models/Match';
import { Prediction } from '@/models/Prediction';
import { ScoringRule } from '@/models/ScoringRule';
import { calculateScore } from '@/lib/scoring-engine';

export async function POST() {
  const session = await auth();
  if (!session || (session.user as any).role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await connectDB();

  const rules = await ScoringRule.find({ isActive: true }).lean();
  const finishedMatches = await Match.find({ status: 'finished', result: { $exists: true } }).lean();
  const matchMap = new Map(finishedMatches.map(m => [m._id.toString(), m]));
  const matchIds = finishedMatches.map(m => m._id);

  let updated = 0;
  const batchSize = 100;
  let skip = 0;

  while (true) {
    const predictions = await Prediction.find({ matchId: { $in: matchIds } }).skip(skip).limit(batchSize).lean();
    if (predictions.length === 0) break;

    const bulkOps = predictions.map(pred => {
      const match = matchMap.get(pred.matchId.toString());
      if (!match?.result) return null;
      const { totalPoints, breakdown } = calculateScore(
        { homeScore: pred.homeScore, awayScore: pred.awayScore },
        match.result,
        rules as any
      );
      return {
        updateOne: {
          filter: { _id: pred._id },
          update: { $set: { pointsAwarded: totalPoints, scoringBreakdown: { rules: breakdown } } },
        },
      };
    }).filter(Boolean) as any[];

    if (bulkOps.length > 0) {
      await Prediction.bulkWrite(bulkOps);
      updated += bulkOps.length;
    }
    skip += batchSize;
    if (predictions.length < batchSize) break;
  }

  // Mark all finished matches as processed
  await Match.updateMany({ status: 'finished', result: { $exists: true } }, { scoresProcessed: true });
  return NextResponse.json({ updated });
}
