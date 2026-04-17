import type {
  IFootballProvider,
  APILeague,
  APIFixture,
  APITeam,
  APIStandingEntry,
} from '../types';

// ── football-data.org v4 raw response shapes ─────────────────────────────────

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
  stage?: string;
  matchday?: number;
  venue?: string;
  competition: { id: number; name: string; emblem?: string };
  season: { startDate: string };
  homeTeam: { id: number; name?: string; crest?: string };
  awayTeam: { id: number; name?: string; crest?: string };
  score: {
    winner?: string | null;
    duration?: string | null;
    fullTime: { home: number | null; away: number | null };
    penalties?: { home: number | null; away: number | null } | null;
  };
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
  standings: Array<{ stage: string; type: string; table: FDStandingEntry[] }>;
}

// ── Mappers ──────────────────────────────────────────────────────────────────

function fdStatusToShort(status: string): string {
  switch (status) {
    case 'IN_PLAY':   return '1H';
    case 'PAUSED':    return 'HT';
    case 'FINISHED':  return 'FT';
    case 'POSTPONED': return 'PST';
    case 'SUSPENDED': return 'SUSP';
    case 'CANCELLED': return 'CANC';
    case 'AWARDED':   return 'AWD';
    default:          return 'NS'; // SCHEDULED, TIMED
  }
}

function mapFDMatch(m: FDMatch): APIFixture {
  return {
    fixture: {
      id: m.id,
      date: m.utcDate,
      status: { short: fdStatusToShort(m.status), long: m.status },
      stage: m.stage,
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
    goals: { home: m.score.fullTime.home, away: m.score.fullTime.away },
    score: {
      fulltime:  { home: m.score.fullTime.home, away: m.score.fullTime.away },
      penalties: m.score.penalties ?? null,
      duration:  m.score.duration ?? null,
    },
  };
}

// ── Provider implementation ──────────────────────────────────────────────────

export class FootballDataProvider implements IFootballProvider {
  private readonly baseUrl = 'https://api.football-data.org/v4';
  private readonly headers: Record<string, string>;

  constructor() {
    const key = process.env.FOOTBALL_API_KEY;
    if (!key) throw new Error('FOOTBALL_API_KEY environment variable is not set');
    this.headers = { 'X-Auth-Token': key };
  }

  private async get<T>(path: string, params?: Record<string, string | number>): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    if (params) {
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
    }
    const label = `${path}${url.search}`;
    console.log(`[football-data] GET ${label}`);
    const t0 = Date.now();
    const res = await fetch(url.toString(), { 
      headers: this.headers, 
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(15_000)
    });
    const ms = Date.now() - t0;
    if (!res.ok) {
      let body = '';
      try { body = await res.text(); } catch { /* ignore */ }
      console.error(`[football-data] ${res.status}  — ${label} (${ms}ms) body=${body}`);
      throw new Error(`football-data.org error: ${res.status} ${res.statusText}${body ? ` — ${body}` : ''}`);
    }
    console.log(`[football-data] ${res.status} OK — ${label} (${ms}ms)`);
    return res.json();
  }

  async fetchLeagues(): Promise<APILeague[]> {
    const data = await this.get<{ competitions: FDCompetition[] }>('/competitions');
    return data.competitions
      .filter(c => c.currentSeason)
      .map(c => ({
        league: { id: c.id, name: c.name, country: c.area.name, logo: c.emblem ?? '' },
        country: { name: c.area.name, flag: c.area.flag ?? '' },
        seasons: [{ year: new Date(c.currentSeason!.startDate).getFullYear(), current: true }],
      }));
  }

  async fetchTeams(leagueId: number, season: number): Promise<APITeam[]> {
    const data = await this.get<{ teams: FDTeam[] }>(`/competitions/${leagueId}/teams`, { season });
    return data.teams.map(t => ({ team: { id: t.id, name: t.name, logo: t.crest ?? '' } }));
  }

  async fetchFixtures(params: {
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
      query.dateTo   = date;
    } else {
      if (from) query.dateFrom = from;
      if (to)   query.dateTo   = to;
    }
    const data = await this.get<{ matches: FDMatch[] }>(`/competitions/${league}/matches`, query);
    return data.matches.map(mapFDMatch);
  }

  async fetchFixtureById(fixtureId: number): Promise<APIFixture | null> {
    const m = await this.get<FDMatch>(`/matches/${fixtureId}`);
    return m ? mapFDMatch(m) : null;
  }

  async fetchStandings(leagueId: number): Promise<{ season: number; standings: APIStandingEntry[] }> {
    const data = await this.get<FDStandingsResponse>(`/competitions/${leagueId}/standings`);
    const season = new Date(data.season.startDate).getFullYear();
    const table =
      data.standings.find(s => s.type === 'TOTAL')?.table ??
      data.standings[0]?.table ??
      [];
    return {
      season,
      standings: table.map(e => ({
        position:       e.position,
        teamId:         e.team.id,
        teamName:       e.team.name,
        played:         e.playedGames,
        won:            e.won,
        drawn:          e.draw,
        lost:           e.lost,
        points:         e.points,
        goalsFor:       e.goalsFor,
        goalsAgainst:   e.goalsAgainst,
        goalDifference: e.goalDifference,
        form:           e.form,
      })),
    };
  }

  async fetchHeadToHead(matchId: number, limit = 5): Promise<APIFixture[]> {
    const data = await this.get<{ matches: FDMatch[] }>(
      `/matches/${matchId}/head2head`,
    );
    return (data.matches ?? []).slice(0, limit).map(mapFDMatch);
  }
}
