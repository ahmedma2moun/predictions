import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { serializeMatch } from '@/models/Match';

export async function GET(req: NextRequest, { params }: { params: Promise<{ matchId: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { matchId } = await params;
  const match = await prisma.match.findUnique({ where: { id: Number(matchId) } });
  if (!match) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const userId = Number((session.user as any).id);
  const prediction = await prisma.prediction.findFirst({ where: { userId, matchId: match.id } });

  return NextResponse.json({
    ...serializeMatch(match),
    prediction: prediction
      ? {
          homeScore: prediction.homeScore,
          awayScore: prediction.awayScore,
          predictedWinner: prediction.predictedWinner,
          pointsAwarded: prediction.pointsAwarded,
        }
      : null,
  });
}
