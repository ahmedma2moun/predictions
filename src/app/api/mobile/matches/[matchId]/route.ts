import { NextRequest, NextResponse } from 'next/server';
import { getMobileSession } from '@/lib/mobile-auth';
import { serializeMatchForMobile } from '@/models/Match';
import { isKnockoutStage } from '@/lib/utils';
import { correctMatchResult } from '@/lib/results-processor';
import { getMatchById } from '@/lib/services/match-service';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ matchId: string }> },
) {
  const session = await getMobileSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { matchId } = await params;
  const isAdmin = session.role === 'admin';
  const userId  = Number(session.id);

  const data = await getMatchById(Number(matchId), { userId, isAdmin });
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { match, prediction, allPredictions, homeStanding, awayStanding } = data;

  type RuleRow = { key?: string; ruleId?: number; ruleName: string; pointsAwarded: number; matched: boolean };

  const formattedAllPredictions = allPredictions?.map(p => ({
    userId:    p.userId.toString(),
    userName:  p.userName,
    homeScore: p.homeScore,
    awayScore: p.awayScore,
    pointsAwarded: p.pointsAwarded,
    scoringBreakdown: ((p.rawBreakdown as { rules?: RuleRow[] } | null)?.rules ?? null)
      ?.map(r => ({ key: r.key ?? String(r.ruleId ?? ''), name: r.ruleName, points: r.pointsAwarded, awarded: r.matched })) ?? null,
  })) ?? null;

  const base = serializeMatchForMobile({ ...match, leagueName: match.league?.name ?? null });

  return NextResponse.json({
    ...base,
    resultPenaltyHomeScore: match.resultPenaltyHomeScore ?? null,
    resultPenaltyAwayScore: match.resultPenaltyAwayScore ?? null,
    isAdmin,
    isKnockout: isKnockoutStage(match.stage),
    homeStanding,
    awayStanding,
    prediction,
    allPredictions: formattedAllPredictions,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ matchId: string }> },
) {
  const session = await getMobileSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { matchId } = await params;
  const body = await req.json();
  const { homeScore, awayScore, penaltyHomeScore = null, penaltyAwayScore = null } = body;

  if (
    typeof homeScore !== 'number' || typeof awayScore !== 'number' ||
    homeScore < 0 || awayScore < 0 ||
    !Number.isInteger(homeScore) || !Number.isInteger(awayScore)
  ) {
    return NextResponse.json({ error: 'Invalid scores' }, { status: 400 });
  }

  try {
    const result = await correctMatchResult(Number(matchId), homeScore, awayScore, penaltyHomeScore, penaltyAwayScore);
    return NextResponse.json(result);
  } catch (e: any) {
    if (e.message?.includes('not found')) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }
    console.error('[PATCH /api/mobile/matches/:id]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
