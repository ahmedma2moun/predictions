import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type RuleBreakdown = { ruleName: string; pointsAwarded: number; matched: boolean };

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const userId   = searchParams.get('userId');
  const fromParam = searchParams.get('from');
  const toParam   = searchParams.get('to');

  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

  const matchWhere: any = { status: 'finished' };
  if (fromParam || toParam) {
    matchWhere.kickoffTime = {};
    if (fromParam) matchWhere.kickoffTime.gte = new Date(fromParam);
    if (toParam)   matchWhere.kickoffTime.lt  = new Date(toParam);
  }

  const predictions = await prisma.prediction.findMany({
    where: { userId: Number(userId), match: matchWhere },
    include: {
      match: {
        select: {
          id: true,
          kickoffTime: true,
          homeTeamName: true,
          awayTeamName: true,
          resultHomeScore: true,
          resultAwayScore: true,
        },
      },
    },
    orderBy: { match: { kickoffTime: 'desc' } },
  });

  const result = predictions
    .filter(p => p.match.resultHomeScore !== null)
    .map(p => ({
      matchId:      p.match.id.toString(),
      kickoffTime:  p.match.kickoffTime.toISOString(),
      homeTeamName: p.match.homeTeamName,
      awayTeamName: p.match.awayTeamName,
      homeScore:    p.homeScore,
      awayScore:    p.awayScore,
      result: {
        homeScore: p.match.resultHomeScore!,
        awayScore: p.match.resultAwayScore!,
      },
      pointsAwarded:    p.pointsAwarded,
      scoringBreakdown: ((p.scoringBreakdown as { rules?: RuleBreakdown[] } | null)?.rules ?? null),
    }));

  return NextResponse.json(result);
}
