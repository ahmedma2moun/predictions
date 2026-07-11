# TheSportsDB — Provider Guide

**Status: Implemented, not activated** (code exists, `FOOTBALL_PROVIDER` still needs to be set)
**Env var:** `FOOTBALL_PROVIDER=thesportsdb`
**Key env var:** `THESPORTSDB_API_KEY` (**required** — construction throws without it)
**Implementation path:** `src/lib/football/providers/thesportsdb.ts`

> Requires a paid TheSportsDB key. It uses the v2 API (header auth) for
> teams/schedule/event lookups, which only works with a paid key.

---

## 1. Registration

1. Go to **https://www.thesportsdb.com/pricing**.
2. Subscribe to **Single Developer ($9/mo)** or **Small Business ($20/mo)**.
3. Copy the API key from your account and add it to `.env.local`:
   ```env
   FOOTBALL_PROVIDER=thesportsdb
   THESPORTSDB_API_KEY=your_key_here
   ```

---

## 2. Endpoint Mapping

| `IFootballProvider` method | Endpoint used | API version | Notes |
|---|---|---|---|
| `fetchLeagues()` | `GET /all_leagues.php` | v1 (path key) | No v2 leagues-list endpoint exists |
| `fetchTeams(leagueId)` | `GET /list/teams/{leagueId}` | v2 (header key) | Numeric league ID directly |
| `fetchFixtures({league, season, from, to})` | `GET /schedule/league/{league}/{season}` | v2 | Full season, filtered to the `from`/`to` window client-side — no native range param in either API version |
| `fetchFixtures({league, season, date})` | `GET /eventsday.php?d=&l=` | v1 (path key) | No v2 day-schedule endpoint documented |
| `fetchFixtureById(id)` | `GET /lookup/event/{id}` | v2 | |
| `fetchStandings(leagueId)` | `GET /lookupleague.php?id=` (season) → `GET /lookuptable.php?l=&s=` | v1 | No v2 standings endpoint exists |
| `fetchHeadToHead(matchId, limit)` | `GET /lookup/event/{id}` → `GET /eventslast.php?id={homeTeamId}` filtered to the away team | v2 + v1 | **No native H2H endpoint in either version.** Pulls the home team's recent results and keeps matches against the away team |

**Response shape note:** v1 envelopes were verified against live data during
implementation (`{ "events": [...] }`, `{ "table": [...] }`, `{ "results": [...] }`,
`{ "leagues": [...] }` — confirmed field names like `strHomeTeamBadge`, `strStatus`,
`intGoalsFor`, etc.). v2 route paths are confirmed live (they 400 on a bad key rather
than 404), but the exact wrapper key per v2 endpoint couldn't be confirmed without a real
key — `firstArray()` in the provider scans the JSON for the first array value instead of
assuming one key name, so it tolerates whatever the real envelope turns out to be.
**Re-verify response shapes once a real key is added**, and simplify `firstArray()` to a
direct key access if the guess was right.

---

## 3. Status Code Mapping

TheSportsDB has no fixed short-code enum — `strStatus` is free text (`"Match Finished"`,
`"Postponed"`, `""` for not-yet-started, occasionally `"1H"` / `"HT"` for live). The
provider normalizes this to the short codes `mapFixtureStatus()` expects:

| TheSportsDB `strStatus` (or `strPostponed`) | Normalized short code | `mapFixtureStatus()` result |
|---|---|---|
| `""`, `"NS"` | `NS` | `scheduled` |
| `"1H"`, `"2H"`, `"HT"`, `"ET"`, `"BT"`, `"P"`, `"LIVE"` | same | `live` |
| contains `"FINISHED"`, or `"FT"`/`"AET"`/`"PEN"` | `FT` | `finished` |
| `strPostponed: "yes"`, or contains `"POSTPONED"` | `PST` | `postponed` |
| contains `"CANCELLED"`/`"CANCELED"` | `CANC` | `cancelled` |
| contains `"SUSPENDED"`/`"INTERRUPTED"` | `SUSP` | `postponed` |

---

## 4. Activation

### Already registered

The provider and factory case already exist — no code changes needed:

```typescript
// src/lib/football/factory.ts
case 'thesportsdb':
  _instance = new TheSportsDBProvider();
  break;
```

### Step 1 — Set environment variables

`.env.local`:
```env
FOOTBALL_PROVIDER=thesportsdb
THESPORTSDB_API_KEY=your_key_here   # required — construction throws without it
```

Vercel: **Settings → Environment Variables** — add both.

### Step 2 — Remove old key (optional)

`FOOTBALL_API_KEY` / `API_FOOTBALL_KEY` are not read when `FOOTBALL_PROVIDER=thesportsdb`.
