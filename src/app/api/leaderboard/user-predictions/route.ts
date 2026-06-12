import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getUserPredictionHistory } from '@/lib/services/prediction-service';
import { SeasonService } from '@/lib/services/season-service';

type RuleBreakdown = { ruleName: string; pointsAwarded: number; matched: boolean };
type OddsBonus = { outcomeOdds: number; baseScore: number; finalScore: number };

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const userId    = searchParams.get('userId');
  const leagueIds = searchParams.getAll('leagueId').map(Number).filter(Boolean);

  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

  // Expanded leaderboard rows only show games of the live season
  const activeSeason = await SeasonService.getActiveSeason();
  if (!activeSeason) return NextResponse.json([]);

  const items = await getUserPredictionHistory({
    userId:    Number(userId),
    leagueIds,
    from:      searchParams.get('from') ?? undefined,
    to:        searchParams.get('to') ?? undefined,
    seasonId:  activeSeason.id,
  });

  return NextResponse.json(items.map(item => {
    const breakdown = item.rawBreakdown as { rules?: RuleBreakdown[]; odds?: OddsBonus } | null;
    return {
      ...item,
      scoringBreakdown: breakdown?.rules ?? null,
      oddsBonus: breakdown?.odds ?? null,
      rawBreakdown: undefined,
    };
  }));
}
