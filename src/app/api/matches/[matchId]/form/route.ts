import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTeamForm, type TeamFormMatch } from '@/lib/team-form';
import { MatchRepository } from '@/lib/repositories/match-repository';

// Re-export the type so existing consumers keep working
export type { TeamFormMatch };

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { matchId } = await params;
  const match = await MatchRepository.findUnique({
    where: { id: Number(matchId) },
    select: { externalId: true, homeTeamExtId: true, awayTeamExtId: true },
  });
  if (!match) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!match.externalId) return NextResponse.json({ home: null, away: null });

  try {
    const [home, away] = await Promise.all([
      getTeamForm(match.homeTeamExtId, 5),
      getTeamForm(match.awayTeamExtId, 5),
    ]);
    return NextResponse.json({ home, away });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch recent form' }, { status: 502 });
  }
}
