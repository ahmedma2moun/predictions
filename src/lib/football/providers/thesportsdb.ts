import type {
  IFootballProvider,
  APILeague,
  APIFixture,
  APITeam,
  APIStandingEntry,
} from '../types';

// ── TheSportsDB raw response shapes ───────────────────────────────────────────
// Same data model across v1 and v2 — only the route/auth scheme differs.
// All fields are strings in TheSportsDB's JSON, including numeric ones.
// Verified against live v1 responses (real season/table/results payloads) during
// implementation; v2 route paths are confirmed live (server 400s on bad key, not 404),
// but exact v2 envelope keys couldn't be verified without a real premium key —
// getV2() below scans for the first array in the response rather than assuming a
// fixed wrapper key, so it tolerates either shape.

interface TSDBEvent {
  idEvent: string;
  strEvent: string;
  idLeague: string;
  strLeague: string;
  strSeason: string;
  idHomeTeam: string;
  idAwayTeam: string;
  strHomeTeam: string;
  strAwayTeam: string;
  strHomeTeamBadge?: string | null;
  strAwayTeamBadge?: string | null;
  intHomeScore: string | null;
  intAwayScore: string | null;
  intRound: string | null;
  dateEvent: string | null;
  strTime: string | null;
  strTimestamp: string | null;
  strStatus: string | null;
  strPostponed?: string | null;
  strVenue?: string | null;
}

interface TSDBLeague {
  idLeague: string;
  strLeague: string;
  strSport: string;
  strCountry: string;
  strBadge?: string | null;
  strCurrentSeason?: string | null;
}

interface TSDBTeam {
  idTeam: string;
  strTeam: string;
  strBadge?: string | null;
}

interface TSDBTableEntry {
  idTeam: string;
  strTeam: string;
  intRank: string;
  intPlayed: string;
  intWin: string;
  intDraw: string;
  intLoss: string;
  intPoints: string;
  intGoalsFor: string;
  intGoalsAgainst: string;
  intGoalDifference: string;
  strForm: string | null;
}

// ── Status mapping ─────────────────────────────────────────────────────────────
// TheSportsDB has no fixed short-code enum like other providers — strStatus is a
// free-text field ("Match Finished", "Postponed", "" for not-yet-started, etc.)
// and live matches surface the elapsed minute ("1H", "HT", "2H") only inconsistently.
// We normalize to the short codes mapFixtureStatus() already understands.

function toShortStatus(raw: TSDBEvent): string {
  const status = (raw.strStatus ?? '').trim();
  if (raw.strPostponed === 'yes') return 'PST';
  if (status === '' || status.toUpperCase() === 'NS') return 'NS';
  const upper = status.toUpperCase();
  if (['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE'].includes(upper)) return upper;
  if (upper.includes('FINISHED') || upper === 'FT' || upper === 'AET' || upper === 'PEN') return 'FT';
  if (upper.includes('POSTPONED')) return 'PST';
  if (upper.includes('CANCELLED') || upper.includes('CANCELED')) return 'CANC';
  if (upper.includes('SUSPENDED') || upper.includes('INTERRUPTED')) return 'SUSP';
  return 'NS';
}

// ── Mapper ─────────────────────────────────────────────────────────────────────

function mapTSDBEvent(e: TSDBEvent): APIFixture {
  const date = e.strTimestamp ?? `${e.dateEvent ?? ''}T${e.strTime ?? '00:00:00'}`;
  return {
    fixture: {
      id: Number(e.idEvent),
      date,
      status: { short: toShortStatus(e), long: e.strStatus ?? '' },
      matchday: e.intRound ? Number(e.intRound) : undefined,
      venue: e.strVenue ?? undefined,
    },
    league: {
      id: Number(e.idLeague),
      name: e.strLeague,
      logo: '',
      season: parseSeasonYear(e.strSeason),
    },
    teams: {
      home: { id: Number(e.idHomeTeam), name: e.strHomeTeam, logo: e.strHomeTeamBadge ?? '' },
      away: { id: Number(e.idAwayTeam), name: e.strAwayTeam, logo: e.strAwayTeamBadge ?? '' },
    },
    goals: {
      home: e.intHomeScore !== null ? Number(e.intHomeScore) : null,
      away: e.intAwayScore !== null ? Number(e.intAwayScore) : null,
    },
    score: {
      fulltime: {
        home: e.intHomeScore !== null ? Number(e.intHomeScore) : null,
        away: e.intAwayScore !== null ? Number(e.intAwayScore) : null,
      },
      penalties: null,
      duration: null,
    },
  };
}

function parseSeasonYear(season: string): number {
  // TheSportsDB seasons are "2024-2025" or a plain "2024" — take the first year.
  const match = season.match(/\d{4}/);
  return match ? Number(match[0]) : 0;
}

// v2 wraps results under a resource-named key whose exact spelling isn't
// confirmed (see file header) — take the first array value found instead of
// betting on one name.
function firstArray<T>(json: Record<string, unknown>): T[] {
  for (const value of Object.values(json)) {
    if (Array.isArray(value)) return value as T[];
  }
  return [];
}

// ── Provider ────────────────────────────────────────────────────────────────────

export class TheSportsDBProvider implements IFootballProvider {
  private readonly key: string;
  private readonly v1Base: string;
  private readonly v2Base = 'https://www.thesportsdb.com/api/v2/json';

  constructor() {
    const key = process.env.THESPORTSDB_API_KEY;
    if (!key) throw new Error('THESPORTSDB_API_KEY environment variable is not set');
    this.key = key;
    this.v1Base = `https://www.thesportsdb.com/api/v1/json/${key}`;
  }

  private async getV1<T extends Record<string, unknown>>(path: string, params?: Record<string, string | number>): Promise<T> {
    const url = new URL(`${this.v1Base}${path}`);
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
    return this.request<T>(url);
  }

  private async getV2<T extends Record<string, unknown>>(path: string, params?: Record<string, string | number>): Promise<T> {
    const url = new URL(`${this.v2Base}${path}`);
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
    return this.request<T>(url, { 'X-API-KEY': this.key });
  }

  private async request<T>(url: URL, headers?: Record<string, string>): Promise<T> {
    const label = `${url.pathname}${url.search}`;
    console.log(`[thesportsdb] GET ${label}`);
    const t0 = Date.now();
    const res = await fetch(url.toString(), { headers, next: { revalidate: 0 } });
    const ms = Date.now() - t0;
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`[thesportsdb] ${res.status} ${res.statusText} — ${label} (${ms}ms) body=${body}`);
      throw new Error(`thesportsdb error: ${res.status} ${res.statusText}`);
    }
    console.log(`[thesportsdb] 200 OK — ${label} (${ms}ms)`);
    return (await res.json()) as T;
  }

  // No v2 endpoint lists all leagues — stays on v1.
  async fetchLeagues(): Promise<APILeague[]> {
    const data = await this.getV1<Record<string, unknown>>('/all_leagues.php');
    const leagues = firstArray<TSDBLeague>(data);
    return leagues
      .filter(l => l.strSport === 'Soccer')
      .map(l => ({
        league: { id: Number(l.idLeague), name: l.strLeague, country: l.strCountry, logo: l.strBadge ?? '' },
        country: { name: l.strCountry, flag: '' },
        seasons: l.strCurrentSeason ? [{ year: parseSeasonYear(l.strCurrentSeason), current: true }] : [],
      }));
  }

  // v2 /list/teams/{id} takes the numeric league ID directly — no more resolving
  // a league name first like the v1-only search_all_teams.php requires.
  async fetchTeams(leagueId: number): Promise<APITeam[]> {
    const data = await this.getV2<Record<string, unknown>>(`/list/teams/${leagueId}`);
    const teams = firstArray<TSDBTeam>(data);
    return teams.map(t => ({
      team: { id: Number(t.idTeam), name: t.strTeam, logo: t.strBadge ?? '' },
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

    if (date) {
      // No v2 day-schedule endpoint documented — stays on v1.
      const data = await this.getV1<Record<string, unknown>>('/eventsday.php', { d: date, l: league });
      return firstArray<TSDBEvent>(data).map(mapTSDBEvent);
    }

    // v2 full-season schedule — no per-call truncation on a premium key.
    const seasonStr = `${season}-${season + 1}`;
    const data = await this.getV2<Record<string, unknown>>(`/schedule/league/${league}/${seasonStr}`);
    let events = firstArray<TSDBEvent>(data);
    if (from) events = events.filter(e => (e.dateEvent ?? '') >= from);
    if (to) events = events.filter(e => (e.dateEvent ?? '') <= to);
    return events.map(mapTSDBEvent);
  }

  async fetchFixtureById(fixtureId: number): Promise<APIFixture | null> {
    const data = await this.getV2<Record<string, unknown>>(`/lookup/event/${fixtureId}`);
    const event = firstArray<TSDBEvent>(data)[0];
    return event ? mapTSDBEvent(event) : null;
  }

  // No v2 standings endpoint — stays on v1.
  async fetchStandings(leagueId: number): Promise<{ season: number; standings: APIStandingEntry[] }> {
    const seasonStr = await this.currentSeasonFor(leagueId);
    const data = await this.getV1<Record<string, unknown>>('/lookuptable.php', { l: leagueId, s: seasonStr });
    const table = firstArray<TSDBTableEntry>(data);
    return {
      season: parseSeasonYear(seasonStr),
      standings: table.map(e => ({
        position: Number(e.intRank),
        teamId: Number(e.idTeam),
        teamName: e.strTeam,
        played: Number(e.intPlayed),
        won: Number(e.intWin),
        drawn: Number(e.intDraw),
        lost: Number(e.intLoss),
        points: Number(e.intPoints),
        goalsFor: Number(e.intGoalsFor),
        goalsAgainst: Number(e.intGoalsAgainst),
        goalDifference: Number(e.intGoalDifference),
        form: e.strForm ?? null,
      })),
    };
  }

  private async currentSeasonFor(leagueId: number): Promise<string> {
    const data = await this.getV1<Record<string, unknown>>('/lookupleague.php', { id: leagueId });
    const league = firstArray<TSDBLeague>(data)[0];
    return league?.strCurrentSeason ?? '';
  }

  async fetchHeadToHead(matchId: number, limit = 5): Promise<APIFixture[]> {
    // Neither API version has a team-pair H2H endpoint. Resolve the two teams from
    // the fixture, then pull the home team's recent results and keep the ones
    // played against the away team. Costs 1 + 1 extra requests vs. a native H2H call.
    const fixture = await this.fetchFixtureById(matchId);
    if (!fixture) return [];
    const { home, away } = fixture.teams;

    const data = await this.getV1<Record<string, unknown>>('/eventslast.php', { id: home.id });
    const recent = firstArray<TSDBEvent>(data);
    return recent
      .filter(e => Number(e.idHomeTeam) === away.id || Number(e.idAwayTeam) === away.id)
      .slice(0, limit)
      .map(mapTSDBEvent);
  }
}
