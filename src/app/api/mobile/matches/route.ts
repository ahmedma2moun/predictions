import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getMobileSession } from '@/lib/mobile-auth';
import { serializeMatchForMobile } from '@/models/Match';
import { MatchStatus } from '@prisma/client';

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const leagueId = searchParams.get('leagueId');
  const status   = searchParams.get('status');
  const week     = searchParams.get('week');

  const where: any = {};
  if (leagueId) where.externalLeagueId = Number(leagueId);
  if (status) {
    where.status = status as MatchStatus;
  } else {
    where.status = { in: ['scheduled', 'live', 'finished'] as MatchStatus[] };
  }
  if (week) where.weekStart = new Date(week);

  const matches = await prisma.match.findMany({
    where,
    include: { league: { select: { name: true } } },
    orderBy: { kickoffTime: 'asc' },
    take: 100,
  });

  const isAdmin = session.role === 'admin';
  const userId = Number(session.id);
  const matchIds = matches.map(m => m.id);

  const predMap = new Map<number, any>();
  if (!isAdmin && matchIds.length > 0) {
    const predictions = await prisma.prediction.findMany({
      where: { userId, matchId: { in: matchIds } },
    });
    predictions.forEach(p => predMap.set(p.matchId, p));
  }

  const result = matches.map(m => ({
    ...serializeMatchForMobile({ ...m, leagueName: m.league?.name ?? null }),
    prediction: predMap.has(m.id)
      ? {
          homeScore: predMap.get(m.id)!.homeScore,
          awayScore: predMap.get(m.id)!.awayScore,
          predictedWinner: predMap.get(m.id)!.predictedWinner,
          pointsAwarded: predMap.get(m.id)!.pointsAwarded,
        }
      : null,
  }));

  return NextResponse.json(result);
}
