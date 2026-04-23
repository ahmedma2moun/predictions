import { NextRequest, NextResponse } from 'next/server';
import { getMobileSession } from '@/lib/mobile-auth';
import { serializeMatchForMobile } from '@/models/Match';
import { getMatches } from '@/lib/services/match-service';

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const isAdmin = session.role === 'admin';
  const userId  = Number(session.id);

  const items = await getMatches(
    {
      leagueId: searchParams.get('leagueId') ? Number(searchParams.get('leagueId')) : undefined,
      status:   searchParams.get('status') ?? undefined,
      week:     searchParams.get('week') ?? undefined,
    },
    { userId, isAdmin, withStandings: true },
  );

  const result = items.map(({ match, prediction, homeStanding, awayStanding }) => ({
    ...serializeMatchForMobile({ ...match, leagueName: match.league?.name ?? null }),
    prediction,
    homeStanding: homeStanding ? { position: homeStanding.position, points: homeStanding.points, form: homeStanding.form ?? null } : null,
    awayStanding: awayStanding ? { position: awayStanding.position, points: awayStanding.points, form: awayStanding.form ?? null } : null,
  }));

  return NextResponse.json(result);
}
