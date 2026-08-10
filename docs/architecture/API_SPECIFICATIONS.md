# API Specifications

## Auth Requirements

| Route group | Required auth |
|---|---|
| `/api/auth/*` | None (NextAuth handlers) |
| `/api/*` (public) | Valid NextAuth session cookie |
| `/api/admin/*` | Session + `role === 'admin'` |
| `/api/cron/*` | `Authorization: Bearer {CRON_SECRET}` **or** `Authorization: Bearer {TRIGGER_SECRET}` **or** `x-vercel-cron-schedule` header |
| `/api/webhooks/qstash/*` | `Upstash-Signature` header, verified against `QSTASH_CURRENT_SIGNING_KEY`/`QSTASH_NEXT_SIGNING_KEY` |
| `/api/mobile/*` | `Authorization: Bearer {signed JWT}` (issued by `/api/mobile/auth/login`) |
| `/api/health` | None |

---

## Public API (session-authenticated)

### GET /api/matches
Returns matches with the user's prediction attached.

**Query params**: `leagueId` (number), `status` (string), `week` (ISO date string — Thursday of the target week)

**Response**: Array of serialized match objects:
```json
[{
  "_id": "42",
  "homeTeam": { "name": "Arsenal", "logo": "https://..." },
  "awayTeam": { "name": "Chelsea", "logo": "https://..." },
  "kickoffTime": "2025-03-15T15:00:00.000Z",
  "status": "scheduled",
  "matchday": 28,
  "stage": "REGULAR_SEASON",
  "prediction": { "homeScore": 2, "awayScore": 1, "pointsAwarded": 0 }
}]
```

### GET /api/matches/[matchId]
Single match with the user's prediction and all group members' predictions (when finished). Includes `odds` (`{ homeWin, draw, awayWin, locked, votes: { homeWin, draw, awayWin } }`) once the match is locked (always for admins); the UI shows the Prediction Odds card to all users from lock time onward. `odds` is `null` when the match's season has odds disabled.

### GET /api/matches/[matchId]/group-predictions
Other users' predictions for a specific match (used to show group picks before and after kickoff).

**Query params**: `groupId` (number, required), `liveHomeScore` / `liveAwayScore` (number, optional) — when the match has no official result yet, passing the current live score computes each entry's `pointsAwarded`/`scoringBreakdown` on the fly (via `calculateScore()`) against that live score instead of the stored (post-match) result. If the match's season has `oddsEnabled`, the same odds multiplier used at final scoring (`calcFinalScore()` in `src/lib/odds.ts`) is applied to the live `correct_winner` points using the current (pre-lock) prediction pool from `getLiveMatchOdds()`, so live points match what the final score would be if the match ended now. Each entry includes `isLive: boolean` indicating whether its points reflect this live computation.

### GET /api/matches/[matchId]/h2h
Head-to-head record between the two teams from historical match data.

### GET /api/matches/[matchId]/live
Live status/score for a locked match, polled client-side (every 60s while the match is in progress). Calls `fetchFixtureById()` from the football service layer (never the provider's raw API directly) and returns `{ status: 'scheduled'|'live'|'finished'|'postponed'|'cancelled', homeScore, awayScore, events }`, normalized via `mapFixtureStatus()`. `fetchFixtureById()` caches each fixture lookup for 30s (`src/lib/football/service.ts`) so concurrent viewers of the same live match collapse into one upstream request — free-tier providers cap requests at ~10/min, shared across the whole app. Returns 400 if the match has no `externalId` (custom match), 502 if the upstream fetch fails.

`events` is `APIMatchEvent[]` (`src/lib/football/types.ts`): `{ type: 'goal'|'card', detail, minute, team: 'home'|'away', player, assistPlayer }`. Populated by the provider only for `finished`/`live` fixtures, empty otherwise or on providers without event data. TheSportsDB (`src/lib/football/providers/thesportsdb.ts`) fetches it from `/lookuptimeline.php`, filtering to `Goal`/`Card` entries; football-data.org and API-Football always return `[]` (no timeline endpoint on the free tier / not wired up). Rendered by `MatchEvents.tsx` (web) and `MatchEventRow.tsx` (mobile) as a goals/cards list on the match page.

### GET /api/predictions
User's prediction history (populated with match data), limit 100, sorted newest first.

**Query params**: `groupId` (number) — filter by group membership

### GET /api/predictions/stats
Aggregated stats for the authenticated user: total predictions, points, accuracy percentage, streak info.

### POST /api/predictions
Submit or update a prediction. Fails if match has already kicked off.

**Body**: `{ matchId: string, homeScore: number, awayScore: number }`

**Errors**:
- `400 Invalid scores` — negative or non-numeric
- `404 Match not found`
- `400 Cannot predict after match has started` — kickoff has passed (server-side lock check)

### GET /api/leaderboard
Ranked leaderboard with aggregated points.

**Query params**: `period` (`all` | `week` | `month`), `leagueId` (number), `groupId` (number)

**Response**: Array sorted by totalPoints desc:
```json
[{
  "rank": 1,
  "userId": "5",
  "name": "Ahmed",
  "totalPoints": 42,
  "championBonusPoints": 8,
  "predictionsCount": 10,
  "accuracy": 70
}]
```
`totalPoints` = prediction points + `championBonusPoints` (a separate additive term); `accuracy` is prediction-only and never inflated by the bonus.

### GET /api/leaderboard/live
Live group standing: the current leaderboard re-ranked with provisional points from matches that are in play right now. Consumed by the match page's **Group Comparison** section, which joins these standings (rank, movement arrow, live total) onto the per-match prediction rows. **Scoped to the ACTIVE season** — returns an empty payload with `X-Season-Status: off` when no season is active.

**Query params**: `groupId` (number, optional)

**Response**:
```json
{
  "hasLiveMatches": true,
  "matches": [{
    "matchId": "12",
    "homeTeamName": "Arsenal",
    "homeTeamLogo": "https://…",
    "awayTeamName": "Chelsea",
    "awayTeamLogo": "https://…",
    "homeScore": 1,
    "awayScore": 0,
    "status": "live",
    "kickoffTime": "2026-06-01T18:00:00.000Z"
  }],
  "standings": [{
    "userId": "5",
    "name": "Ahmed",
    "avatarUrl": null,
    "previousRank": 3,
    "rank": 1,
    "movement": "up",
    "points": 42,
    "livePoints": 15,
    "liveTotalPoints": 57
  }]
}
```
`points` are confirmed (finished matches + Champion Bonus); `livePoints` are provisional, computed from the in-play score with `calculateScore()` + the odds multiplier. `movement` compares `rank` (live) against `previousRank` (confirmed points only): `up` | `down` | `same`. Live scores come from the football API via the shared 30s single-fixture cache; when the API result is `finished` but the result hasn't been processed by the cron yet, the match still counts as provisional. Matches also drop out of the window 4h after kickoff.

### GET /api/leaderboard/user-predictions
A user's scored prediction history (used when expanding a row on the leaderboard). **Scoped to the ACTIVE season** — returns `[]` when no season is active.

**Query params**: `userId` (number, required), `leagueId` (number, repeatable), `from` / `to` (ISO dates)

**Response**: Array of items:
```json
[{
  "matchId": "12",
  "kickoffTime": "2026-06-01T18:00:00.000Z",
  "homeTeamName": "Arsenal",
  "awayTeamName": "Chelsea",
  "homeScore": 2,
  "awayScore": 1,
  "result": { "homeScore": 2, "awayScore": 0 },
  "pointsAwarded": 15,
  "baseScore": 10,
  "outcomeOdds": 1.5,
  "matchOdds": { "homeWin": 1.5, "draw": 3.0, "awayWin": 2.2 },
  "scoringBreakdown": [{ "ruleName": "Correct Winner", "pointsAwarded": 10, "matched": true }],
  "oddsBonus": { "outcomeOdds": 1.5, "baseScore": 10, "finalScore": 15 }
}]
```
`matchOdds` is the locked 1/X/2 odds snapshot (null when odds were never locked); `oddsBonus` is present only when the season had odds enabled at scoring time.

### GET /api/champion-bonus
Champion Bonus state for the active season. Discriminated by `enabled`/`status`:
- `{ enabled: false }` — no config for the active season
- `enabled: true, status: 'OPEN'` — `{ league, allowedTeams, pickCount, myPick }`
- `enabled: true, status: 'LOCKED'` — `{ league, lockedAt, myPick, teams: { [teamId]: { name, logo, awards, totalPoints, nextWinPoints } }, picks: [{ userId, name, teamId, teamName, totalBonus }] }`

One payload — the LOCKED reveal's per-user/per-team breakdown is fully included, no lazy per-row fetch.

### POST /api/champion-bonus/pick
Upserts the caller's Champion Bonus pick.

**Body**: `{ teamId: number }`

**Errors**: `400` Champion Bonus not enabled / team not in the allowed set, `409` picks are locked.

### GET /api/seasons
Public season list — `status IN (ACTIVE, ENDED)` only, newest first. `DRAFT` seasons are admin-only (see `/api/admin/seasons`).

### GET /api/seasons/[id]
A season plus its recorded `SeasonStanding` rows (overall + per group), sorted by `groupId asc, rank asc`. `404` if the season doesn't exist or standings haven't been recorded yet (i.e. season isn't `ENDED`).

### GET /api/groups
Returns the authenticated user's groups.

### GET /api/leagues
Returns all active leagues.

### GET /api/health
Health check endpoint. Returns `{ status: "ok" }`.

---

## Admin API (role=admin)

All admin handlers re-verify `role === 'admin'` inline — layout-level checks are not sufficient.

### GET/POST/PATCH /api/admin/leagues
- **GET** — List all leagues
- **POST `{action: "fetch"}`** — Fetch leagues from football-data.org, upsert current seasons
- **PATCH `{id, isActive}`** — Toggle league active state

### GET/POST/PATCH /api/admin/teams
- **GET** (query: `leagueId`) — List teams for a league
- **POST `{leagueId}`** — Sync teams from football-data.org for that league
- **PATCH `{id, isActive}`** — Toggle team active state in a league

### GET/POST/DELETE /api/admin/matches
- **GET** (query: `page`) — Paginated match list (50/page), each row includes computed odds (`match-service.ts` → `getAdminMatches()`)
- **POST `{action: "fetch", leagueId?}`** — Fetch fixtures for the upcoming week for active leagues, via `matches-processor.ts` → `fetchThisWeekFixtures()`
- **POST `{action: "fetch-next-month", leagueId?}`** — Fetch fixtures for next calendar month, via `fetchNextMonthFixtures()`. Returns `{ inserted, skipped, debug }`.
- **POST `{action: "create-custom", homeTeamName, awayTeamName, kickoffTime}`** — Insert a non-external match and notify users, via `createCustomMatch()`. Returns `{ match }`, 201.
- **POST `{action: "fetch-results"}`** — Trigger `processMatchResults()` for past matches without results. Returns `{ updated, scored }`.
- **POST `{action: "fetch-selective", leagueId, teamIds: number[], days, sendNotifications?}`** — Fetch fixtures for one league restricted to specific teams, over `days` days starting today, via `matches-processor.ts` → `fetchSelectiveFixtures()`. `sendNotifications` (default `true`) controls whether the new-match email/push step runs. Returns `{ inserted, skipped, debug }`.
- **DELETE `{ids: number[]}`** — Bulk-delete matches by id. Returns `{ deleted }`. Any in-flight QStash live-goal chain for a deleted match self-terminates on its next tick — `processLiveGoalTick()` looks the match up by `externalId` and stops re-arming when it's gone (`live-goal-service.ts`), so no explicit QStash cancellation is needed.

### POST /api/admin/results
Manually set results for multiple finished matches and trigger scoring.

### POST /api/admin/results/[matchId]
Manually set the result for a single match and trigger its scoring.

### GET/POST/PATCH /api/admin/users
- **GET** — All users (passwords excluded)
- **POST `{name, email, password, role}`** — Create new user (auto-added to default group)
- **PATCH `{id, name?, role?, password?, notificationEmail?}`** — Update user

### GET/POST/PATCH /api/admin/groups
- **GET** — All groups
- **POST `{name, isDefault?}`** — Create group
- **PATCH `{id, name?, isDefault?}`** — Update group

### GET/POST/PATCH /api/admin/groups/[id]
- **GET** — Group with member list
- **POST `{userId}`** — Add user to group
- **PATCH (delete body)** — Remove user from group

### GET/PATCH /api/admin/scoring-rules
- **GET** — All scoring rules sorted by priority
- **PATCH `{id, points?, isActive?}`** — Update rule points or activation

### POST /api/admin/recalculate
Recalculate all predictions for all finished matches using current active rules. Processes in batches of 100.
Returns `{ updated: number }`.

### POST /api/admin/test-email
Send a test email to the admin's own address to verify SMTP config.

### POST /api/admin/test-notification
Send a push notification to specific users or all users with registered devices.

**Body**: `{ title: string, text: string, userIds?: number[], allUsers?: boolean, link?: string }`

### GET /api/admin/notifications/devices
List registered FCM device tokens for a specific user.

**Query params**: `userId` (number, required)

**Response**: `{ count: number, tokens: [{ id, platform, createdAt }] }`

### POST /api/admin/live-goals/test
Publishes one immediate QStash tick for a match's live-goal chain — exercises the real pipeline (QStash → signature verify → `/api/webhooks/qstash/live-goals` → fetch fixture → diff/notify → rearm) without waiting for kickoff. `400` if the match has no `externalId`. See [Live Goal Notifications](SYSTEM_ARCHITECTURE.md).

**Body**: `{ matchId: number }` (DB id)

**Response**: `{ ok: true, message: string }`

### GET /api/admin/live-goals/matches
Matches eligible for the live-goal test-tick picker — server-side filtered to `externalId != null`, ordered by `kickoffTime desc`, capped at 100. Deliberately separate from `GET /api/admin/matches` (paginated 50/page, unfiltered) so the picker isn't at the mercy of custom (`externalId`-less) matches crowding the first page.

**Response**: `{ matches: [{ id, externalId, homeTeamName, awayTeamName, status, kickoffTime }] }`

### POST /api/admin/calculate-champions
Award the `group_champion` badge to the all-time top scorer in each group.
Returns `{ awarded: number, groups: number, winners: [...] }`.

### GET/POST /api/admin/seasons
- **GET** — All seasons regardless of status, newest first
- **POST `{name, startDate, description?, oddsEnabled?, oddsMin?, oddsMax?}`** — Create a new season in `DRAFT` status. `name` and `startDate` are required.

### POST /api/admin/seasons/[id]/activate
Transitions a `DRAFT` season to `ACTIVE` and retro-assigns any unassigned match (`seasonId: null`) with `kickoffTime >= startDate` to it. `400` if the season isn't `DRAFT` or another season is already `ACTIVE` (only one active season at a time).
Returns `{ season, retroAssigned: number }`.

### POST /api/admin/seasons/[id]/end
Transitions an `ACTIVE` season to `ENDED`: computes final overall + per-group standings (predictions + Champion Bonus points), writes them to `SeasonStanding` (replacing any prior rows for this season), awards `season_champion` / `season_podium` / `group_season_champion` badges, and notifies all users by email + push. `400` if the season isn't `ACTIVE`.
Returns the updated season object.

### GET /api/admin/seasons/[id]/preview
Read-only preview of the same standings computation `end` would record — lets an admin sanity-check rankings before ending the season. No side effects.
Returns `{ overall: [...], perGroup: [...] }`.

### POST /api/admin/seasons/[id]/retro-assign
Re-runs the unassigned-match backfill (same logic as `activate`) without changing season status. Useful if matches were fetched or edited after activation. `400` if the season is still `DRAFT`.
Returns `{ retroAssigned: number }`.

### GET/POST/PATCH/DELETE /api/admin/seasons/[id]/champion-bonus
Manage the season's Champion Bonus config (one league per season).
- `GET` — admin state: `{ enabled, status, league, lockedAt, allowedTeams, pickCount, picks }` (`picks` populated once LOCKED)
- `POST` `{ leagueId, teamIds: number[] }` — enable; requires season not ENDED, no existing config, `teamIds.length >= 2`, every team linked to `leagueId`
- `PATCH` `{ teamIds: number[] }` — replace the allowed team set (OPEN only); removing a team deletes picks on that team
- `DELETE` — cancel: deletes config (cascades teams/picks/awards), leaderboard reverts by construction

### POST /api/admin/seasons/[id]/champion-bonus/lock
Freezes picks (OPEN → LOCKED) and sets `lockedAt`. Only matches kicking off after this timestamp accrue bonus. Rejects if already locked.

---

## Cron API (CRON_SECRET bearer auth)

Cron endpoints accept three auth sources:
- Vercel internal cron: `x-vercel-cron-schedule` header (set automatically by Vercel)
- Manual trigger / scripts: `Authorization: Bearer CRON_SECRET`
- cron-job.org: `Authorization: Bearer TRIGGER_SECRET`

### GET /api/cron/fetch-matches
Fetches upcoming week's fixtures for all active leagues. Inserts new matches. Idempotent.
Returns `{ inserted, skipped, errors, timestamp }`.

### GET /api/cron/fetch-results
Finds all past unfinished matches, fetches results from the football API, scores predictions, updates streaks and badges. Runs daily at 23:00 UTC. Only processes results between 13:00–23:59 UTC.
Returns `{ updated, scored, errors, timestamp }`.

### GET /api/cron/prediction-reminder
Finds scheduled matches in the current week. For each user with unsubmitted predictions, sends a reminder email.
Runs Friday 16:00 UTC (18:00 CLT).

### GET /api/cron/daily-reminder
Finds matches kicking off today (CLT). For each user missing predictions for today's matches, sends an urgent reminder email.
Runs daily 09:00 UTC (11:00 CLT).

### GET /api/cron/db-export
Serializes all Prisma tables to JSON, gzips the payload, and emails it to configured admin recipients.
Runs daily 09:00 UTC (11:00 CLT).

---

## Webhook API (QStash signature auth)

Not part of `/api/cron/*` — auth here is the `Upstash-Signature` header QStash attaches to every delivery, verified via `@upstash/qstash`'s `Receiver` against `QSTASH_CURRENT_SIGNING_KEY`/`QSTASH_NEXT_SIGNING_KEY`, not a bearer token.

### POST /api/webhooks/qstash/live-goals
One tick of a match's live-goal polling chain. See [Live Goal Notifications](SYSTEM_ARCHITECTURE.md) for the full design (self-chaining schedule, score diffing, half-time backoff, safety cap).

**Body** (set by the publisher, not the caller): `{ matchId: number (externalId), tick: number (unix seconds, canonical schedule) }`

**Response**: `{ ok: true, outcome: string }` where `outcome` is one of `ticked`, `not_started_rearmed`, `terminal_finished`, `terminal_postponed`, `terminal_cancelled`, `fetch_failed_rearmed`, `match_not_found`. Returns `401` on an invalid signature, `500` on a processing failure (QStash retries automatically per its retry policy).

---

## Mobile API (/api/mobile/*)

All mobile routes use `Authorization: Bearer {JWT}` obtained from `/api/mobile/auth/login`. Both web and mobile routes share the same service layer and database — only auth and response serialization differ.

### POST /api/mobile/auth/login
Authenticate with email + password. Returns a signed JWT.

**Body**: `{ email: string, password: string }`

**Response**: `{ token: string, user: { id, name, email, role } }`

**Errors**: `401` if credentials invalid.

### GET /api/mobile/matches
Returns upcoming/live/finished matches with the user's prediction attached.

**Query params**: `leagueId` (number), `status` (string), `week` (ISO date string)

### GET /api/mobile/matches/[matchId]
Single match with prediction. Includes `odds` once the match is locked (always for admins), same shape as the web endpoint; the mobile match screen shows the Prediction Odds card to all users from lock time onward.

### GET /api/mobile/matches/[matchId]/group-predictions
Other users' predictions for a match.

**Query params**: `groupId` (number, required), `liveHomeScore` / `liveAwayScore` (number, optional) — same live-points behavior as the web endpoint above.

### GET /api/mobile/matches/[matchId]/h2h
Head-to-head record between the two teams.

### GET /api/mobile/matches/[matchId]/live
Same behavior as the web `/api/matches/[matchId]/live` endpoint above.

### GET /api/mobile/matches/[matchId]/predictions
All predictions for a match (admin-level view or post-kickoff).

### GET /api/mobile/predictions
User's prediction history. Each item includes `baseScore`, `outcomeOdds`, `oddsBonus` (`{ outcomeOdds, baseScore, finalScore }`, null unless season odds were enabled), and `match.odds` (locked 1/X/2 odds + votes, null when never locked).

**Query params**: `groupId` (number)

### GET /api/mobile/predictions/stats
Aggregated prediction stats for the authenticated mobile user.

### POST /api/mobile/predictions
Submit or update a prediction.

**Body**: `{ matchId: string, homeScore: number, awayScore: number }`

### GET /api/mobile/leaderboard
Ranked leaderboard. Entries include `championBonusPoints` (see web `/api/leaderboard`).

**Query params**: `period` (`all` | `week` | `month`), `leagueId` (number), `groupId` (number)

### GET /api/mobile/leaderboard/live
Same payload and semantics as `GET /api/leaderboard/live`, mobile bearer auth.

### GET /api/mobile/leaderboard/user-predictions
A user's scored prediction history for the leaderboard expand. Same semantics as the web endpoint: **scoped to the ACTIVE season** (`[]` when off-season), includes `matchOdds` and `oddsBonus`; `scoringBreakdown` uses the mobile shape `{ key, name, points, awarded }`.

### GET /api/mobile/champion-bonus
Same payload as `GET /api/champion-bonus`, mobile bearer auth.

### POST /api/mobile/champion-bonus/pick
Same as `POST /api/champion-bonus/pick`, mobile bearer auth.

### GET /api/mobile/seasons
Same payload as `GET /api/seasons`, mobile bearer auth — trimmed field set (no odds config).

### GET /api/mobile/seasons/[id]
Same payload as `GET /api/seasons/[id]`, mobile bearer auth — trimmed field set.

### GET /api/mobile/groups
Returns the authenticated user's groups.

### GET /api/mobile/leagues
Returns all active leagues.

### GET /api/mobile/profile
Returns the authenticated user's profile (name, email, avatarUrl, badges, streaks).

### POST /api/mobile/devices
Register an FCM push token for the authenticated user.

**Body**: `{ token: string, platform?: string }`

### DELETE /api/mobile/devices
Remove an FCM push token (on logout or token refresh).

**Body**: `{ token: string }`

---

## Error Response Format

```json
{ "error": "Human-readable error message" }
```

Standard HTTP status codes: `400` bad input, `401` unauthenticated, `403` not admin / forbidden, `404` not found, `500` server error.
