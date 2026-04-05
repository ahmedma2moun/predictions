import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { calculateScore } from '@/lib/scoring-engine';

export async function POST() {
  const session = await auth();
  if (!session || (session.user as any).role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const rules = await prisma.scoringRule.findMany({ where: { isActive: true } });
  const finishedMatches = await prisma.match.findMany({
    where: { status: 'finished', resultHomeScore: { not: null } },
    select: { id: true, resultHomeScore: true, resultAwayScore: true, resultWinner: true },
  });
  const matchMap = new Map(finishedMatches.map(m => [m.id, m]));
  const matchIds = finishedMatches.map(m => m.id);

  let updated = 0;
  const batchSize = 100;
  let skip = 0;

  while (true) {
    const predictions = await prisma.prediction.findMany({
      where: { matchId: { in: matchIds } },
      skip,
      take: batchSize,
    });
    if (predictions.length === 0) break;

    await prisma.$transaction(
      predictions.flatMap(pred => {
        const match = matchMap.get(pred.matchId);
        if (!match || match.resultHomeScore === null || match.resultAwayScore === null || match.resultWinner === null) return [];
        const { totalPoints, breakdown } = calculateScore(
          { homeScore: pred.homeScore, awayScore: pred.awayScore },
          {
            homeScore: match.resultHomeScore!,
            awayScore: match.resultAwayScore!,
            winner: match.resultWinner! as 'home' | 'away' | 'draw',
          },
          rules
        );
        return [
          prisma.prediction.update({
            where: { id: pred.id },
            data: { pointsAwarded: totalPoints, scoringBreakdown: { rules: breakdown } },
          }),
        ];
      })
    );

    updated += predictions.length;
    skip += batchSize;
    if (predictions.length < batchSize) break;
  }

  await prisma.match.updateMany({
    where: { status: 'finished', resultHomeScore: { not: null } },
    data: { scoresProcessed: true },
  });

  return NextResponse.json({ updated });
}
