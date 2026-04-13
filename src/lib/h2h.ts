import { fetchHeadToHead, type APIFixture } from '@/lib/football-api';

export type H2HMatch = {
  date: string;
  homeTeamName: string;
  homeTeamLogo: string | null;
  awayTeamName: string;
  awayTeamLogo: string | null;
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
    homeTeamName: f.teams.home.name,
    homeTeamLogo: f.teams.home.logo ?? null,
    awayTeamName: f.teams.away.name,
    awayTeamLogo: f.teams.away.logo ?? null,
    homeScore,
    awayScore,
    penaltyHomeScore,
    penaltyAwayScore,
    competition: f.league.name,
    status: f.fixture.status.short,
  };
}

export async function getH2H(externalId: number, limit = 5): Promise<H2HMatch[]> {
  const cached = cache.get(externalId);
  if (cached && Date.now() - cached.fetchedAt < TTL) {
    return cached.data;
  }

  try {
    const fixtures = await fetchHeadToHead(externalId, limit);
    const data = fixtures.map(mapFixture);
    cache.set(externalId, { data, fetchedAt: Date.now() });
    return data;
  } catch (e) {
    console.error('[h2h] Failed to fetch head-to-head:', e);
    if (cached) return cached.data;
    throw e;
  }
}
