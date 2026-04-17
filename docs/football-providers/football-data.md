# football-data.org v4 — Provider Guide

**Status: Active (current provider)**  
**Env var:** `FOOTBALL_PROVIDER=football-data` (default — can be omitted)  
**Key env var:** `FOOTBALL_API_KEY`  
**Implementation:** `src/lib/football/providers/football-data.ts`

---

## 1. Registration

1. Go to **https://www.football-data.org/client/register**
2. Fill in name, email, and password — no credit card required
3. Confirm your email address
4. Log in and copy the **API Token** from your dashboard
5. Add it to `.env.local`:
   ```
   FOOTBALL_API_KEY=your_token_here
   ```
6. Add the same value to your Vercel project: **Settings → Environment Variables → `FOOTBALL_API_KEY`**

---

## 2. Free Tier Limits

| Constraint | Value |
|---|---|
| Requests/minute | 10 |
| Daily cap | None (rate-limited to 10/min) |
| Competitions (free) | ~16 top competitions |
| Live data | No (free tier is not real-time) |
| Historical data | Last ~3 seasons |
| Support | Community |

### Free Tier Competitions (Plan TIER_ONE)

| External ID | Competition |
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

---

## 3. Endpoint Mapping

| `IFootballProvider` method | football-data.org endpoint |
|---|---|
| `fetchLeagues()` | `GET /competitions` |
| `fetchTeams(leagueId, season)` | `GET /competitions/{leagueId}/teams?season={year}` |
| `fetchFixtures({league, season, from, to})` | `GET /competitions/{league}/matches?season={year}&dateFrom={from}&dateTo={to}` |
| `fetchFixtureById(id)` | `GET /matches/{id}` |
| `fetchStandings(leagueId)` | `GET /competitions/{leagueId}/standings` |
| `fetchHeadToHead(matchId, limit)` | `GET /matches/{matchId}/head2head?limit={limit}` |

**H2H:** Native match-ID-based endpoint — no extra lookup required.

---

## 4. Status Code Mapping

| football-data.org status | Short code | `mapFixtureStatus()` result |
|---|---|---|
| `SCHEDULED`, `TIMED` | `NS` | `scheduled` |
| `IN_PLAY` | `1H` | `live` |
| `PAUSED` | `HT` | `live` |
| `FINISHED` | `FT` | `finished` |
| `POSTPONED` | `PST` | `postponed` |
| `SUSPENDED` | `SUSP` | `postponed` |
| `CANCELLED` | `CANC` | `cancelled` |
| `AWARDED` | `AWD` | `cancelled` |

---

## 5. Implementation

Already implemented. See `src/lib/football/providers/football-data.ts`.

No changes needed to activate — this is the default provider.

---

## 6. Activation

Already active. `factory.ts` already handles `case 'football-data':`.

To make it explicit, ensure `.env.local` contains:

```env
FOOTBALL_PROVIDER=football-data
FOOTBALL_API_KEY=your_token_here
```

If `FOOTBALL_PROVIDER` is omitted entirely, `factory.ts` defaults to `football-data`.
