import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getH2H, type H2HMatch } from '@/lib/h2h';
import { MatchRepository } from '@/lib/repositories/match-repository';

// Re-export the type so existing consumers keep working
export type { H2HMatch };

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { matchId } = await params;
  const match = await MatchRepository.findUnique({
    where: { id: Number(matchId) },
    select: { externalId: true },
  });
  if (!match) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    const data = await getH2H(match.externalId, 5);
    // Re-shape to the nested homeTeam/awayTeam format the web frontend expects
    const matches = data.map(m => ({
      date: m.date,
      homeTeam: { name: m.homeTeamName, logo: m.homeTeamLogo ?? '' },
      awayTeam: { name: m.awayTeamName, logo: m.awayTeamLogo ?? '' },
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      penaltyHomeScore: m.penaltyHomeScore,
      penaltyAwayScore: m.penaltyAwayScore,
      competition: m.competition,
      status: m.status,
    }));
    return NextResponse.json({ matches });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch head-to-head data' }, { status: 502 });
  }
}
