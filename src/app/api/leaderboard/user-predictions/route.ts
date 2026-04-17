import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getUserPredictionHistory } from '@/lib/services/prediction-service';

type RuleBreakdown = { ruleName: string; pointsAwarded: number; matched: boolean };

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const userId    = searchParams.get('userId');
  const leagueIds = searchParams.getAll('leagueId').map(Number).filter(Boolean);

  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

  const items = await getUserPredictionHistory({
    userId:    Number(userId),
    leagueIds,
    from:      searchParams.get('from') ?? undefined,
    to:        searchParams.get('to') ?? undefined,
  });

  return NextResponse.json(items.map(item => ({
    ...item,
    scoringBreakdown: (item.rawBreakdown as { rules?: RuleBreakdown[] } | null)?.rules ?? null,
    rawBreakdown: undefined,
  })));
}
