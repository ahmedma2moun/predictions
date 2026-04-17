# Free Football APIs — Overview

Comparison of free-tier football APIs and their suitability for this project.  
For full registration steps, endpoint mapping, and implementation code, see the individual provider files below.

---

## Provider Files

| File | Provider | Status |
|---|---|---|
| [football-data.md](football-data.md) | football-data.org v4 | **Active (current)** |
| [api-football.md](api-football.md) | API-Football / API-Sports | Ready to activate |
| [sportmonks.md](sportmonks.md) | Sportmonks v3 | Ready to activate |
| [allsports.md](allsports.md) | AllSportsAPI | Ready to activate |

---

## Required Provider Interface

All providers must implement all 6 methods of `IFootballProvider` from `src/lib/football/types.ts`:

| Method | Purpose |
|---|---|
| `fetchLeagues()` | List all available competitions |
| `fetchTeams(leagueId, season)` | Teams in a competition for a season |
| `fetchFixtures({league, season, from, to})` | Fixtures within a date window |
| `fetchFixtureById(id)` | Single match by external ID |
| `fetchStandings(leagueId)` | League standings table |
| `fetchHeadToHead(matchId, limit)` | Last N matches between two teams |

---

## Comparison Table

| Provider | Req/Day Free | Live Scores | Coverage (free) | H2H by Match ID | Key Required |
|---|---|---|---|---|---|
| **football-data.org** (current) | ~unlimited (10/min) | No | 16 top competitions | Yes (native) | Yes |
| **API-Football** | 100 | Yes (~15s) | 1,000+ leagues | Via team ID lookup | Yes |
| **Sportmonks** | ~4,320 (180/hr) | Yes | Top 5 + UCL | Via team ID lookup | Yes |
| **AllSportsAPI** | 100 | Yes | 400+ leagues | Via team ID lookup | Yes |

### H2H Note

football-data.org is the only provider with a native "H2H by match ID" endpoint (`/matches/{id}/head2head`).  
All other providers expose H2H by team pair. The provider implementations in this folder handle this transparently by resolving team IDs from the fixture first — callers see no difference.

---

## Rate Limit Budget

These constraints apply regardless of provider:

1. **Never call the football API from user-facing routes.** All calls go through cron jobs (`src/app/api/cron/`) or admin-only API routes.
2. **Rate limit budget is shared** — one runaway cron exhausts the daily quota for all users.
3. **Always check `externalId` before inserting** — deduplication prevents duplicates when a cron reruns.
4. **`fetchFixtures` is the hot path** — called on the Friday cron (`fetch-matches`) and daily results cron (`fetch-results`). Keep it lean.

---

## Switching Providers

The app uses a provider abstraction at `src/lib/football/`. To activate a different provider:

1. The implementation file already exists in `src/lib/football/providers/` (or create it from the guide below)
2. Register it in `src/lib/football/factory.ts` — add a `case '<name>':` block
3. Set `FOOTBALL_PROVIDER=<name>` in `.env.local` and Vercel project settings
4. Set the provider-specific API key env var

`service.ts` and all callers (`matches-processor`, `results-processor`, `standings`, `h2h`, admin routes) require **no changes**.
