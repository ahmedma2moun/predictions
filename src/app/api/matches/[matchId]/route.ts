import { NextRequest, NextResponse } from 'next/server';
import { auth, getSessionUser } from '@/lib/auth';
import { serializeMatch } from '@/models/Match';
import { getMatchById } from '@/lib/services/match-service';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ matchId: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { matchId } = await params;
  const { id: userId, role } = getSessionUser(session);
  const isAdmin = role === 'admin';

  const data = await getMatchById(Number(matchId), { userId, isAdmin });
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { match, prediction, allPredictions, homeStanding, awayStanding } = data;

  const formattedAllPredictions = allPredictions?.map(p => ({
    userId:    p.userId,
    userName:  p.userName,
    homeScore: p.homeScore,
    awayScore: p.awayScore,
    pointsAwarded: p.pointsAwarded,
    scoringBreakdown: (p.rawBreakdown as { rules?: unknown[] } | null)?.rules ?? null,
  })) ?? null;

  return NextResponse.json({
    ...serializeMatch(match),
    isAdmin,
    standings: { home: homeStanding, away: awayStanding },
    prediction,
    allPredictions: formattedAllPredictions,
  });
}
