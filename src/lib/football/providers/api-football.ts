import type {
  IFootballProvider,
  APILeague,
  APIFixture,
  APITeam,
  APIStandingEntry,
} from '../types';

// ── API-Football v3 raw response shapes ──────────────────────────────────────

interface AFFixture {
  fixture: {
    id: number;
    date: string;
    status: { short: string; long: string };
    venue: { name: string | null; city: string | null } | null;
  };
  league: { id: number; name: string; logo: string; season: number };
  teams: {
    home: { id: number; name: string; logo: string };
    away: { id: number; name: string; logo: string };
  };
  goals: { home: number | null; away: number | null };
  score: {
    fulltime: { home: number | null; away: number | null };
    extratime: { home: number | null; away: number | null } | null;
    penalty: { home: number | null; away: number | null } | null;
  };
}

interface AFLeague {
  league: { id: number; name: string; logo: string };
  country: { name: string; flag: string | null };
  seasons: Array<{ year: number; current: boolean }>;
}

interface AFTeam {
  team: { id: number; name: string; logo: string };
}

interface AFStanding {
  rank: number;
  team: { id: number; name: string; logo: string };
  all: {
    played: number;
    win: number;
    draw: number;
    lose: number;
    goals: { for: number; against: number };
  };
  goalsDiff: number;
  points: number;
  form: string | null;
}

interface AFResponse<T> {
  response: T;
  errors: Record<string, string>;
}

// ── Mapper ────────────────────────────────────────────────────────────────────

function mapAFFixture(f: AFFixture): APIFixture {
  const penHome = f.score.penalty?.home ?? null;
  const penAway = f.score.penalty?.away ?? null;
  const isPenalty = penHome !== null && penAway !== null;
  return {
    fixture: {
      id:     f.fixture.id,
      date:   f.fixture.date,
      status: { short: f.fixture.status.short, long: f.fixture.status.long },
      venue:  f.fixture.venue?.name ?? undefined,
    },
    league: {
      id:     f.league.id,
      name:   f.league.name,
      logo:   f.league.logo,
      season: f.league.season,
    },
    teams: {
      home: { id: f.teams.home.id, name: f.teams.home.name, logo: f.teams.home.logo },
      away: { id: f.teams.away.id, name: f.teams.away.name, logo: f.teams.away.logo },
    },
    goals: { home: f.goals.home, away: f.goals.away },
    score: {
      fulltime:  { home: f.score.fulltime.home, away: f.score.fulltime.away },
      penalties: isPenalty ? { home: penHome, away: penAway } : null,
      duration:  isPenalty ? 'PENALTY_SHOOTOUT' : null,
    },
  };
}

// ── Provider ──────────────────────────────────────────────────────────────────

export class ApiFootballProvider implements IFootballProvider {
  private readonly baseUrl = 'https://v3.football.api-sports.io';
  private readonly headers: Record<string, string>;

  constructor() {
    const key = process.env.API_FOOTBALL_KEY;
    if (!key) throw new Error('API_FOOTBALL_KEY environment variable is not set');
    this.headers = { 'x-apisports-key': key };
  }

  private async get<T>(
    path: string,
    params?: Record<string, string | number>,
  ): Promise<AFResponse<T>> {
    const url = new URL(`${this.baseUrl}${path}`);
    if (params) {
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
    }
    const label = `${path}${url.search}`;
    console.log(`[api-football] GET ${label}`);
    const t0 = Date.now();
    const res = await fetch(url.toString(), { headers: this.headers, next: { revalidate: 0 } });
    const ms = Date.now() - t0;
    if (!res.ok) {
      console.error(`[api-football] ${res.status} ${res.statusText} — ${label} (${ms}ms)`);
      throw new Error(`api-football error: ${res.status} ${res.statusText}`);
    }
    const json: AFResponse<T> = await res.json();
    if (json.errors && Object.keys(json.errors).length > 0) {
      console.error(`[api-football] API errors — ${label}:`, json.errors);
      throw new Error(`api-football error: ${JSON.stringify(json.errors)}`);
    }
    console.log(`[api-football] 200 OK — ${label} (${ms}ms)`);
    return json;
  }

  async fetchLeagues(): Promise<APILeague[]> {
    const data = await this.get<AFLeague[]>('/leagues', { current: 'true' });
    return data.response.map(l => ({
      league:  { id: l.league.id, name: l.league.name, country: '', logo: l.league.logo },
      country: { name: l.country.name, flag: l.country.flag ?? '' },
      seasons: l.seasons,
    }));
  }

  async fetchTeams(leagueId: number, season: number): Promise<APITeam[]> {
    const data = await this.get<AFTeam[]>('/teams', { league: leagueId, season });
    return data.response.map(t => ({
      team: { id: t.team.id, name: t.team.name, logo: t.team.logo },
    }));
  }

  async fetchFixtures(params: {
    league: number;
    season: number;
    from?: string;
    to?: string;
    date?: string;
  }): Promise<APIFixture[]> {
    const { league, season, from, to, date } = params;
    const query: Record<string, string | number> = { league, season };
    if (date) {
      query.date = date;
    } else {
      if (from) query.from = from;
      if (to)   query.to   = to;
    }
    const data = await this.get<AFFixture[]>('/fixtures', query);
    return data.response.map(mapAFFixture);
  }

  async fetchFixtureById(fixtureId: number): Promise<APIFixture | null> {
    const data = await this.get<AFFixture[]>('/fixtures', { id: fixtureId });
    const f = data.response[0];
    return f ? mapAFFixture(f) : null;
  }

  async fetchStandings(leagueId: number): Promise<{ season: number; standings: APIStandingEntry[] }> {
    const data = await this.get<
      Array<{ league: { id: number; season: number; standings: AFStanding[][] } }>
    >('/standings', { league: leagueId });
    const league = data.response[0]?.league;
    if (!league) return { season: 0, standings: [] };
    const table = league.standings[0] ?? [];
    return {
      season: league.season,
      standings: table.map(e => ({
        position:       e.rank,
        teamId:         e.team.id,
        teamName:       e.team.name,
        played:         e.all.played,
        won:            e.all.win,
        drawn:          e.all.draw,
        lost:           e.all.lose,
        points:         e.points,
        goalsFor:       e.all.goals.for,
        goalsAgainst:   e.all.goals.against,
        goalDifference: e.goalsDiff,
        form:           e.form,
      })),
    };
  }

  async fetchHeadToHead(matchId: number, limit = 5): Promise<APIFixture[]> {
    // Resolve team IDs from the fixture first (costs 1 extra request)
    const fixture = await this.fetchFixtureById(matchId);
    if (!fixture) return [];
    const h2h = `${fixture.teams.home.id}-${fixture.teams.away.id}`;
    const data = await this.get<AFFixture[]>('/fixtures/headtohead', { h2h, last: limit });
    return data.response.map(mapAFFixture);
  }
}
