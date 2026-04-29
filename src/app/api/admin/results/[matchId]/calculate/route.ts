import { NextRequest, NextResponse } from 'next/server';
import { auth, isSessionAdmin } from '@/lib/auth';
import { MatchRepository } from '@/lib/repositories/match-repository';
import { PredictionRepository } from '@/lib/repositories/prediction-repository';
import { ScoringRuleService } from '@/lib/services/scoring-rule-service';
import { calculateScore } from '@/lib/scoring-engine';
import { updateUserStreaks } from '@/lib/services/streak-badge-service';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ matchId: string }> },
) {
  const session = await auth();
  if (!session || !isSessionAdmin(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { matchId } = await params;
  const match = await MatchRepository.findUnique({ where: { id: Number(matchId) } });
  if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });

  if (match.resultHomeScore === null || match.resultAwayScore === null) {
    return NextResponse.json({ error: 'Match has no result yet' }, { status: 400 });
  }

  const homeScore = match.resultHomeScore;
  const awayScore = match.resultAwayScore;
  const scoringWinner: 'home' | 'away' | 'draw' =
    homeScore > awayScore ? 'home' : awayScore > homeScore ? 'away' : 'draw';

  const [rules, preds] = await Promise.all([
    ScoringRuleService.getAll({ where: { isActive: true } }),
    PredictionRepository.findMany({
      where: { matchId: Number(matchId) },
      include: { user: { select: { id: true, name: true } } },
    }),
  ]);

  if (preds.length === 0) {
    return NextResponse.json({ scored: 0 });
  }

  const scored: { userId: string; userName: string; pointsAwarded: number }[] = [];

  for (const pred of preds) {
    const { totalPoints, breakdown } = calculateScore(
      { homeScore: pred.homeScore, awayScore: pred.awayScore },
      { homeScore, awayScore, winner: scoringWinner },
      rules,
    );
    await PredictionRepository.update({
      where: { id: pred.id },
      data: { pointsAwarded: totalPoints, scoringBreakdown: { rules: breakdown } },
    });
    scored.push({ userId: pred.userId.toString(), userName: pred.user.name, pointsAwarded: totalPoints });
  }

  await MatchRepository.update({ where: { id: Number(matchId) }, data: { scoresProcessed: true } });
  await updateUserStreaks(preds.map(p => p.userId));

  return NextResponse.json({ scored: scored.length, predictions: scored });
}
