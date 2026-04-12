import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { fetchHeadToHead, type APIFixture } from '@/lib/football-api';

export type H2HMatch = {
  date: string;
  homeTeam: { name: string; logo: string };
  awayTeam: { name: string; logo: string };
  homeScore: number | null;
  awayScore: number | null;
  penaltyHomeScore: number | null;
  penaltyAwayScore: number | null;
  competition: string;
  status: string;
};

// Module-level cache keyed by externalMatchId.
// H2H data is historical — a 24-hour TTL is more than enough.
const cache = new Map<number, { data: H2HMatch[]; fetchedAt: number }>();
const TTL = 24 * 60 * 60 * 1000;

function mapFixture(f: APIFixture): H2HMatch {
  const isPenalty = f.score.duration === 'PENALTY_SHOOTOUT';
  const penaltyHomeScore = isPenalty ? (f.score.penalties?.home ?? null) : null;
  const penaltyAwayScore = isPenalty ? (f.score.penalties?.away ?? null) : null;

  // The API adds penalty goals to fullTime — subtract to get the actual match score
  const rawHome = f.goals.home;
  const rawAway = f.goals.away;
  const homeScore = isPenalty && penaltyHomeScore !== null && rawHome !== null ? rawHome - penaltyHomeScore : rawHome;
  const awayScore = isPenalty && penaltyAwayScore !== null && rawAway !== null ? rawAway - penaltyAwayScore : rawAway;

  return {
    date: f.fixture.date,
    homeTeam: { name: f.teams.home.name, logo: f.teams.home.logo },
    awayTeam: { name: f.teams.away.name, logo: f.teams.away.logo },
    homeScore,
    awayScore,
    penaltyHomeScore,
    penaltyAwayScore,
    competition: f.league.name,
    status: f.fixture.status.short,
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { matchId } = await params;
  const match = await prisma.match.findUnique({
    where: { id: Number(matchId) },
    select: { externalId: true },
  });
  if (!match) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { externalId } = match;

  const cached = cache.get(externalId);
  if (cached && Date.now() - cached.fetchedAt < TTL) {
    return NextResponse.json({ matches: cached.data });
  }

  try {
    const fixtures = await fetchHeadToHead(externalId, 5);
    const data = fixtures.map(mapFixture);
    cache.set(externalId, { data, fetchedAt: Date.now() });
    return NextResponse.json({ matches: data });
  } catch (e) {
    console.error('[h2h] Failed to fetch head-to-head:', e);
    // Return stale cache as fallback rather than erroring
    if (cached) return NextResponse.json({ matches: cached.data });
    return NextResponse.json({ error: 'Failed to fetch head-to-head data' }, { status: 502 });
  }
}
