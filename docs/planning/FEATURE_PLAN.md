# Feature Plan — Football Predictions (Free Tier)

> Based on football-data.org free tier capabilities.  
> All features below work within the existing API contract — no tier upgrade required.

## Free Tier Constraints

| Constraint | Value |
|---|---|
| Requests/minute | 10 |
| Live data | No — status/scores are polled, not real-time |
| Available endpoints | competitions, teams, matches, standings, H2H |
| Not available | Live events (goals/cards), player data, lineups, injuries, odds |

---

## Features

### F1b — Match Status Badge

**Layers:** Web + Mobile  
**Effort:** Low | **Impact:** Medium

Show a `LIVE` / `HT` / `FT` badge on match cards derived from the stored `status` field. The `fetch-results` cron already updates status via `fetchFixtureById` — this is a pure UI change on existing data. No new API calls.

---

### F2 — Team Form Strip

**Layers:** Web + Mobile  
**Effort:** Low | **Impact:** High

The `form` string (e.g. `"WWDLW"`) is already fetched and stored in `TeamStanding`. Render as colored W/D/L dots on match cards and the match detail page. Zero new API calls.

---

### F3 — Venue Display

**Layers:** Web + Mobile  
**Effort:** Low | **Impact:** Low

`venue` is already stored on the `Match` model from the existing fixture fetch. Show it on the match detail page. Zero new API calls.

---

### F4 — Full League Standings Page

**Layers:** Web + Mobile  
**Effort:** Medium | **Impact:** Medium

`TeamStanding` is already fully populated. Add a dedicated standings page (`/leagues/[id]/standings` on web, league standings screen on mobile) showing the complete table for all teams — not just match participants. Zero new API calls.

---

### F5 — Personal Accuracy Stats

**Layers:** Web + Mobile  
**Effort:** Medium | **Impact:** High

Aggregate from the existing `Prediction` table and `scoringBreakdown` JSON. No new API calls.

Stats to surface:
- % exact scores
- % correct winner
- Total points earned
- Best-performing league
- Current correct-prediction streak

Display as a stats card at the top of the predictions page (web) and predictions tab (mobile).

---

### F6 — Group Match Comparison

**Layers:** Web + Mobile  
**Effort:** Medium | **Impact:** High

For a finished match, show what each group member predicted side-by-side. Data already exists in the `Prediction` table. Requires a new endpoint:

```
GET /api/matches/[matchId]/group-predictions?groupId=
GET /api/mobile/matches/[matchId]/group-predictions?groupId=
```

Zero new API calls.

---

### F7 — H2H Summary Card

**Layers:** Web + Mobile  
**Effort:** Low | **Impact:** Medium

`fetchHeadToHead` is already implemented and called. Currently lists 5 matches. Add an aggregated summary row above the list:

- Home wins / Draws / Away wins
- Average goals per game
- Last meeting result

Pure UI + small aggregation on existing data.

---

### F9 — Deadline Countdown Timer

**Layers:** Web + Mobile  
**Effort:** Low | **Impact:** Medium

Client-side countdown to `kickoffTime` on match cards. Shows "2h 15m left to predict" and disappears when the match locks. Zero API calls, zero backend changes.

---

### F10 — Matchday Mini-League

**Layers:** Web + Mobile  
**Effort:** Medium | **Impact:** High

Scope the leaderboard to a single matchday using the existing `matchday` field on `Match`. Adds a "This Matchday" filter tab alongside the existing week/month/all-time options. No schema changes needed.

---

### F11 — Streaks & Badges

**Layers:** Web + Mobile  
**Effort:** High | **Impact:** High

Track consecutive correct predictions from existing `Prediction` data. Requires a small migration to add `currentStreak` and `longestStreak` to the `User` model. Badges are computed — no API calls.

Badge types:
- Exact Score (first exact score prediction)
- On a Roll (3 correct in a row)
- Perfect Week (all predictions correct in a matchday)
- Group Champion (finished #1 in a group leaderboard period)

Display on leaderboard rows and a future profile screen.

---

## Priority Matrix

| # | Feature | Effort | Impact | New API calls |
|---|---|---|---|---|
| F3 | Venue display | Low | Low | No |
| F2 | Form strip | Low | High | No |
| F1b | Status badge | Low | Medium | No |
| F9 | Deadline countdown | Low | Medium | No |
| F7 | H2H summary card | Low | Medium | No |
| F5 | Personal accuracy stats | Medium | High | No |
| F4 | Full standings page | Medium | Medium | No |
| F6 | Group match comparison | Medium | High | No |
| F10 | Matchday mini-league | Medium | High | No |
| F11 | Streaks & badges | High | High | No |

---

## Recommended Starting Point

**F2 + F1b + F9** — three UI-only changes, both web and mobile, data already in DB, no API calls, deliverable together.
