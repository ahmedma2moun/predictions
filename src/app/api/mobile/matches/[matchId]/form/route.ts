import { NextRequest, NextResponse } from 'next/server';
import { getMobileSession } from '@/lib/mobile-auth';
import { getTeamForm } from '@/lib/team-form';
import { MatchRepository } from '@/lib/repositories/match-repository';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ matchId: string }> },
) {
  const session = await getMobileSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { matchId } = await params;
  const match = await MatchRepository.findUnique({
    where: { id: Number(matchId) },
    select: { externalId: true, homeTeamExtId: true, awayTeamExtId: true },
  });
  if (!match) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!match.externalId) return NextResponse.json({ home: [], away: [] });

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
