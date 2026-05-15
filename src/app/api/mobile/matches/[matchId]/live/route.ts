import { NextRequest, NextResponse } from 'next/server';
import { getMobileSession } from '@/lib/mobile-auth';
import { getMatchById } from '@/lib/services/match-service';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ matchId: string }> },
) {
  const session = await getMobileSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { matchId } = await params;
  const isAdmin = session.role === 'admin';
  const userId  = Number(session.id);

  const data = await getMatchById(Number(matchId), { userId, isAdmin });
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { match } = data;
  if (!match.externalId) {
    return NextResponse.json({ error: 'No external match' }, { status: 400 });
  }

  const apiKey = process.env.FOOTBALL_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'API key not configured' }, { status: 500 });

  const res = await fetch(`https://api.football-data.org/v4/matches/${match.externalId}`, {
    headers: { 'X-Auth-Token': apiKey },
    next: { revalidate: 0 },
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) return NextResponse.json({ error: 'Failed to fetch live data' }, { status: 502 });

  const fd = await res.json();
  return NextResponse.json({
    status: fd.status as string,
    homeScore: (fd.score?.fullTime?.home ?? null) as number | null,
    awayScore: (fd.score?.fullTime?.away ?? null) as number | null,
  });
}
