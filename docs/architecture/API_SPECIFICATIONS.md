# API Specifications

## Auth Requirements

| Route group | Required auth |
|---|---|
| `/api/auth/*` | None (NextAuth handlers) |
| `/api/*` (public) | Valid NextAuth session cookie |
| `/api/admin/*` | Session + `role === 'admin'` |
| `/api/cron/*` | `Authorization: Bearer {CRON_SECRET}` **or** `Authorization: Bearer {TRIGGER_SECRET}` **or** `x-vercel-cron-schedule` header |
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
Single match with the user's prediction and all group members' predictions (when finished).

### GET /api/matches/[matchId]/group-predictions
Other users' predictions for a specific match (used to show group picks before and after kickoff).

### GET /api/matches/[matchId]/h2h
Head-to-head record between the two teams from historical match data.

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
  "predictionsCount": 10,
  "accuracy": 70
}]
```

### GET /api/leaderboard/user-predictions
Another user's prediction list for a specific match (used on leaderboard detail).

**Query params**: `userId` (number), `matchId` (number)

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

### GET/POST /api/admin/matches
- **GET** (query: `page`) — Paginated match list (50/page)
- **POST `{action: "fetch", leagueId?}`** — Fetch fixtures for the upcoming week for active leagues

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

### POST /api/admin/calculate-champions
Award the `group_champion` badge to the all-time top scorer in each group.
Returns `{ awarded: number, groups: number, winners: [...] }`.

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
Single match with prediction.

### GET /api/mobile/matches/[matchId]/group-predictions
Other users' predictions for a match.

### GET /api/mobile/matches/[matchId]/h2h
Head-to-head record between the two teams.

### GET /api/mobile/matches/[matchId]/predictions
All predictions for a match (admin-level view or post-kickoff).

### GET /api/mobile/predictions
User's prediction history.

**Query params**: `groupId` (number)

### GET /api/mobile/predictions/stats
Aggregated prediction stats for the authenticated mobile user.

### POST /api/mobile/predictions
Submit or update a prediction.

**Body**: `{ matchId: string, homeScore: number, awayScore: number }`

### GET /api/mobile/leaderboard
Ranked leaderboard.

**Query params**: `period` (`all` | `week` | `month`), `leagueId` (number), `groupId` (number)

### GET /api/mobile/leaderboard/user-predictions
Another user's predictions for a specific match.

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
