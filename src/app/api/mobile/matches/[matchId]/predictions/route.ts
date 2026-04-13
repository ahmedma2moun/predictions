import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getMobileSession } from '@/lib/mobile-auth';
import { isMatchLocked } from '@/lib/utils';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ matchId: string }> },
) {
  const session = await getMobileSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { matchId } = await params;
  const match = await prisma.match.findUnique({ where: { id: Number(matchId) } });
  if (!match) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Only reveal predictions once match is locked
  if (!isMatchLocked(match.kickoffTime)) {
    return NextResponse.json({ error: 'Match not locked yet' }, { status: 403 });
  }

  const rows = await prisma.prediction.findMany({
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
    scoringBreakdown: (p.scoringBreakdown as { rules?: unknown[] } | null)?.rules ?? null,
  }));

  return NextResponse.json(result);
}
