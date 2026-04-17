# Sportmonks Football API v3 — Provider Guide

**Status: Ready to activate**  
**Env var:** `FOOTBALL_PROVIDER=sportmonks`  
**Key env var:** `SPORTMONKS_API_TOKEN`  
**Implementation path:** `src/lib/football/providers/sportmonks.ts`

---

## 1. Registration

1. Go to **https://www.sportmonks.com/register**
2. Create a free account (email + password, no credit card required)
3. After email confirmation, log in to the **Dashboard**
4. Navigate to **My Account → API Tokens**
5. Click **Create Token** — give it a name (e.g. "football-predictions")
6. Copy the token
7. Add to `.env.local`:
   ```env
   SPORTMONKS_API_TOKEN=your_token_here
   ```
8. Add the same value to Vercel: **Settings → Environment Variables → `SPORTMONKS_API_TOKEN`**

### Subscribing to the Football package

1. In the Sportmonks dashboard, go to **Products**
2. Select **Football API**
3. Choose the **Free** plan
4. The free plan includes: Premier League, La Liga, Bundesliga, Serie A, Ligue 1, UEFA Champions League

---

## 2. Free Tier Limits

| Constraint | Value |
|---|---|
| Requests/hour | **180** |
| Requests/day | ~4,320 |
| Competitions (free) | Top 5 leagues + UCL |
| Live data | Yes |
| Historical data | Yes |

This is the highest request quota of any free football API — well above the daily usage pattern of this app.

---

## 3. Endpoint Mapping

Sportmonks v3 uses a flexible `include=` parameter to embed related resources in a single call, reducing round trips.

| `IFootballProvider` method | Sportmonks v3 endpoint |
|---|---|
| `fetchLeagues()` | `GET /football/leagues?include=currentSeason` |
| `fetchTeams(leagueId, season)` | Resolve season ID → `GET /football/teams/seasons/{seasonId}` |
| `fetchFixtures({league, season, from, to})` | `GET /football/fixtures/between/{from}/{to}?filters=fixturesByLeagueIds:{league}&include=participants;scores;state;league;round` |
| `fetchFixtureById(id)` | `GET /football/fixtures/{id}?include=participants;scores;state;league;round` |
| `fetchStandings(leagueId)` | Resolve season ID → `GET /football/standings/seasons/{seasonId}?include=participant` |
| `fetchHeadToHead(matchId, limit)` | Resolve team IDs from fixture → `GET /football/fixtures/head-to-head/{teamA}/{teamB}?include=participants;scores;state` |

### Season ID resolution

Sportmonks identifies seasons by integer ID, not by year. When a method needs a season ID, the provider resolves it from a cached map built by calling:

```
GET /football/seasons?filters=seasonsByLeagueId:{leagueId}
```

This adds one extra call per league per cold start, after which it is cached in memory for the lifetime of the serverless instance.

### H2H

Requires two API calls: first resolves team IDs from `fetchFixtureById`, then calls the team-pair H2H endpoint. The 2-call cost is identical to API-Football's approach.

---

## 4. Status Code Mapping

Sportmonks uses a `state` object with a `state` string field. Mapping:

| Sportmonks `state.state` | Short code | `mapFixtureStatus()` result |
|---|---|---|
| `NS` | `NS` | `scheduled` |
| `LIVE`, `1H`, `2H` | `LIVE` / `1H` / `2H` | `live` |
| `HT` | `HT` | `live` |
| `ET` | `ET` | `live` |
| `BREAK` | `BT` | `live` |
| `PEN_LIVE` | `P` | `live` |
| `FT` | `FT` | `finished` |
| `AET` | `AET` | `finished` |
| `FT_PEN` | `PEN` | `finished` |
| `POSTP` | `PST` | `postponed` |
| `SUSP` | `SUSP` | `postponed` |
| `INT` | `INT` | `postponed` |
| `CANC` | `CANC` | `cancelled` |
| `ABD` | `ABD` | `cancelled` |
| `AWARDED` | `AWD` | `cancelled` |
| `WO` | `WO` | `cancelled` |

---

## 5. Implementation

Create `src/lib/football/providers/sportmonks.ts`:

```typescript
import type {
  IFootballProvider,
  APILeague,
  APIFixture,
  APITeam,
  APIStandingEntry,
} from '../types';

// ── Sportmonks v3 raw response shapes ────────────────────────────────────────

interface SMPaged<T> {
  data: T;
}

interface SMLeague {
  id: number;
  name: string;
  image_path: string;
  country: { name: string; image_path: string } | null;
  currentSeason?: { id: number; name: string; starting_at: string };
}

interface SMSeason {
  id: number;
  name: string;
  starting_at: string;
  league_id: number;
}

interface SMParticipant {
  id: number;
  name: string;
  image_path: string;
  meta: { location: 'home' | 'away' };
}

interface SMScore {
  description: string; // "CURRENT", "1ST_HALF", "2ND_HALF", "PENALTIES", "EXTRA_TIME"
  score: { goals: number | null; participant: 'home' | 'away' };
}

interface SMState {
  state: string; // "NS", "1H", "HT", "2H", "FT", "AET", etc.
  name: string;
}

interface SMRound {
  name: string; // e.g. "Matchday 7" or "Round of 16"
}

interface SMLeagueEmbed {
  id: number;
  name: string;
  image_path: string;
  season_id?: number;
}

interface SMFixture {
  id: number;
  starting_at: string;
  state: SMState | null;
  stage: { name: string } | null;
  round: SMRound | null;
  venue_id?: number;
  league: SMLeagueEmbed | null;
  participants: SMParticipant[];
  scores: SMScore[];
}

interface SMStandingEntry {
  position: number;
  participant: { id: number; name: string; image_path: string };
  details: Array<{ type: { code: string }; value: number }>;
  points: number;
  form: string | null;
}

interface SMTeam {
  id: number;
  name: string;
  image_path: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function smStateToShort(state: SMState | null): string {
  if (!state) return 'NS';
  switch (state.state) {
    case '1H':       return '1H';
    case 'HT':       return 'HT';
    case '2H':       return '2H';
    case 'ET':       return 'ET';
    case 'BREAK':    return 'BT';
    case 'PEN_LIVE': return 'P';
    case 'LIVE':     return 'LIVE';
    case 'FT':       return 'FT';
    case 'AET':      return 'AET';
    case 'FT_PEN':   return 'PEN';
    case 'POSTP':    return 'PST';
    case 'SUSP':     return 'SUSP';
    case 'INT':      return 'INT';
    case 'CANC':     return 'CANC';
    case 'ABD':      return 'ABD';
    case 'AWARDED':  return 'AWD';
    case 'WO':       return 'WO';
    default:         return 'NS';
  }
}

function getScore(scores: SMScore[], desc: string, side: 'home' | 'away'): number | null {
  return scores.find(s => s.description === desc && s.score.participant === side)?.score.goals ?? null;
}

function mapSMFixture(f: SMFixture, leagueId: number, seasonYear: number): APIFixture {
  const home = f.participants.find(p => p.meta.location === 'home');
  const away = f.participants.find(p => p.meta.location === 'away');

  const ftHome = getScore(f.scores, 'CURRENT', 'home');
  const ftAway = getScore(f.scores, 'CURRENT', 'away');
  const penHome = getScore(f.scores, 'PENALTIES', 'home');
  const penAway = getScore(f.scores, 'PENALTIES', 'away');
  const isPenalty = penHome !== null && penAway !== null;

  // Extract numeric matchday from round name ("Matchday 7" → 7, "Week 12" → 12)
  const matchdayMatch = f.round?.name?.match(/\d+/);
  const matchday = matchdayMatch ? parseInt(matchdayMatch[0], 10) : undefined;

  return {
    fixture: {
      id:       f.id,
      date:     f.starting_at,
      status:   { short: smStateToShort(f.state), long: f.state?.name ?? '' },
      stage:    f.stage?.name ?? undefined,
      matchday,
    },
    league: {
      id:     leagueId,
      name:   f.league?.name ?? '',
      logo:   f.league?.image_path ?? '',
      season: seasonYear,
    },
    teams: {
      home: { id: home?.id ?? 0, name: home?.name ?? '', logo: home?.image_path ?? '' },
      away: { id: away?.id ?? 0, name: away?.name ?? '', logo: away?.image_path ?? '' },
    },
    goals: { home: ftHome, away: ftAway },
    score: {
      fulltime:  { home: ftHome, away: ftAway },
      penalties: isPenalty ? { home: penHome, away: penAway } : null,
      duration:  isPenalty ? 'PENALTY_SHOOTOUT' : null,
    },
  };
}

// ── Provider ──────────────────────────────────────────────────────────────────

export class SportmonksProvider implements IFootballProvider {
  private readonly baseUrl = 'https://api.sportmonks.com/v3/football';
  private readonly headers: Record<string, string>;
  // Cache: "{leagueId}_{year}" → sportmonks season ID
  private readonly seasonIdCache = new Map<string, number>();

  constructor() {
    const token = process.env.SPORTMONKS_API_TOKEN;
    if (!token) throw new Error('SPORTMONKS_API_TOKEN environment variable is not set');
    this.headers = { Authorization: `Bearer ${token}` };
  }

  private async get<T>(path: string, params?: Record<string, string | number>): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    if (params) {
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
    }
    const label = `${path}${url.search}`;
    console.log(`[sportmonks] GET ${label}`);
    const t0 = Date.now();
    const res = await fetch(url.toString(), { headers: this.headers, next: { revalidate: 0 } });
    const ms = Date.now() - t0;
    if (!res.ok) {
      console.error(`[sportmonks] ${res.status} ${res.statusText} — ${label} (${ms}ms)`);
      throw new Error(`sportmonks error: ${res.status} ${res.statusText}`);
    }
    console.log(`[sportmonks] 200 OK — ${label} (${ms}ms)`);
    return res.json();
  }

  private async resolveSeasonId(leagueId: number, year: number): Promise<number | null> {
    const key = `${leagueId}_${year}`;
    if (this.seasonIdCache.has(key)) return this.seasonIdCache.get(key)!;

    const data = await this.get<SMPaged<SMSeason[]>>('/seasons', {
      filters: `seasonsByLeagueId:${leagueId}`,
    });
    for (const s of data.data) {
      const seasonYear = new Date(s.starting_at).getFullYear();
      this.seasonIdCache.set(`${s.league_id}_${seasonYear}`, s.id);
    }
    return this.seasonIdCache.get(key) ?? null;
  }

  async fetchLeagues(): Promise<APILeague[]> {
    const data = await this.get<SMPaged<SMLeague[]>>('/leagues', { include: 'currentSeason' });
    return data.data
      .filter(l => l.currentSeason)
      .map(l => ({
        league: {
          id:      l.id,
          name:    l.name,
          country: l.country?.name ?? '',
          logo:    l.image_path,
        },
        country: { name: l.country?.name ?? '', flag: l.country?.image_path ?? '' },
        seasons: [{ year: new Date(l.currentSeason!.starting_at).getFullYear(), current: true }],
      }));
  }

  async fetchTeams(leagueId: number, season: number): Promise<APITeam[]> {
    const seasonId = await this.resolveSeasonId(leagueId, season);
    if (!seasonId) return [];
    const data = await this.get<SMPaged<SMTeam[]>>(`/teams/seasons/${seasonId}`);
    return data.data.map(t => ({ team: { id: t.id, name: t.name, logo: t.image_path } }));
  }

  async fetchFixtures(params: {
    league: number;
    season: number;
    from?: string;
    to?: string;
    date?: string;
  }): Promise<APIFixture[]> {
    const { league, season, from, to, date } = params;
    const start = date ?? from ?? '';
    const end   = date ?? to ?? '';
    if (!start || !end) return [];

    const data = await this.get<SMPaged<SMFixture[]>>(
      `/fixtures/between/${start}/${end}`,
      {
        filters: `fixturesByLeagueIds:${league}`,
        include: 'participants;scores;state;league;round;stage',
        per_page: '250',
      },
    );
    return data.data.map(f => mapSMFixture(f, league, season));
  }

  async fetchFixtureById(fixtureId: number): Promise<APIFixture | null> {
    const data = await this.get<SMPaged<SMFixture>>(
      `/fixtures/${fixtureId}`,
      { include: 'participants;scores;state;league;round;stage' },
    );
    if (!data.data) return null;
    const f = data.data;
    const leagueId = f.league?.id ?? 0;
    const seasonYear = 0; // year is unknown from a single fixture fetch — callers that need it use fetchFixtures
    return mapSMFixture(f, leagueId, seasonYear);
  }

  async fetchStandings(leagueId: number): Promise<{ season: number; standings: APIStandingEntry[] }> {
    // Get the most recent season for this league
    const data = await this.get<SMPaged<SMSeason[]>>('/seasons', {
      filters: `seasonsByLeagueId:${leagueId}`,
    });
    const sorted = [...data.data].sort(
      (a, b) => new Date(b.starting_at).getTime() - new Date(a.starting_at).getTime(),
    );
    const latest = sorted[0];
    if (!latest) return { season: 0, standings: [] };

    const year = new Date(latest.starting_at).getFullYear();
    this.seasonIdCache.set(`${leagueId}_${year}`, latest.id);

    const standings = await this.get<SMPaged<SMStandingEntry[]>>(
      `/standings/seasons/${latest.id}`,
      { include: 'participant' },
    );

    return {
      season: year,
      standings: standings.data.map(e => {
        const detail = (code: string) =>
          e.details?.find(d => d.type.code === code)?.value ?? 0;
        return {
          position:       e.position,
          teamId:         e.participant.id,
          teamName:       e.participant.name,
          played:         detail('MP'),
          won:            detail('W'),
          drawn:          detail('D'),
          lost:           detail('L'),
          points:         e.points,
          goalsFor:       detail('GF'),
          goalsAgainst:   detail('GA'),
          goalDifference: detail('GD'),
          form:           e.form,
        };
      }),
    };
  }

  async fetchHeadToHead(matchId: number, limit = 5): Promise<APIFixture[]> {
    // Sportmonks H2H is by team pair — resolve team IDs from the fixture first (1 extra request)
    const fixture = await this.fetchFixtureById(matchId);
    if (!fixture) return [];
    const { home, away } = fixture.teams;

    const data = await this.get<SMPaged<SMFixture[]>>(
      `/fixtures/head-to-head/${home.id}/${away.id}`,
      {
        include: 'participants;scores;state',
        per_page: String(limit),
      },
    );
    return data.data.map(f => mapSMFixture(f, fixture.league.id, fixture.league.season));
  }
}
```

### Notes on `fetchStandings` detail codes

Sportmonks embeds standing details as typed key-value pairs. The `code` values used above (`MP`, `W`, `D`, `L`, `GF`, `GA`, `GD`) are the standard Sportmonks type codes. If standings come back with zeros, verify the actual `type.code` values in the API response against the [Sportmonks type reference](https://docs.sportmonks.com/football/endpoints-and-entities/entities/types).

---

## 6. Activation

### Step 1 — Register the provider in `factory.ts`

```typescript
import { FootballDataProvider } from './providers/football-data';
import { SportmonksProvider }    from './providers/sportmonks';    // add this

export function getFootballProvider(): IFootballProvider {
  if (_instance) return _instance;
  const name = process.env.FOOTBALL_PROVIDER ?? 'football-data';
  switch (name) {
    case 'football-data':
      _instance = new FootballDataProvider();
      break;
    case 'sportmonks':                           // add this case
      _instance = new SportmonksProvider();
      break;
    default:
      throw new Error(
        `Unknown FOOTBALL_PROVIDER: "${name}". Supported values: "football-data", "sportmonks"`,
      );
  }
  return _instance;
}
```

### Step 2 — Set environment variables

`.env.local`:
```env
FOOTBALL_PROVIDER=sportmonks
SPORTMONKS_API_TOKEN=your_token_here
```

Vercel: **Settings → Environment Variables** — add both `FOOTBALL_PROVIDER` and `SPORTMONKS_API_TOKEN`.

### Step 3 — Populate leagues with Sportmonks IDs

After switching, run **Admin → Leagues → Fetch Leagues** to repopulate the leagues table with Sportmonks league IDs. The `externalId` stored in the DB must match the provider's league IDs, so existing leagues from football-data.org IDs will not match.

> Re-importing leagues will also require re-importing teams and re-fetching upcoming matches.
