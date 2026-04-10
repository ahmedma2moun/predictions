import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { serializeMatch } from '@/models/Match';
import { isMatchLocked } from '@/lib/utils';
import { getStandingsMap } from '@/lib/standings';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ matchId: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { matchId } = await params;
  const match = await prisma.match.findUnique({ where: { id: Number(matchId) } });
  if (!match) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const userId = Number((session.user as any).id);
  const isAdmin = (session.user as any).role === 'admin';

  const [prediction, standingMap] = await Promise.all([
    isAdmin
      ? Promise.resolve(null)
      : prisma.prediction.findFirst({ where: { userId, matchId: match.id } }),
    getStandingsMap([{ externalLeagueId: match.externalLeagueId, season: 0 }]),
  ]);

  const homeStanding = standingMap.get(match.homeTeamExtId) ?? null;
  const awayStanding = standingMap.get(match.awayTeamExtId) ?? null;

  let allPredictions = null;
  if (isAdmin || isMatchLocked(match.kickoffTime)) {
    const rows = await prisma.prediction.findMany({
      where: { matchId: match.id },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { pointsAwarded: 'desc' },
    });
    allPredictions = rows.map(p => ({
      userId: p.userId,
      userName: p.user.name,
      homeScore: p.homeScore,
      awayScore: p.awayScore,
      pointsAwarded: p.pointsAwarded,
      scoringBreakdown: p.scoringBreakdown ?? null,
    }));
  }

  const standings = {
    home: homeStanding
      ? {
          position: homeStanding.position,
          played: homeStanding.played,
          won: homeStanding.won,
          drawn: homeStanding.drawn,
          lost: homeStanding.lost,
          points: homeStanding.points,
          goalDifference: homeStanding.goalDifference,
          form: homeStanding.form,
        }
      : null,
    away: awayStanding
      ? {
          position: awayStanding.position,
          played: awayStanding.played,
          won: awayStanding.won,
          drawn: awayStanding.drawn,
          lost: awayStanding.lost,
          points: awayStanding.points,
          goalDifference: awayStanding.goalDifference,
          form: awayStanding.form,
        }
      : null,
  };

  return NextResponse.json({
    ...serializeMatch(match),
    isAdmin,
    standings,
    prediction: prediction
      ? {
          homeScore: prediction.homeScore,
          awayScore: prediction.awayScore,
          predictedWinner: prediction.predictedWinner,
          pointsAwarded: prediction.pointsAwarded,
        }
      : null,
    allPredictions,
  });
}
