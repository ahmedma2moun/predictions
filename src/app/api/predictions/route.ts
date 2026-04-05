import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { serializeMatch } from '@/models/Match';
import { getWinner } from '@/lib/utils';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = Number((session.user as any).id);
  const predictions = await prisma.prediction.findMany({
    where: { userId },
    include: { match: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return NextResponse.json(predictions.map(p => ({
    ...p,
    _id: p.id.toString(),
    userId: p.userId.toString(),
    matchId: serializeMatch(p.match),
  })));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { matchId, homeScore, awayScore } = body;

  if (typeof homeScore !== 'number' || typeof awayScore !== 'number' || homeScore < 0 || awayScore < 0) {
    return NextResponse.json({ error: 'Invalid scores' }, { status: 400 });
  }

  const match = await prisma.match.findUnique({ where: { id: Number(matchId) } });
  if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });
  if (new Date() >= match.kickoffTime) {
    return NextResponse.json({ error: 'Cannot predict after match has started' }, { status: 400 });
  }

  const userId = Number((session.user as any).id);
  const predictedWinner = getWinner(homeScore, awayScore);

  const prediction = await prisma.prediction.upsert({
    where: { userId_matchId: { userId, matchId: match.id } },
    create: { userId, matchId: match.id, homeScore, awayScore, predictedWinner },
    update: { homeScore, awayScore, predictedWinner },
  });

  return NextResponse.json({ success: true, prediction: { ...prediction, _id: prediction.id.toString() } });
}
