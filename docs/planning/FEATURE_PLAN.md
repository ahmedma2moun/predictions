# Feature Plan — Football Predictions (Free Tier)

> Based on football-data.org free tier capabilities.  
> All features below work within the existing API contract — no tier upgrade required.

## Status Key

| Badge | Meaning |
|---|---|
| ✅ Done | Fully implemented on web + mobile |
| ⚠️ Partial | Exists but incomplete (see notes) |
| ❌ Not started | Not yet implemented |

## Free Tier Constraints

| Constraint | Value |
|---|---|
| Requests/minute | 10 |
| Live data | No — status/scores are polled, not real-time |
| Available endpoints | competitions, teams, matches, standings, H2H |
| Not available | Live events (goals/cards), player data, lineups, injuries, odds |

---

## Features

### F1b — Match Status Badge ✅ Done

**Layers:** Web + Mobile  
**Effort:** Low | **Impact:** Medium

Show a `LIVE` / `HT` / `FT` badge on match cards derived from the stored `status` field. The `fetch-results` cron already updates status via `fetchFixtureById` — this is a pure UI change on existing data. No new API calls.

---

### F2 — Team Form Strip ❌ Blocked

**Layers:** Web + Mobile  
**Effort:** Low | **Impact:** High

The `form` field exists on `TeamStanding` but the football-data.org free tier does not return form data — the field is always null. Unblocked only if the API starts returning it or a paid tier is used.

---

### F3 — Venue Display ❌ Blocked

**Layers:** Web + Mobile  
**Effort:** Low | **Impact:** Low

`venue` is stored on the `Match` model but the football-data.org free tier does not return venue data in its responses — the field is always null. Unblocked only if the API starts returning it or a paid tier is used.

---

### F4 — Full League Standings Page ❌ Not started

**Layers:** Web + Mobile  
**Effort:** Medium | **Impact:** Medium

`TeamStanding` is already fully populated. Add a dedicated standings page (`/leagues/[id]/standings` on web, league standings screen on mobile) showing the complete table for all teams — not just match participants. Zero new API calls.

---

### F5 — Personal Accuracy Stats ❌ Not started

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

> **Note:** `accuracy` is already computed in `leaderboard-service.ts` but not surfaced on the predictions page.

---

### F6 — Group Match Comparison ✅ Done

**Layers:** Web + Mobile  
**Effort:** Medium | **Impact:** High

For a finished match, show what each group member predicted side-by-side. Data already exists in the `Prediction` table. Requires a new endpoint:

```
GET /api/matches/[matchId]/group-predictions?groupId=
GET /api/mobile/matches/[matchId]/group-predictions?groupId=
```

Zero new API calls.

---

### F7 — H2H Summary Card ✅ Done

**Layers:** Web + Mobile  
**Effort:** Low | **Impact:** Medium

`fetchHeadToHead` is already implemented and called. Currently lists 5 matches. Add an aggregated summary row above the list:

- Home wins / Draws / Away wins
- Average goals per game
- Last meeting result

Pure UI + small aggregation on existing data.

---

### F9 — Deadline Countdown Timer ✅ Done

**Layers:** Web + Mobile  
**Effort:** Low | **Impact:** Medium

Client-side countdown to `kickoffTime` on match cards. Shows "2h 15m left to predict" and disappears when the match locks. Zero API calls, zero backend changes.

---

### F10 — Matchday Mini-League ⚠️ Partial

**Layers:** Web + Mobile  
**Effort:** Medium | **Impact:** High

Scope the leaderboard to a single matchday using the existing `matchday` field on `Match`. Adds a "This Matchday" filter tab alongside the existing week/month/all-time options. No schema changes needed.

> **Status:** Week/Month/All-time filters exist. The "This Matchday" tab is not yet implemented.

---

### F11 — Streaks & Badges ❌ Not started

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

| # | Feature | Effort | Impact | New API calls | Status |
|---|---|---|---|---|---|
| F3 | Venue display | Low | Low | No | ❌ Blocked (no data in free tier) |
| F2 | Form strip | Low | High | No | ❌ Blocked (no data in free tier) |
| F1b | Status badge | Low | Medium | No | ✅ Done |
| F9 | Deadline countdown | Low | Medium | No | ✅ Done |
| F7 | H2H summary card | Low | Medium | No | ✅ Done |
| F6 | Group match comparison | Medium | High | No | ✅ Done |
| F5 | Personal accuracy stats | Medium | High | No | ❌ Not started |
| F4 | Full standings page | Medium | Medium | No | ❌ Not started |
| F10 | Matchday mini-league | Medium | High | No | ⚠️ Partial |
| F11 | Streaks & badges | High | High | No | ❌ Not started |

---

## Recommended Starting Point

**F5 + F4 + F10** — F5 can reuse the already-computed `accuracy` from `leaderboard-service.ts`; F4 only needs a new page over fully-populated `TeamStanding` data; F10 just adds one filter tab to the existing leaderboard.
