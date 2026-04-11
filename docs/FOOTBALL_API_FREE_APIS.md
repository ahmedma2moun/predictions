# Free Football APIs — Reference Guide

This document covers the main free-tier football APIs available, their limits, and how they compare to the one currently integrated in this project.

---

## Currently Used: football-data.org v4

**Base URL:** `https://api.football-data.org/v4`  
**Auth:** `X-Auth-Token: <key>` header  
**Client:** `src/lib/football-api.ts`

### Free Tier Limits
| Constraint | Value |
|---|---|
| Requests/minute | 10 |
| Calls/day | No hard cap (but ~10 req/min is enforced) |
| Competitions available | ~16 (top leagues + international) |
| Historical data | Last ~3 seasons |
| Live data | No (free tier is not real-time) |

### Free Tier Competitions (Plan TIER_ONE)
| ID | Competition |
|---|---|
| 2001 | UEFA Champions League |
| 2002 | Bundesliga |
| 2003 | Eredivisie |
| 2013 | Campeonato Brasileiro Série A |
| 2014 | Primera Division (La Liga) |
| 2015 | Ligue 1 |
| 2016 | Championship |
| 2017 | Primeira Liga |
| 2018 | European Championship |
| 2019 | Serie A |
| 2021 | Premier League |
| 2152 | Copa Libertadores |
| 2114 | FIFA World Cup |

### Endpoints Used in This App
| Function | Endpoint | Purpose |
|---|---|---|
| `fetchLeagues()` | `GET /competitions` | List all available competitions |
| `fetchTeams(leagueId, season)` | `GET /competitions/{id}/teams` | Teams in a competition |
| `fetchFixtures(params)` | `GET /competitions/{id}/matches` | Fixtures with optional date range |
| `fetchFixtureById(id)` | `GET /matches/{id}` | Single match by external ID |
| `fetchStandings(leagueId)` | `GET /competitions/{id}/standings` | League table |

### Status Mapping
The API returns verbose statuses that are normalized to short codes internally:

| football-data.org status | Short code | App status |
|---|---|---|
| `SCHEDULED`, `TIMED` | `NS` | scheduled |
| `IN_PLAY` | `1H` | live |
| `PAUSED` | `HT` | live |
| `FINISHED` | `FT` | finished |
| `POSTPONED` | `PST` | postponed |
| `SUSPENDED` | `SUSP` | postponed |
| `CANCELLED` | `CANC` | cancelled |
| `AWARDED` | `AWD` | cancelled |

---

## Alternative Free APIs

### 1. API-Football (RapidAPI) — Free Tier

**Base URL:** `https://v3.football.api-sports.io`  
**Auth:** `x-rapidapi-key` or `x-apisports-key` header  
**Docs:** https://www.api-football.com/documentation-v3

| Constraint | Value |
|---|---|
| Requests/day | 100 |
| Requests/minute | 30 |
| Seasons available | Current + recent |
| Competitions | 1,000+ leagues worldwide |
| Live data | Yes (updates every ~15s) |
| Historical data | Limited on free tier |

**Key endpoints:**
- `GET /fixtures?league={id}&season={year}` — fetch fixtures
- `GET /fixtures?id={id}` — single fixture
- `GET /standings?league={id}&season={year}` — league table
- `GET /leagues` — list leagues

**Pros:** Very broad coverage, live updates on free tier, rich fixture data (lineups, events, statistics)  
**Cons:** 100 req/day is very tight; shared key on RapidAPI has extra overhead; response schema is more complex

> This was the original API for this project before migrating to football-data.org. See `src/lib/football-api.ts` — the `APIFixture`, `APILeague`, `APITeam` interfaces were originally designed to match API-Football's shape and are kept as the internal contract.

---

### 2. OpenLigaDB

**Base URL:** `https://api.openligadb.de`  
**Auth:** None (fully open)  
**Docs:** https://github.com/OpenLigaDB/OpenLigaDB-Samples

| Constraint | Value |
|---|---|
| Requests/day | Unlimited |
| Requests/minute | No documented limit |
| Competitions | German leagues only (Bundesliga, 2. Bundesliga, etc.) |
| Live data | Yes (near real-time) |
| Historical data | Many seasons |

**Key endpoints:**
- `GET /getmatchdata/{league}/{season}/{group}` — matchday fixtures
- `GET /getmatchdata/{matchId}` — single match
- `GET /getcurrentgroup/{league}` — current matchday

**Pros:** Free, no key needed, live data, extensive Bundesliga history  
**Cons:** German football only

---

### 3. TheSportsDB

**Base URL:** `https://www.thesportsdb.com/api/v1/json/{apikey}`  
**Free key:** `3` (test key)  
**Docs:** https://www.thesportsdb.com/api.php

| Constraint | Value |
|---|---|
| Requests/day | Not strictly limited on test key |
| Live data | No (free tier) |
| Competitions | Global coverage |
| Historical data | Yes |

**Key endpoints:**
- `GET /eventsseason.php?id={leagueId}&s={season}` — all events in a season
- `GET /eventsnextleague.php?id={leagueId}` — next 15 fixtures
- `GET /eventspastleague.php?id={leagueId}` — last 15 results
- `GET /lookupevent.php?id={eventId}` — single event

**Pros:** Very permissive free tier, global coverage, team/player metadata  
**Cons:** Free tier missing live scores and detailed match stats; data can lag behind

---

### 4. Sportmonks Football API — Free Plan

**Base URL:** `https://api.sportmonks.com/v3/football`  
**Auth:** Bearer token  
**Docs:** https://docs.sportmonks.com/football

| Constraint | Value |
|---|---|
| Requests/hour | 180 |
| Competitions | Limited on free plan |
| Live data | Yes (with rate limits) |
| Historical data | Yes |

**Pros:** Flexible query system (include/select params), decent free tier  
**Cons:** Requires account; free plan competition list is narrow

---

## Comparison Summary

| API | Free Req/Day | Live Data | Coverage | Key Required |
|---|---|---|---|---|
| **football-data.org** (current) | ~unlimited (10/min) | No | 16 top competitions | Yes |
| API-Football | 100 | Yes | 1,000+ leagues | Yes |
| OpenLigaDB | Unlimited | Yes | Germany only | No |
| TheSportsDB | Generous | No | Global | Test key (`3`) |
| Sportmonks | ~4,320 (180/hr) | Yes | Limited free | Yes |

---

## Usage Rules in This Project

Regardless of which API is used, the following constraints apply app-wide:

1. **Never call the football API from user-facing routes.** All calls must go through cron jobs (`src/app/api/cron/`) or admin-only API routes.
2. **Rate limit budget is shared** — one runaway cron exhausts the daily quota for everyone.
3. **Always check `externalId` before inserting** — deduplication prevents duplicate matches when a cron runs multiple times.
4. **`fetchFixtures` is the hot path** — called on the Friday cron (`fetch-matches`) and the daily results cron (`fetch-results`). Keep it lean.

If you switch APIs, update:
- `src/lib/football-api.ts` — adapter layer (keep the exported interface shapes stable)
- `FOOTBALL_API_KEY` env var (and Vercel project settings)
- This document
