import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getMobileSession } from '@/lib/mobile-auth';
import { serializeMatchForMobile } from '@/models/Match';
import { isMatchLocked, isKnockoutStage } from '@/lib/utils';
import { getStandingsMap, standingKey } from '@/lib/standings';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ matchId: string }> },
) {
  const session = await getMobileSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { matchId } = await params;
  const match = await prisma.match.findUnique({
    where: { id: Number(matchId) },
    include: { league: { select: { name: true } } },
  });
  if (!match) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const isAdmin = session.role === 'admin';
  const userId = Number(session.id);

  const [prediction, standingMap] = await Promise.all([
    isAdmin
      ? Promise.resolve(null)
      : prisma.prediction.findFirst({ where: { userId, matchId: match.id } }),
    getStandingsMap([{ externalLeagueId: match.externalLeagueId, season: 0 }]),
  ]);

  const homeStanding = standingMap.get(standingKey(match.homeTeamExtId, match.externalLeagueId)) ?? null;
  const awayStanding = standingMap.get(standingKey(match.awayTeamExtId, match.externalLeagueId)) ?? null;

  let allPredictions = null;
  if (isAdmin || isMatchLocked(match.kickoffTime)) {
    const rows = await prisma.prediction.findMany({
      where: { matchId: match.id },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { pointsAwarded: 'desc' },
    });
    allPredictions = rows.map(p => ({
      userId:    p.userId.toString(),
      userName:  p.user.name,
      homeScore: p.homeScore,
      awayScore: p.awayScore,
      pointsAwarded: p.pointsAwarded,
      scoringBreakdown: ((p.scoringBreakdown as { rules?: Array<{ key?: string; ruleId?: number; ruleName: string; pointsAwarded: number; matched: boolean }> } | null)?.rules ?? null)
        ?.map(r => ({ key: r.key ?? String(r.ruleId ?? ''), name: r.ruleName, points: r.pointsAwarded, awarded: r.matched })) ?? null,
    }));
  }

  const base = serializeMatchForMobile({ ...match, leagueName: match.league?.name ?? null });

  return NextResponse.json({
    ...base,
    resultPenaltyHomeScore: match.resultPenaltyHomeScore ?? null,
    resultPenaltyAwayScore: match.resultPenaltyAwayScore ?? null,
    isAdmin,
    isKnockout: isKnockoutStage(match.stage),
    homeStanding: homeStanding
      ? {
          position:       homeStanding.position,
          played:         homeStanding.played,
          won:            homeStanding.won,
          drawn:          homeStanding.drawn,
          lost:           homeStanding.lost,
          points:         homeStanding.points,
          goalDifference: homeStanding.goalDifference,
          form:           homeStanding.form,
        }
      : null,
    awayStanding: awayStanding
      ? {
          position:       awayStanding.position,
          played:         awayStanding.played,
          won:            awayStanding.won,
          drawn:          awayStanding.drawn,
          lost:           awayStanding.lost,
          points:         awayStanding.points,
          goalDifference: awayStanding.goalDifference,
          form:           awayStanding.form,
        }
      : null,
    prediction: prediction
      ? {
          homeScore:       prediction.homeScore,
          awayScore:       prediction.awayScore,
          predictedWinner: prediction.predictedWinner,
          pointsAwarded:   prediction.pointsAwarded,
        }
      : null,
    allPredictions,
  });
}
