import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getMobileSession } from '@/lib/mobile-auth';
import { serializeMatchForMobile } from '@/models/Match';
import { getWinner } from '@/lib/utils';

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = Number(session.id);
  const predictions = await prisma.prediction.findMany({
    where: { userId },
    include: { match: { include: { league: { select: { name: true } } } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return NextResponse.json(predictions.map(p => ({
    ...p,
    id: p.id.toString(),
    userId: p.userId.toString(),
    matchId: p.matchId.toString(),
    scoringBreakdown: (p.scoringBreakdown as { rules?: unknown[] } | null)?.rules ?? null,
    match: serializeMatchForMobile({ ...p.match, leagueName: p.match.league?.name ?? null }),
  })));
}

export async function POST(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { matchId, homeScore, awayScore } = body;

  if (typeof homeScore !== 'number' || typeof awayScore !== 'number' || homeScore < 0 || awayScore < 0) {
    return NextResponse.json({ error: 'Invalid scores' }, { status: 400 });
  }

  const match = await prisma.match.findUnique({ where: { id: Number(matchId) } });
  if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });
  if (new Date() >= match.kickoffTime) {
    return NextResponse.json({ error: 'Match has already started' }, { status: 400 });
  }

  const userId = Number(session.id);
  const predictedWinner = getWinner(homeScore, awayScore);

  const prediction = await prisma.prediction.upsert({
    where: { userId_matchId: { userId, matchId: match.id } },
    create: { userId, matchId: match.id, homeScore, awayScore, predictedWinner },
    update: { homeScore, awayScore, predictedWinner },
  });

  return NextResponse.json({
    success: true,
    prediction: { ...prediction, id: prediction.id.toString(), userId: prediction.userId.toString() },
  });
}
