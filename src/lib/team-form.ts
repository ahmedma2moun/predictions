import { fetchTeamForm, type APIFixture } from '@/lib/football/service';
import { logger } from '@/lib/logger';

export type TeamFormMatch = {
  date: string;
  opponentName: string;
  opponentLogo: string | null;
  isHome: boolean;
  teamScore: number | null;
  opponentScore: number | null;
  penaltyTeamScore: number | null;
  penaltyOpponentScore: number | null;
  result: 'W' | 'D' | 'L' | null;
  competition: string;
  status: string;
};

// Module-level cache keyed by team externalId.
// Form is historical (yesterday's games don't change) — a 24-hour TTL is more than enough.
const cache = new Map<number, { data: TeamFormMatch[]; fetchedAt: number }>();
const TTL = 24 * 60 * 60 * 1000;

function mapFixtureForTeam(f: APIFixture, teamId: number): TeamFormMatch {
  const isHome = f.teams.home.id === teamId;
  const isPenalty = f.score.duration === 'PENALTY_SHOOTOUT';
  const penaltyHomeScore = isPenalty ? (f.score.penalties?.home ?? null) : null;
  const penaltyAwayScore = isPenalty ? (f.score.penalties?.away ?? null) : null;

  // The API adds penalty goals to fullTime — subtract to get the actual match score
  const rawHome = f.goals.home;
  const rawAway = f.goals.away;
  const homeScore = isPenalty && penaltyHomeScore !== null && rawHome !== null ? rawHome - penaltyHomeScore : rawHome;
  const awayScore = isPenalty && penaltyAwayScore !== null && rawAway !== null ? rawAway - penaltyAwayScore : rawAway;

  const teamScore = isHome ? homeScore : awayScore;
  const opponentScore = isHome ? awayScore : homeScore;
  const result: 'W' | 'D' | 'L' | null =
    teamScore === null || opponentScore === null ? null
    : teamScore > opponentScore ? 'W'
    : teamScore < opponentScore ? 'L'
    : 'D';

  return {
    date: f.fixture.date,
    opponentName: isHome ? f.teams.away.name : f.teams.home.name,
    opponentLogo: (isHome ? f.teams.away.logo : f.teams.home.logo) ?? null,
    isHome,
    teamScore,
    opponentScore,
    penaltyTeamScore: isHome ? penaltyHomeScore : penaltyAwayScore,
    penaltyOpponentScore: isHome ? penaltyAwayScore : penaltyHomeScore,
    result,
    competition: f.league.name,
    status: f.fixture.status.short,
  };
}

export async function getTeamForm(teamExtId: number, limit = 5): Promise<TeamFormMatch[]> {
  const cached = cache.get(teamExtId);
  if (cached && Date.now() - cached.fetchedAt < TTL) {
    return cached.data;
  }

  try {
    const fixtures = await fetchTeamForm(teamExtId, limit);
    const data = fixtures.map(f => mapFixtureForTeam(f, teamExtId));
    cache.set(teamExtId, { data, fetchedAt: Date.now() });
    return data;
  } catch (e) {
    logger.error('[team-form] Failed to fetch recent form:', { error: e instanceof Error ? e.message : String(e) });
    if (cached) return cached.data;
    throw e;
  }
}
