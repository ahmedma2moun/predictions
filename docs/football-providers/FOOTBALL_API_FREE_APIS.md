# Free Football APIs — Overview

Comparison of free-tier football APIs and their suitability for this project.  
For full registration steps, endpoint mapping, and implementation code, see the individual provider files below.

---

## Provider Files

| File | Provider | Status |
|---|---|---|
| [football-data.md](football-data.md) | football-data.org v4 | **Active (current)** |
| [api-football.md](api-football.md) | API-Football / API-Sports | Implemented, ready to activate |
| [sportmonks.md](sportmonks.md) | Sportmonks v3 | Ready to activate |
| [allsports.md](allsports.md) | AllSportsAPI | Ready to activate |
| [thesportsdb.md](thesportsdb.md) | TheSportsDB | Implemented (paid key required), ready to activate |

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
| `fetchTeamForm(teamId, limit)` | A single team's last N finished matches, most recent first |

---

## Comparison Table

| Provider | Req/Day Free | Live Scores | Coverage (free) | Team Form Endpoint | Key Required |
|---|---|---|---|---|---|
| **football-data.org** | ~unlimited (10/min) | No | 16 top competitions | `GET /teams/{id}/matches` | Yes |
| **API-Football** | 100 | Yes (~15s) | 1,000+ leagues | `GET /fixtures?team={id}&last={n}` | Yes |
| **Sportmonks** | ~4,320 (180/hr) | Yes | Top 5 + UCL | Team fixtures endpoint | Yes |
| **AllSportsAPI** | 100 | Yes | 400+ leagues | Team fixtures endpoint | Yes |
| **TheSportsDB** (current) | n/a — paid only (100–120/min) | Yes | Global | `GET /eventslast.php?id={id}` (capped at 5) | Yes, paid plan |

### Recent Form Note

Every provider exposes a "team's recent fixtures" endpoint, unlike true head-to-head (which most providers only support by team pair, and TheSportsDB doesn't support natively at all). `fetchTeamForm(teamId, limit)` fetches each team's own last N games independently — the match page then shows both team's forms side by side rather than trying to compute actual head-to-head history, which sidesteps the head-to-head gap entirely.

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

`service.ts` and all callers (`matches-processor`, `results-processor`, `standings`, `team-form`, admin routes) require **no changes**.

## Mock Provider (tests / local dev without an API key)

`src/lib/football/providers/mock.ts` implements `IFootballProvider` entirely in-memory — no network calls. Set `FOOTBALL_PROVIDER=mock` (see `.env.test`, used by the Vitest e2e suite) and drive it with `setMockFixtures(fixtures)` / `clearMock()`. `fetchFixtures()` filters the in-memory list by league id, so `processMatchResults()` and every downstream hook (scoring, Champion Bonus) run completely unchanged against it. Useful for local dev too when you don't have a real API key yet.
