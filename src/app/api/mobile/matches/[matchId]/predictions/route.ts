import { NextRequest, NextResponse } from 'next/server';
import { getMobileSession } from '@/lib/mobile-auth';
import { isMatchLocked } from '@/lib/utils';
import { MatchRepository } from '@/lib/repositories/match-repository';
import { PredictionRepository } from '@/lib/repositories/prediction-repository';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ matchId: string }> },
) {
  const session = await getMobileSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { matchId } = await params;
  const match = await MatchRepository.findUnique({ where: { id: Number(matchId) } });
  if (!match) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Only reveal predictions once match is locked
  if (!isMatchLocked(match.kickoffTime)) {
    return NextResponse.json({ error: 'Match not locked yet' }, { status: 403 });
  }

  const rows = await PredictionRepository.findMany({
    where: { matchId: match.id },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { pointsAwarded: 'desc' },
  });

  const result = rows.map(p => ({
    userId:    p.userId.toString(),
    userName:  p.user.name,
    homeScore: p.homeScore,
    awayScore: p.awayScore,
    pointsAwarded: p.pointsAwarded,
    scoringBreakdown: ((p.scoringBreakdown as { rules?: Array<{ key?: string; ruleId?: number; ruleName: string; pointsAwarded: number; matched: boolean }> } | null)?.rules ?? null)
      ?.map(r => ({ key: r.key ?? String(r.ruleId ?? ''), name: r.ruleName, points: r.pointsAwarded, awarded: r.matched })) ?? null,
  }));

  return NextResponse.json(result);
}
