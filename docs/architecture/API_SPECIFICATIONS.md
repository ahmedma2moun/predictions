# API Specifications

## Auth Requirement
All routes except `/api/auth/*` require a valid NextAuth session cookie.
Admin routes additionally require `role === 'admin'` in the JWT.
Cron routes require `Authorization: Bearer {CRON_SECRET}` header.
Job routes (`/api/jobs/check-results`) are verified via QStash signature (`upstash-signature` header).

## Public API (session-authenticated)

### GET /api/matches
Returns upcoming/live/finished matches with user's predictions attached.

**Query params**: `leagueId` (number), `status` (string), `week` (ISO date string)

**Response**: Array of match objects with optional `prediction` field:
```json
[{
  "_id": "...",
  "homeTeam": { "name": "Arsenal", "logo": "https://..." },
  "awayTeam": { "name": "Chelsea", "logo": "https://..." },
  "kickoffTime": "2025-03-15T15:00:00.000Z",
  "status": "scheduled",
  "prediction": { "homeScore": 2, "awayScore": 1, "pointsAwarded": 0 }
}]
```

### GET /api/matches/[matchId]
Single match with user's prediction.

### GET /api/predictions
User's prediction history (populated with match data), limit 100, sorted newest first.

### POST /api/predictions
Submit or update a prediction.

**Body**: `{ matchId: string, homeScore: number, awayScore: number }`

**Errors**:
- `400 Invalid scores` — negative or non-numeric
- `404 Match not found`
- `400 Cannot predict after match has started` — kickoff has passed

### GET /api/leaderboard
Ranked leaderboard with aggregated points.

**Query params**: `period` (all|week|month), `leagueId` (number)

**Response**: Array sorted by totalPoints desc:
```json
[{
  "rank": 1,
  "userId": "...",
  "name": "Ahmed",
  "totalPoints": 42,
  "predictionsCount": 10,
  "accuracy": 70
}]
```

## Admin API (role=admin)

### GET/POST/PATCH /api/admin/leagues
- **GET** — List all leagues
- **POST `{action: "fetch"}`** — Fetch leagues from API-Football, upsert all current seasons
- **PATCH `{id, isActive}`** — Toggle league active state

### GET/POST/PATCH /api/admin/teams
- **GET** (query: `leagueId`) — List teams, optionally filtered by league
- **POST `{leagueId}`** — Sync teams from API-Football for that league
- **PATCH `{id, isActive}`** — Toggle team active state

### GET/POST /api/admin/matches
- **GET** (query: `page`) — Paginated match list (50/page)
- **POST `{action: "fetch", leagueId?}`** — Fetch fixtures for current week (Friday ± 7 days) for active leagues

### GET/POST/PATCH /api/admin/users
- **GET** — All users (passwords excluded)
- **POST `{name, email, password, role}`** — Create new user
- **PATCH `{id, name?, role?, password?}`** — Update user

### GET/PATCH /api/admin/scoring-rules
- **GET** — All scoring rules sorted by priority
- **PATCH `{id, points?, isActive?}`** — Update rule points or activation

### POST /api/admin/recalculate
Recalculate all predictions for all finished matches using current active rules.
Processes in batches of 100. Returns `{ updated: number }`.

## Cron API (CRON_SECRET bearer auth)

### GET /api/cron/fetch-matches
Fetches upcoming week's fixtures for all active leagues. Inserts new matches and schedules one QStash result-check slot per unique kickoff time. Idempotent.
Returns `{ inserted, skipped, errors, timestamp }`.

### GET /api/cron/fetch-results
Safety-net pass. Finds all past unfinished matches, fetches results from the football API, scores predictions. Runs daily at 23:00 UTC to catch anything QStash missed.
Returns `{ updated, scored, errors, timestamp }`.

## Job API

### POST /api/jobs/check-results
**Auth**: QStash signature (`upstash-signature` header — verified via `QSTASH_CURRENT_SIGNING_KEY` / `QSTASH_NEXT_SIGNING_KEY`).

Called by QStash when a result-check slot fires. Processes all matches sharing the slot's `kickoffTime`, scores predictions, and either marks the slot done or reschedules it for 30 minutes later.

**Body**: `{ slotId: string }`

**Response**: `{ slotId, updated, scored, remaining }`

### POST /api/jobs/reschedule-pending
**Auth**: `Authorization: Bearer {CRON_SECRET}`

Emergency endpoint. Re-schedules QStash jobs for all unfinished past-kickoff matches, grouped by kickoff time. Called automatically by `src/instrumentation.ts` on every server start — manual use is only needed in error recovery scenarios.

**Response**: `{ rescheduled, skipped, totalPendingMatches, timestamp }`

## Error Response Format
```json
{ "error": "Human-readable error message" }
```
Standard HTTP status codes: 400 (bad input), 401 (unauthenticated), 403 (not admin), 404 (not found), 500 (server error).
