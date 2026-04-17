// ── Provider-agnostic normalized types ──────────────────────────────────────

export interface APILeague {
  league: { id: number; name: string; country: string; logo: string };
  country: { name: string; flag: string };
  seasons: Array<{ year: number; current: boolean }>;
}

export interface APIFixture {
  fixture: {
    id: number;
    date: string;
    status: { short: string; long: string };
    stage?: string;
    matchday?: number;
    venue?: string;
  };
  league: { id: number; name: string; logo: string; season: number };
  teams: {
    home: { id: number; name: string; logo: string };
    away: { id: number; name: string; logo: string };
  };
  goals: { home: number | null; away: number | null };
  score: {
    fulltime: { home: number | null; away: number | null };
    penalties?: { home: number | null; away: number | null } | null;
    duration?: string | null;
  };
}

export interface APIStandingEntry {
  position: number;
  teamId: number;
  teamName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  form: string | null;
}

export interface APITeam {
  team: { id: number; name: string; logo: string };
}

// ── Provider contract ────────────────────────────────────────────────────────

export interface IFootballProvider {
  fetchLeagues(): Promise<APILeague[]>;
  fetchTeams(leagueId: number, season: number): Promise<APITeam[]>;
  fetchFixtures(params: {
    league: number;
    season: number;
    from?: string;
    to?: string;
    date?: string;
  }): Promise<APIFixture[]>;
  fetchFixtureById(fixtureId: number): Promise<APIFixture | null>;
  fetchStandings(leagueId: number): Promise<{ season: number; standings: APIStandingEntry[] }>;
  fetchHeadToHead(matchId: number, limit?: number): Promise<APIFixture[]>;
}

// ── Shared utility: normalize fixture.status.short → app status ──────────────
// All providers must map their raw status to the canonical short codes used here.

export function mapFixtureStatus(
  short: string,
): 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled' {
  if (['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE'].includes(short)) return 'live';
  if (['FT', 'AET', 'PEN'].includes(short)) return 'finished';
  if (['PST', 'SUSP', 'INT'].includes(short)) return 'postponed';
  if (['CANC', 'ABD', 'AWD', 'WO'].includes(short)) return 'cancelled';
  return 'scheduled';
}
