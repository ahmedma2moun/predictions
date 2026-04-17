# AllSportsAPI — Provider Guide

**Status: Ready to activate**  
**Env var:** `FOOTBALL_PROVIDER=allsports`  
**Key env var:** `ALLSPORTS_API_KEY`  
**Implementation path:** `src/lib/football/providers/allsports.ts`

---

## 1. Registration

1. Go to **https://allsportsapi.com**
2. Click **Get Free API Key**
3. Sign up with email — no credit card required
4. After email confirmation, log in to the **Dashboard**
5. Your API key is shown on the dashboard home page
6. Add to `.env.local`:
   ```env
   ALLSPORTS_API_KEY=your_key_here
   ```
7. Add the same value to Vercel: **Settings → Environment Variables → `ALLSPORTS_API_KEY`**

---

## 2. Free Tier Limits

| Constraint | Value |
|---|---|
| Requests/day | **100** |
| Rate/minute | Not documented (be conservative) |
| Competitions | 400+ leagues worldwide |
| Live data | Yes |
| Historical data | Yes |

### Budget planning

Same constraint as API-Football — 100 req/day. With 5 active leagues:
- Friday `fetch-matches` cron: 5 requests
- Daily `fetch-results` cron: 5 requests
- H2H lookups: +1 per match (team ID resolution)

Normal cron-only operation consumes ~10 req/day. Leave headroom for admin actions.

---

## 3. Endpoint Mapping

All AllSportsAPI requests use a single base URL with `?met=` to select the operation. The API key is passed as `?APIkey=`.

| `IFootballProvider` method | AllSportsAPI call |
|---|---|
| `fetchLeagues()` | `GET /?met=Leagues&APIkey={key}` |
| `fetchTeams(leagueId, season)` | `GET /?met=Teams&leagueId={leagueId}&APIkey={key}` |
| `fetchFixtures({league, season, from, to})` | `GET /?met=Fixtures&leagueId={league}&from={from}&to={to}&APIkey={key}` |
| `fetchFixtureById(id)` | `GET /?met=Fixtures&matchId={id}&APIkey={key}` |
| `fetchStandings(leagueId)` | `GET /?met=Standings&leagueId={leagueId}&APIkey={key}` |
| `fetchHeadToHead(matchId, limit)` | Resolve team IDs via `fetchFixtureById` → `GET /?met=H2H&firstTeamId={id}&secondTeamId={id}&APIkey={key}` |

All responses are wrapped: `{ success: 1, result: [...] }`.

**H2H:** Requires two API calls — first resolves team IDs from the fixture, then calls H2H by team pair.

---

## 4. Status Code Mapping

AllSportsAPI uses verbose string statuses in the `event_status` field:

| AllSportsAPI `event_status` | Short code | `mapFixtureStatus()` result |
|---|---|---|
| `Not Started` | `NS` | `scheduled` |
| `1st Half` | `1H` | `live` |
| `Half Time` | `HT` | `live` |
| `2nd Half` | `2H` | `live` |
| `Extra Time` | `ET` | `live` |
| `Penalties` | `P` | `live` |
| `Finished` | `FT` | `finished` |
| `After Extra Time` | `AET` | `finished` |
| `After Penalties` | `PEN` | `finished` |
| `Postponed` | `PST` | `postponed` |
| `Suspended` | `SUSP` | `postponed` |
| `Interrupted` | `INT` | `postponed` |
| `Cancelled` | `CANC` | `cancelled` |
| `Abandoned` | `ABD` | `cancelled` |
| `"{minute}"` (e.g. `"67"`) | `LIVE` | `live` |

When the match is live, `event_status` may be set to a minute string like `"67"` instead of `"1st Half"`. The mapper handles this with a numeric check.

---

## 5. Implementation

Create `src/lib/football/providers/allsports.ts`:

```typescript
import type {
  IFootballProvider,
  APILeague,
  APIFixture,
  APITeam,
  APIStandingEntry,
} from '../types';

// ── AllSportsAPI raw response shapes ─────────────────────────────────────────

interface ASResponse<T> {
  success: number;
  result: T;
}

interface ASLeague {
  league_key: number;
  league_name: string;
  country_key: number;
  country_name: string;
  league_logo: string | null;
  country_logo: string | null;
  league_season: string;
}

interface ASTeam {
  team_key: number;
  team_name: string;
  team_badge: string | null;
}

interface ASFixture {
  event_key: number;
  event_date: string;   // "2024-10-05"
  event_time: string;   // "14:00"
  event_home_team: string;
  home_team_key: number;
  event_away_team: string;
  away_team_key: number;
  event_final_result: string | null;   // "2 - 1" or "-" or null
  event_status: string;                // "Finished", "Not Started", "67", etc.
  event_stadium: string | null;
  home_team_logo: string | null;
  away_team_logo: string | null;
  league_name: string;
  league_key: number;
  league_round: string | null;
  event_home_final_result: string | null;
  event_away_final_result: string | null;
  event_penalty: string | null;        // "3 - 4" if penalties
}

interface ASStanding {
  standing_place: string;
  team_id: string;
  team_name: string;
  standing_PG: string;   // played
  standing_W: string;
  standing_D: string;
  standing_L: string;
  standing_GF: string;
  standing_GA: string;
  standing_GD: string;
  team_badge: string | null;
  standing_PTS: string;
  standing_P: string | null; // form
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function asStatusToShort(status: string): string {
  if (!status) return 'NS';
  // Live minute (e.g. "45", "67+2")
  if (/^\d+(\+\d+)?$/.test(status.trim())) return 'LIVE';
  switch (status.trim()) {
    case 'Not Started':        return 'NS';
    case '1st Half':           return '1H';
    case 'Half Time':          return 'HT';
    case '2nd Half':           return '2H';
    case 'Extra Time':         return 'ET';
    case 'Penalties':          return 'P';
    case 'Finished':           return 'FT';
    case 'After Extra Time':   return 'AET';
    case 'After Penalties':    return 'PEN';
    case 'Postponed':          return 'PST';
    case 'Suspended':          return 'SUSP';
    case 'Interrupted':        return 'INT';
    case 'Cancelled':          return 'CANC';
    case 'Abandoned':          return 'ABD';
    default:                   return 'NS';
  }
}

function parseScore(raw: string | null): number | null {
  if (!raw) return null;
  const n = parseInt(raw.trim(), 10);
  return isNaN(n) ? null : n;
}

function parsePenaltyScores(pen: string | null): { home: number; away: number } | null {
  if (!pen || pen.trim() === '-') return null;
  const parts = pen.split('-').map(s => parseInt(s.trim(), 10));
  if (parts.length !== 2 || parts.some(isNaN)) return null;
  return { home: parts[0], away: parts[1] };
}

function mapASFixture(f: ASFixture): APIFixture {
  const ftHome = parseScore(f.event_home_final_result);
  const ftAway = parseScore(f.event_away_final_result);
  const penalties = parsePenaltyScores(f.event_penalty);

  // AllSportsAPI returns the ISO datetime as "event_date event_time" (local time)
  const isoDate = `${f.event_date}T${f.event_time}:00`;

  return {
    fixture: {
      id:     f.event_key,
      date:   isoDate,
      status: { short: asStatusToShort(f.event_status), long: f.event_status },
      venue:  f.event_stadium ?? undefined,
    },
    league: {
      id:     f.league_key,
      name:   f.league_name,
      logo:   '',
      season: new Date(f.event_date).getFullYear(),
    },
    teams: {
      home: { id: f.home_team_key, name: f.event_home_team, logo: f.home_team_logo ?? '' },
      away: { id: f.away_team_key, name: f.event_away_team, logo: f.away_team_logo ?? '' },
    },
    goals: { home: ftHome, away: ftAway },
    score: {
      fulltime:  { home: ftHome, away: ftAway },
      penalties: penalties ? { home: penalties.home, away: penalties.away } : null,
      duration:  penalties ? 'PENALTY_SHOOTOUT' : null,
    },
  };
}

// ── Provider ──────────────────────────────────────────────────────────────────

export class AllSportsProvider implements IFootballProvider {
  private readonly baseUrl = 'https://apiv2.allsportsapi.com/football';
  private readonly apiKey: string;

  constructor() {
    const key = process.env.ALLSPORTS_API_KEY;
    if (!key) throw new Error('ALLSPORTS_API_KEY environment variable is not set');
    this.apiKey = key;
  }

  private async get<T>(met: string, params?: Record<string, string | number>): Promise<ASResponse<T>> {
    const url = new URL(this.baseUrl);
    url.searchParams.set('met', met);
    url.searchParams.set('APIkey', this.apiKey);
    if (params) {
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
    }
    const label = `?met=${met}`;
    console.log(`[allsports] GET ${label}`);
    const t0 = Date.now();
    const res = await fetch(url.toString(), { next: { revalidate: 0 } });
    const ms = Date.now() - t0;
    if (!res.ok) {
      console.error(`[allsports] ${res.status} ${res.statusText} — ${label} (${ms}ms)`);
      throw new Error(`allsports error: ${res.status} ${res.statusText}`);
    }
    const json: ASResponse<T> = await res.json();
    if (!json.success) {
      console.error(`[allsports] API returned success=0 — ${label}`);
      throw new Error(`allsports error: success=0 for ${label}`);
    }
    console.log(`[allsports] 200 OK — ${label} (${ms}ms)`);
    return json;
  }

  async fetchLeagues(): Promise<APILeague[]> {
    const data = await this.get<ASLeague[]>('Leagues');
    return data.result.map(l => ({
      league:  { id: l.league_key, name: l.league_name, country: l.country_name, logo: l.league_logo ?? '' },
      country: { name: l.country_name, flag: l.country_logo ?? '' },
      seasons: [{ year: parseInt(l.league_season.split('/')[0], 10), current: true }],
    }));
  }

  async fetchTeams(leagueId: number, _season: number): Promise<APITeam[]> {
    const data = await this.get<ASTeam[]>('Teams', { leagueId });
    return data.result.map(t => ({
      team: { id: t.team_key, name: t.team_name, logo: t.team_badge ?? '' },
    }));
  }

  async fetchFixtures(params: {
    league: number;
    season: number;
    from?: string;
    to?: string;
    date?: string;
  }): Promise<APIFixture[]> {
    const { league, from, to, date } = params;
    const fromDate = date ?? from;
    const toDate   = date ?? to;
    const query: Record<string, string | number> = { leagueId: league };
    if (fromDate) query.from = fromDate;
    if (toDate)   query.to   = toDate;
    const data = await this.get<ASFixture[]>('Fixtures', query);
    return data.result.map(mapASFixture);
  }

  async fetchFixtureById(fixtureId: number): Promise<APIFixture | null> {
    const data = await this.get<ASFixture[]>('Fixtures', { matchId: fixtureId });
    const f = data.result[0];
    return f ? mapASFixture(f) : null;
  }

  async fetchStandings(leagueId: number): Promise<{ season: number; standings: APIStandingEntry[] }> {
    const data = await this.get<ASStanding[]>('Standings', { leagueId });
    const rows = data.result ?? [];
    const season = rows.length > 0 ? new Date().getFullYear() : 0;
    return {
      season,
      standings: rows.map(e => ({
        position:       parseInt(e.standing_place, 10),
        teamId:         parseInt(e.team_id, 10),
        teamName:       e.team_name,
        played:         parseInt(e.standing_PG, 10),
        won:            parseInt(e.standing_W, 10),
        drawn:          parseInt(e.standing_D, 10),
        lost:           parseInt(e.standing_L, 10),
        points:         parseInt(e.standing_PTS, 10),
        goalsFor:       parseInt(e.standing_GF, 10),
        goalsAgainst:   parseInt(e.standing_GA, 10),
        goalDifference: parseInt(e.standing_GD, 10),
        form:           e.standing_P ?? null,
      })),
    };
  }

  async fetchHeadToHead(matchId: number, limit = 5): Promise<APIFixture[]> {
    // AllSportsAPI H2H is by team pair — resolve team IDs from the fixture first (1 extra request)
    const fixture = await this.fetchFixtureById(matchId);
    if (!fixture) return [];
    const data = await this.get<ASFixture[]>('H2H', {
      firstTeamId:  fixture.teams.home.id,
      secondTeamId: fixture.teams.away.id,
    });
    return data.result.slice(0, limit).map(mapASFixture);
  }
}
```

### Datetime note

AllSportsAPI returns event date and time as separate fields (`event_date`, `event_time`) and the time is **local to the venue**. The mapper combines them into a naive ISO string. If accurate UTC kickoff times matter, cross-reference with another source or add a timezone offset lookup.

---

## 6. Activation

### Step 1 — Register the provider in `factory.ts`

```typescript
import { FootballDataProvider } from './providers/football-data';
import { AllSportsProvider }    from './providers/allsports';      // add this

export function getFootballProvider(): IFootballProvider {
  if (_instance) return _instance;
  const name = process.env.FOOTBALL_PROVIDER ?? 'football-data';
  switch (name) {
    case 'football-data':
      _instance = new FootballDataProvider();
      break;
    case 'allsports':                            // add this case
      _instance = new AllSportsProvider();
      break;
    default:
      throw new Error(
        `Unknown FOOTBALL_PROVIDER: "${name}". Supported values: "football-data", "allsports"`,
      );
  }
  return _instance;
}
```

### Step 2 — Set environment variables

`.env.local`:
```env
FOOTBALL_PROVIDER=allsports
ALLSPORTS_API_KEY=your_key_here
```

Vercel: **Settings → Environment Variables** — add both `FOOTBALL_PROVIDER` and `ALLSPORTS_API_KEY`.

### Step 3 — Populate leagues with AllSportsAPI IDs

After switching, run **Admin → Leagues → Fetch Leagues** to repopulate the leagues table. The `externalId` in the DB must match AllSportsAPI league IDs; IDs from football-data.org are different and will not match.

### Step 4 — Verify UTC kickoff times

AllSportsAPI returns local event times. After the first `fetch-matches` cron, spot-check a few kickoff times against an authoritative source to confirm they are being stored correctly as UTC.
