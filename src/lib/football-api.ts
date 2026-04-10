const API_KEY = process.env.FOOTBALL_API_KEY!;
const BASE_URL = 'https://api.football-data.org/v4';

const headers = {
  'X-Auth-Token': API_KEY,
};

// ── Internal football-data.org response shapes ──────────────────────────────

interface FDCompetition {
  id: number;
  name: string;
  area: { name: string; flag?: string };
  emblem?: string;
  currentSeason?: { startDate: string; endDate: string };
}

interface FDTeam {
  id: number;
  name: string;
  crest?: string;
}

interface FDMatch {
  id: number;
  utcDate: string;
  status: string;
  matchday?: number;
  venue?: string;
  competition: { id: number; name: string; emblem?: string };
  season: { startDate: string };
  homeTeam: { id: number; name?: string; crest?: string };
  awayTeam: { id: number; name?: string; crest?: string };
  score: { fullTime: { home: number | null; away: number | null } };
}

interface FDStandingEntry {
  position: number;
  team: { id: number; name: string; crest?: string };
  playedGames: number;
  form: string | null;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
}

interface FDStandingsResponse {
  season: { startDate: string };
  standings: Array<{
    stage: string;
    type: string;
    table: FDStandingEntry[];
  }>;
}

function fdStatusToShort(status: string): string {
  switch (status) {
    case 'IN_PLAY':   return '1H';
    case 'PAUSED':    return 'HT';
    case 'FINISHED':  return 'FT';
    case 'POSTPONED': return 'PST';
    case 'SUSPENDED': return 'SUSP';
    case 'CANCELLED': return 'CANC';
    case 'AWARDED':   return 'AWD';
    default:          return 'NS';   // SCHEDULED, TIMED
  }
}

function mapFDMatch(m: FDMatch): APIFixture {
  return {
    fixture: {
      id: m.id,
      date: m.utcDate,
      status: { short: fdStatusToShort(m.status), long: m.status },
      matchday: m.matchday,
      venue: m.venue,
    },
    league: {
      id: m.competition.id,
      name: m.competition.name,
      logo: m.competition.emblem ?? '',
      season: new Date(m.season.startDate).getFullYear(),
    },
    teams: {
      home: { id: m.homeTeam.id, name: m.homeTeam.name ?? '', logo: m.homeTeam.crest ?? '' },
      away: { id: m.awayTeam.id, name: m.awayTeam.name ?? '', logo: m.awayTeam.crest ?? '' },
    },
    goals:  { home: m.score.fullTime.home, away: m.score.fullTime.away },
    score:  { fulltime: { home: m.score.fullTime.home, away: m.score.fullTime.away } },
  };
}

async function apiGet<T>(path: string, params?: Record<string, string | number>): Promise<T> {
  console.log('[football-api] FOOTBALL_API_KEY:', API_KEY);
  const url = new URL(`${BASE_URL}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  }
  const res = await fetch(url.toString(), { headers, next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`football-data.org error: ${res.status} ${res.statusText}`);
  return res.json();
}

// ── Public interfaces (unchanged — all callers stay the same) ────────────────

export interface APILeague {
  league: { id: number; name: string; country: string; logo: string };
  country: { name: string; flag: string };
  seasons: Array<{ year: number; current: boolean }>;
}

export interface APIFixture {
  fixture: { id: number; date: string; status: { short: string; long: string }; matchday?: number; venue?: string };
  league: { id: number; name: string; logo: string; season: number };
  teams: {
    home: { id: number; name: string; logo: string };
    away: { id: number; name: string; logo: string };
  };
  goals: { home: number | null; away: number | null };
  score: { fulltime: { home: number | null; away: number | null } };
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

// ── Public functions ─────────────────────────────────────────────────────────

export async function fetchLeagues(): Promise<APILeague[]> {
  const data = await apiGet<{ competitions: FDCompetition[] }>('/competitions');
  return data.competitions
    .filter(c => c.currentSeason)
    .map(c => ({
      league: { id: c.id, name: c.name, country: c.area.name, logo: c.emblem ?? '' },
      country: { name: c.area.name, flag: c.area.flag ?? '' },
      seasons: [{ year: new Date(c.currentSeason!.startDate).getFullYear(), current: true }],
    }));
}

export async function fetchTeams(leagueId: number, season: number): Promise<APITeam[]> {
  const data = await apiGet<{ teams: FDTeam[] }>(`/competitions/${leagueId}/teams`, { season });
  return data.teams.map(t => ({ team: { id: t.id, name: t.name, logo: t.crest ?? '' } }));
}

export async function fetchFixtures(params: {
  league: number;
  season: number;
  from?: string;
  to?: string;
  date?: string;
}): Promise<APIFixture[]> {
  const { league, season, from, to, date } = params;
  const query: Record<string, string | number> = { season };
  if (date) {
    query.dateFrom = date;
    query.dateTo = date;
  } else {
    if (from) query.dateFrom = from;
    if (to)   query.dateTo   = to;
  }
  const data = await apiGet<{ matches: FDMatch[] }>(`/competitions/${league}/matches`, query);
  return data.matches.map(mapFDMatch);
}

export async function fetchFixtureById(fixtureId: number): Promise<APIFixture | null> {
  const m = await apiGet<FDMatch>(`/matches/${fixtureId}`);
  return m ? mapFDMatch(m) : null;
}

export async function fetchStandings(leagueId: number): Promise<{ season: number; standings: APIStandingEntry[] }> {
  const data = await apiGet<FDStandingsResponse>(`/competitions/${leagueId}/standings`);
  const season = new Date(data.season.startDate).getFullYear();
  const table =
    data.standings.find(s => s.type === 'TOTAL')?.table ??
    data.standings[0]?.table ??
    [];
  return {
    season,
    standings: table.map(e => ({
      position: e.position,
      teamId: e.team.id,
      teamName: e.team.name,
      played: e.playedGames,
      won: e.won,
      drawn: e.draw,
      lost: e.lost,
      points: e.points,
      goalsFor: e.goalsFor,
      goalsAgainst: e.goalsAgainst,
      goalDifference: e.goalDifference,
      form: e.form,
    })),
  };
}

export function mapFixtureStatus(short: string): 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled' {
  if (['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE'].includes(short)) return 'live';
  if (['FT', 'AET', 'PEN'].includes(short)) return 'finished';
  if (['PST', 'SUSP', 'INT'].includes(short)) return 'postponed';
  if (['CANC', 'ABD', 'AWD', 'WO'].includes(short)) return 'cancelled';
  return 'scheduled';
}
