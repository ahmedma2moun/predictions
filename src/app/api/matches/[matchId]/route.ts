import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { serializeMatch } from '@/models/Match';
import { isMatchLocked } from '@/lib/utils';

export async function GET(req: NextRequest, { params }: { params: Promise<{ matchId: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { matchId } = await params;
  const match = await prisma.match.findUnique({ where: { id: Number(matchId) } });
  if (!match) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const userId = Number((session.user as any).id);
  const isAdmin = (session.user as any).role === 'admin';

  const prediction = isAdmin
    ? null
    : await prisma.prediction.findFirst({ where: { userId, matchId: match.id } });

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
    }));
  }

  return NextResponse.json({
    ...serializeMatch(match),
    isAdmin,
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
