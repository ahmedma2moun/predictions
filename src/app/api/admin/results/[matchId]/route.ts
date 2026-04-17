import { NextRequest, NextResponse } from 'next/server';
import { auth, isSessionAdmin } from '@/lib/auth';
import { correctMatchResult } from '@/lib/results-processor';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ matchId: string }> },
) {
  const session = await auth();
  if (!session || !isSessionAdmin(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { matchId } = await params;
  const body = await req.json();
  const { homeScore, awayScore, penaltyHomeScore = null, penaltyAwayScore = null } = body;

  if (
    typeof homeScore !== 'number' || typeof awayScore !== 'number' ||
    homeScore < 0 || awayScore < 0 ||
    !Number.isInteger(homeScore) || !Number.isInteger(awayScore)
  ) {
    return NextResponse.json({ error: 'Invalid scores' }, { status: 400 });
  }

  try {
    const result = await correctMatchResult(
      Number(matchId),
      homeScore,
      awayScore,
      penaltyHomeScore,
      penaltyAwayScore,
    );
    return NextResponse.json(result);
  } catch (e: any) {
    if (e.message?.includes('not found')) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }
    console.error('[PATCH /api/admin/results/:id]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
