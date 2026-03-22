const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY!;
const RAPIDAPI_HOST = 'api-football-v1.p.rapidapi.com';
const BASE_URL = `https://${RAPIDAPI_HOST}/v3`;

const headers = {
  'x-rapidapi-host': RAPIDAPI_HOST,
  'x-rapidapi-key': RAPIDAPI_KEY,
};

async function apiGet<T>(endpoint: string, params?: Record<string, string | number>): Promise<T> {
  console.log('[football-api] RAPIDAPI_KEY:', RAPIDAPI_KEY);
  const url = new URL(`${BASE_URL}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  }
  const res = await fetch(url.toString(), { headers, next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`API-Football error: ${res.status} ${res.statusText}`);
  const data = await res.json();
  if (data.errors && Object.keys(data.errors).length > 0) {
    throw new Error(`API-Football error: ${JSON.stringify(data.errors)}`);
  }
  return data;
}

export interface APILeague {
  league: { id: number; name: string; country: string; logo: string };
  country: { name: string; flag: string };
  seasons: Array<{ year: number; current: boolean }>;
}

export interface APIFixture {
  fixture: { id: number; date: string; status: { short: string; long: string } };
  league: { id: number; name: string; logo: string; season: number };
  teams: {
    home: { id: number; name: string; logo: string };
    away: { id: number; name: string; logo: string };
  };
  goals: { home: number | null; away: number | null };
  score: { fulltime: { home: number | null; away: number | null } };
}

export interface APITeam {
  team: { id: number; name: string; logo: string };
}

export async function fetchLeagues(): Promise<APILeague[]> {
  const data = await apiGet<{ response: APILeague[] }>('/leagues');
  return data.response;
}

export async function fetchTeams(leagueId: number, season: number): Promise<APITeam[]> {
  const data = await apiGet<{ response: APITeam[] }>('/teams', { league: leagueId, season });
  return data.response;
}

export async function fetchFixtures(params: {
  league: number;
  season: number;
  from?: string;
  to?: string;
  date?: string;
}): Promise<APIFixture[]> {
  const data = await apiGet<{ response: APIFixture[] }>('/fixtures', params as Record<string, string | number>);
  return data.response;
}

export async function fetchFixtureById(fixtureId: number): Promise<APIFixture | null> {
  const data = await apiGet<{ response: APIFixture[] }>('/fixtures', { id: fixtureId });
  return data.response[0] ?? null;
}

export function mapFixtureStatus(short: string): 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled' {
  if (['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE'].includes(short)) return 'live';
  if (['FT', 'AET', 'PEN'].includes(short)) return 'finished';
  if (['PST', 'SUSP', 'INT'].includes(short)) return 'postponed';
  if (['CANC', 'ABD', 'AWD', 'WO'].includes(short)) return 'cancelled';
  return 'scheduled';
}
