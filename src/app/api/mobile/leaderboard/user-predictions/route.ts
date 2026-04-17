import { NextRequest, NextResponse } from 'next/server';
import { getMobileSession } from '@/lib/mobile-auth';
import { getUserPredictionHistory } from '@/lib/services/prediction-service';

type RuleRow = { key?: string; ruleId?: number; ruleName: string; pointsAwarded: number; matched: boolean };

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
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
    scoringBreakdown: ((item.rawBreakdown as { rules?: RuleRow[] } | null)?.rules ?? null)
      ?.map(r => ({ key: r.key ?? String(r.ruleId ?? ''), name: r.ruleName, points: r.pointsAwarded, awarded: r.matched })) ?? null,
    rawBreakdown: undefined,
  })));
}
