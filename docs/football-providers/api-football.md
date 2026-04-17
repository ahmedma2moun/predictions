# API-Football (api-sports.io) v3 — Provider Guide

**Status: Ready to activate**  
**Env var:** `FOOTBALL_PROVIDER=api-football`  
**Key env var:** `API_FOOTBALL_KEY`  
**Implementation path:** `src/lib/football/providers/api-football.ts`

> This was the original provider before this project migrated to football-data.org.  
> The main free-tier constraint is **100 requests/day** — plan accordingly.

---

## 1. Registration

### Option A — Direct (api-sports.io)

1. Go to **https://dashboard.api-football.com/register**
2. Sign up with email — no credit card required
3. After confirming email, go to **Dashboard → My Access**
4. Copy your **API Key**
5. Add it to `.env.local`:
   ```env
   API_FOOTBALL_KEY=your_key_here
   ```
6. Use base URL: `https://v3.football.api-sports.io`  
   Auth header: `x-apisports-key: <key>`

### Option B — Via RapidAPI

1. Go to **https://rapidapi.com/api-sports/api/api-football**
2. Sign up / log in to RapidAPI
3. Subscribe to the **Basic (Free)** plan
4. Copy the **X-RapidAPI-Key** from the "Code Snippets" panel
5. Add it to `.env.local`:
   ```env
   API_FOOTBALL_KEY=your_rapidapi_key_here
   ```
6. Change the base URL to `https://api-football-v1.p.rapidapi.com/v3` and add the extra header:
   ```
   x-rapidapi-host: api-football-v1.p.rapidapi.com
   ```

**Recommendation:** Use the direct api-sports.io route — simpler headers, same data.

---

## 2. Free Tier Limits

| Constraint | Value |
|---|---|
| Requests/day | **100** |
| Requests/minute | 30 |
| Competitions | 1,000+ leagues worldwide |
| Live data | Yes (updates every ~15 seconds) |
| Historical data | Current + recent seasons |

### Budget planning

With 100 req/day and typical cron usage:

| Operation | Requests per run |
|---|---|
| Friday `fetch-matches` cron (5 active leagues) | 5 |
| Daily `fetch-results` cron (5 active leagues) | 5 |
| Admin "Fetch Results" manual trigger | 5 |
| H2H lookup (1 extra call per match to resolve team IDs) | +1 per match |

With 5 active leagues, the two daily crons alone consume 10 requests. Budget 50–70 req/day for normal operation, leaving 30–50 for admin actions and spikes.

---

## 3. Endpoint Mapping

| `IFootballProvider` method | API-Football endpoint |
|---|---|
| `fetchLeagues()` | `GET /leagues?current=true` |
| `fetchTeams(leagueId, season)` | `GET /teams?league={leagueId}&season={year}` |
| `fetchFixtures({league, season, from, to})` | `GET /fixtures?league={league}&season={season}&from={from}&to={to}` |
| `fetchFixtureById(id)` | `GET /fixtures?id={id}` |
| `fetchStandings(leagueId)` | `GET /standings?league={leagueId}` (uses current season) |
| `fetchHeadToHead(matchId, limit)` | `GET /fixtures?id={matchId}` → extract team IDs → `GET /fixtures/headtohead?h2h={homeId}-{awayId}&last={limit}` |

**H2H:** Requires two API calls — first resolves team IDs from the fixture, then calls the H2H endpoint. This costs 2 requests instead of 1 per H2H lookup.

All responses are wrapped: `{ response: [...], errors: {} }`.

---

## 4. Status Code Mapping

API-Football short codes match the `mapFixtureStatus()` expected values directly — no translation needed.

| API-Football `status.short` | `mapFixtureStatus()` result |
|---|---|
| `NS`, `TBD` | `scheduled` |
| `1H`, `2H`, `HT`, `ET`, `BT`, `P`, `LIVE` | `live` |
| `FT`, `AET`, `PEN` | `finished` |
| `PST`, `SUSP`, `INT` | `postponed` |
| `CANC`, `ABD`, `AWD`, `WO` | `cancelled` |

---

## 5. Implementation

Create `src/lib/football/providers/api-football.ts`:

```typescript
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
      id:       f.fixture.id,
      date:     f.fixture.date,
      status:   { short: f.fixture.status.short, long: f.fixture.status.long },
      venue:    f.fixture.venue?.name ?? undefined,
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
    // API-Football H2H is by team pair — resolve team IDs from the fixture first (costs 1 extra request)
    const fixture = await this.fetchFixtureById(matchId);
    if (!fixture) return [];
    const h2h = `${fixture.teams.home.id}-${fixture.teams.away.id}`;
    const data = await this.get<AFFixture[]>('/fixtures/headtohead', { h2h, last: limit });
    return data.response.map(mapAFFixture);
  }
}
```

---

## 6. Activation

### Step 1 — Register the provider in `factory.ts`

Open `src/lib/football/factory.ts` and add the import and case:

```typescript
import { FootballDataProvider } from './providers/football-data';
import { ApiFootballProvider } from './providers/api-football'; // add this

export function getFootballProvider(): IFootballProvider {
  if (_instance) return _instance;
  const name = process.env.FOOTBALL_PROVIDER ?? 'football-data';
  switch (name) {
    case 'football-data':
      _instance = new FootballDataProvider();
      break;
    case 'api-football':                       // add this case
      _instance = new ApiFootballProvider();
      break;
    default:
      throw new Error(
        `Unknown FOOTBALL_PROVIDER: "${name}". Supported values: "football-data", "api-football"`,
      );
  }
  return _instance;
}
```

### Step 2 — Set environment variables

`.env.local`:
```env
FOOTBALL_PROVIDER=api-football
API_FOOTBALL_KEY=your_key_here
```

Vercel: **Settings → Environment Variables** — add both `FOOTBALL_PROVIDER` and `API_FOOTBALL_KEY`.

### Step 3 — Remove old key (optional)

`FOOTBALL_API_KEY` is no longer read when `FOOTBALL_PROVIDER=api-football`. You can remove it from Vercel to avoid confusion, or leave it harmless.
