# System Architecture

## Executive Summary

Football Predictions is a single Next.js 16 application deployed on Vercel. Friends predict football match scores; the app fetches results from football-data.org v4, scores predictions automatically via a pluggable engine, and ranks users on a leaderboard. Admin controls leagues, matches, users, groups, and scoring rules. Automated emails notify users of new matches, results, and prediction reminders.

## Component Architecture

```
src/
├── app/
│   ├── (app)/              # Authenticated route group
│   │   ├── dashboard/      # Stats + upcoming matches overview
│   │   ├── matches/        # Match list + [matchId] prediction form
│   │   ├── predictions/    # User prediction history (tabbed by group)
│   │   ├── leaderboard/    # Ranked table with period + group filters
│   │   └── admin/          # Admin panel
│   │       ├── groups/     # Group management + membership
│   │       ├── leagues/    # League fetch + activation
│   │       ├── matches/    # Fixture fetch + manual override
│   │       ├── results/    # Manual result entry
│   │       ├── scoring/    # Scoring rule editor
│   │       ├── teams/      # Team sync + activation
│   │       └── users/      # User create + edit
│   ├── api/
│   │   ├── auth/           # NextAuth catch-all handler
│   │   ├── groups/         # GET user's groups
│   │   ├── leagues/        # GET active leagues
│   │   ├── matches/        # GET list + GET single match
│   │   ├── predictions/    # GET history, POST submit
│   │   ├── leaderboard/    # GET ranked aggregation
│   │   │   └── user-predictions/ # GET other users' predictions for a match
│   │   ├── admin/
│   │   │   ├── groups/     # CRUD groups + membership
│   │   │   ├── leagues/    # Fetch + activate leagues
│   │   │   ├── matches/    # Fetch + paginate fixtures
│   │   │   ├── results/    # POST manual results
│   │   │   ├── scoring-rules/  # GET + PATCH rules
│   │   │   ├── recalculate/    # POST recalculate all scores
│   │   │   ├── teams/      # Sync + activate teams
│   │   │   ├── test-email/     # POST send test email to self
│   │   │   ├── test-notification/ # POST send push notification to users/all
│   │   │   ├── notifications/devices/ # GET list FCM tokens for a user
│   │   │   ├── calculate-champions/   # POST award group_champion badges
│   │   │   └── users/          # CRUD users
│   │   ├── cron/
│   │   │   ├── fetch-matches     # Thu 18:00 UTC — fetch upcoming fixtures
│   │   │   ├── fetch-results     # Daily 23:00 UTC — safety-net result pass
│   │   │   ├── prediction-reminder # Fri 16:00 UTC — remind unpredicted users
│   │   │   ├── daily-reminder    # Daily 09:00 UTC — remind for today's matches
│   │   │   └── db-export         # Daily 09:00 UTC — JSON backup via email
│   │   ├── mobile/           # Parallel route tree with JWT Bearer auth
│   │   │   ├── auth/login/   # POST credential login → signed JWT
│   │   │   ├── matches/      # GET list; [matchId]/ GET detail, group-predictions, h2h, predictions
│   │   │   ├── predictions/  # GET history, POST submit; stats/ GET stats
│   │   │   ├── leaderboard/  # GET ranked; user-predictions/ GET other users' picks
│   │   │   ├── groups/       # GET user's groups
│   │   │   ├── leagues/      # GET active leagues
│   │   │   ├── devices/      # POST/DELETE FCM token registration
│   │   │   └── profile/      # GET user profile
│   ├── login/              # Public login page
│   └── layout.tsx          # Root layout (dark mode, Inter font, Toaster)
├── lib/
│   ├── prisma.ts           # Prisma singleton — single source of DB access
│   ├── db.ts               # No-op shim (Mongoose migration artifact — do not use)
│   ├── auth.ts             # NextAuth config — JWT, credentials, role callbacks
│   ├── mobile-auth.ts      # JWT sign/verify for mobile clients
│   ├── football/           # Football external service layer
│   │   ├── service.ts      # Public API — all callers import from here
│   │   ├── factory.ts      # Provider factory (reads FOOTBALL_PROVIDER env var)
│   │   ├── types.ts        # Normalized types + IFootballProvider interface + mapFixtureStatus
│   │   └── providers/
│   │       ├── football-data.ts  # football-data.org v4 implementation (default)
│   │       └── api-football.ts   # API-Football (RapidAPI) alternative — activate via FOOTBALL_PROVIDER=api-football
│   ├── scoring-engine.ts   # calculateScore() — only place scoring logic lives
│   ├── utils.ts            # formatKickoff(), isMatchLocked(), getWinner()
│   ├── leaderboard.ts      # Leaderboard aggregation logic
│   ├── matches-processor.ts  # Fixture upsert (fetch-matches cron)
│   ├── results-processor.ts  # Result update + scoring (fetch-results cron + admin)
│   ├── standings.ts        # TeamStanding cache + football-data.org standings fetch
│   ├── client-api.ts       # Typed fetch helpers for client components
│   ├── email.ts            # Nodemailer (Gmail) — new-matches, results, reminders
│   ├── services/           # Service layer — all DB query logic lives here
│   │   ├── match-service.ts        # getMatches(), getMatchById()
│   │   ├── prediction-service.ts   # getUserPredictions(), upsertPrediction(), getUserPredictionHistory()
│   │   ├── leaderboard-service.ts  # getLeaderboard()
│   │   ├── group-service.ts        # getUserGroups()
│   │   ├── league-service.ts       # getActiveLeagues()
│   │   ├── user-service.ts         # getAllUsers(), createUser(), updateUser(), checkEmailExists()
│   │   ├── team-service.ts         # getByLeagueId(), syncTeamWithLeague(), deleteOrphansForLeague()
│   │   ├── scoring-rule-service.ts # getAll(), update() — scoring rule CRUD
│   │   ├── device-service.ts       # FCM token CRUD (getAll, create, upsert, remove, removeMany)
│   │   └── streak-badge-service.ts # updateStreaksAndBadges(), awardAllTimeGroupChampions()
│   ├── repositories/       # Thin Prisma wrappers — called by services, not route handlers
│   │   ├── match-repository.ts, prediction-repository.ts, league-repository.ts
│   │   ├── team-repository.ts, team-league-repository.ts, group-repository.ts
│   │   ├── group-member-repository.ts, user-repository.ts, device-repository.ts
│   │   ├── scoring-rule-repository.ts, team-standing-repository.ts
│   │   └── system-repository.ts   # Cross-model raw SQL helpers
│   └── export/
│       ├── config.ts       # Export output dir + Gmail recipients
│       ├── job.ts          # runExportJob() — serialize → gzip → email
│       ├── serializer.ts   # Prisma → JSON dump with BigInt/Date handling
│       └── email.ts        # Export notification + alert email templates
├── models/                 # TypeScript interfaces + serializeMatch() (not Mongoose)
│   ├── Match.ts            # IMatch + serializeMatch()
│   ├── League.ts, Team.ts, User.ts, Prediction.ts, ScoringRule.ts
├── components/
│   ├── KickoffTime.tsx     # Client-side kickoff display with live lock detection
│   ├── LiveLockIcon.tsx    # Animated lock icon for ongoing matches
│   ├── Navbar.tsx          # Bottom nav (mobile) / top nav (desktop)
│   ├── SessionProvider.tsx # NextAuth client wrapper
│   └── ui/                 # shadcn/ui primitives
├── types/
│   └── index.ts            # Shared TypeScript types (SerializedMatch etc.)
└── proxy.ts                # Route protection — wraps auth() from NextAuth
```

## Service Layer Architecture

All DB query logic lives in `src/lib/services/`. Route handlers (both `/api/*` and `/api/mobile/*`) are controllers that do exactly three things: **authenticate → call service → serialize response**.

```
                   Web request                Mobile request
                        │                          │
              GET /api/matches            GET /api/mobile/matches
                        │                          │
               auth() [NextAuth]        getMobileSession() [JWT Bearer]
                        │                          │
                        └──────────┬───────────────┘
                                   │
                          matchService.getMatches()
                                   │
                        ┌──────────┴──────────┐
                        │   prisma queries     │
                        │   standings fetch    │
                        │   prediction lookup  │
                        └──────────┬──────────┘
                                   │
                   ┌───────────────┴───────────────┐
                   │                               │
          serializeMatch()              serializeMatchForMobile()
          (web response)                  (mobile response)
```

**Service catalogue:**

| Service | Key Methods | Used by |
|---|---|---|
| `match-service.ts` | `getMatches()`, `getMatchById()` | `/api/matches`, `/api/mobile/matches` |
| `prediction-service.ts` | `getUserPredictions()`, `upsertPrediction()`, `getUserPredictionHistory()` | `/api/predictions`, `/api/mobile/predictions`, leaderboard routes |
| `leaderboard-service.ts` | `getLeaderboard()` | `/api/leaderboard`, `/api/mobile/leaderboard` |
| `group-service.ts` | `getUserGroups()` | `/api/groups`, `/api/mobile/groups` |
| `league-service.ts` | `getActiveLeagues()` | `/api/leagues`, `/api/mobile/leagues` |
| `user-service.ts` | `getAllUsers()`, `createUser()`, `updateUser()`, `checkEmailExists()` | `/api/admin/users`, auth |
| `team-service.ts` | `getByLeagueId()`, `syncTeamWithLeague()`, `deleteOrphansForLeague()`, `getActiveTeamsByLeagueMap()` | `/api/admin/teams`, fixture processor |
| `scoring-rule-service.ts` | `getAll()`, `update()` | `/api/admin/scoring-rules` |
| `device-service.ts` | `getAll()`, `create()`, `upsert()`, `remove()`, `removeMany()` | `/api/mobile/devices`, `/api/admin/notifications/devices`, push notifications |
| `streak-badge-service.ts` | `updateStreaksAndBadges()`, `awardAllTimeGroupChampions()` | `results-processor.ts`, `/api/admin/calculate-champions` |

Services return neutral data (raw Prisma models + derived fields). Serialization is always the route handler's responsibility.

Services call repositories (`src/lib/repositories/`), not Prisma directly. Route handlers call services, never repositories.

## Mobile API Layer

The mobile app (React Native / Expo) calls a parallel route tree `/api/mobile/*` that uses JWT Bearer authentication instead of NextAuth cookies. Both trees share the same service layer and database.

```
Web browser                              Mobile app
     │                                       │
NextAuth session (httpOnly cookie)    JWT Bearer token (SecureStore)
     │                                       │
/api/matches                         /api/mobile/matches
/api/predictions                     /api/mobile/predictions
/api/leaderboard                     /api/mobile/leaderboard
/api/groups                          /api/mobile/groups
/api/leagues                         /api/mobile/leagues
     │                                       │
     └──────────────┬────────────────────────┘
                    │
             lib/services/*  (shared)
                    │
             PostgreSQL (shared)
```

Mobile-specific routes additionally exist for:
- `POST /api/mobile/auth/login` — credential login returning a signed JWT
- `POST/DELETE /api/mobile/devices` — FCM push token registration
- `GET /api/mobile/profile` — user profile

## Primary Request Flow — Submit Prediction

```
User → matches/[matchId] page
  → fetch /api/matches/[matchId]
      → auth() check
      → matchService.getMatchById(id, { userId, isAdmin })
          → prisma.match.findUnique
          → prisma.prediction.findFirst
          → getStandingsMap()
      → serializeMatch() + shape allPredictions
  → user adjusts scores with +/- buttons
  → POST /api/predictions
      → auth() check
      → predictionService.upsertPrediction(userId, matchId, homeScore, awayScore)
          → prisma.match.findUnique (existence + lock check)
          → isMatchLocked(match.kickoffTime)
          → prisma.prediction.upsert (unique: userId+matchId)
  → toast success → redirect /matches
```

## Scoring Engine (`src/lib/scoring-engine.ts`)

Rules loaded from `ScoringRule` table. Two evaluation tracks:

```
Prediction + Result
       │
       ├─ correct_winner  ──────────────────────► +2 pts (independent)
       │
       └─ tiered (mutually exclusive, highest wins)
              │
              ├─ exact_score?      ──────────────► +5 pts
              │    │ no
              ├─ score_difference? ──────────────► +3 pts
              │    │ no
              └─ one_team_score?   ──────────────► +1 pt
```

Max possible per match: **7 points** (correct_winner + exact_score).

## Result Fetching Flow

```
fetch-matches cron runs
    │
    └─ inserts new matches into DB
```

## Cron Job Flows

**fetch-matches** (Thursday 18:00 UTC):
1. Load all active leagues
2. For each: call football-data.org `/competitions/{id}/matches?dateFrom=…&dateTo=…`
3. Check `externalId` existence, then `createMany()` — never overwrites existing
4. Send "new matches" email to each user with `notificationEmail` set
5. Returns `{ inserted, skipped, errors }`

**fetch-results** (daily 23:00 UTC):
1. Queries any match with `kickoffTime < now` and `status NOT IN (finished, cancelled)`
2. Groups by league — one football-data.org API call per league
3. Updates finished matches: `status`, `resultHomeScore`, `resultAwayScore`, `resultWinner`
4. Scores predictions via `calculateScore()`, marks `scoresProcessed = true`
5. Sends results email to affected users
6. Refreshes league standings

**prediction-reminder** (Friday 16:00 UTC):
1. Find all scheduled matches in the current week with kickoff in the future
2. For each user: find matches without a prediction
3. Send reminder email if any unpredicted matches remain

**daily-reminder** (daily 09:00 UTC):
1. Find all scheduled matches kicking off today (CLT)
2. For each user: find today's matches without a prediction
3. Send urgent reminder email if any unpredicted matches remain

**db-export** (daily 09:00 UTC):
1. Serialize all Prisma tables to JSON
2. Gzip if over threshold
3. Email export file to configured recipients (admin)

## Technology Stack

| Component | Package | Version | Purpose |
|---|---|---|---|
| Framework | next | 16.2.1 | App Router, RSC, API routes |
| Language | typescript | 5.x | Type safety |
| Auth | next-auth | 5.0.0-beta.30 | JWT sessions, credentials provider |
| ORM | prisma | 6.19.3 | PostgreSQL schema + migrations |
| Passwords | bcryptjs | 3.0.3 | Password hashing (cost 12) |
| Email | nodemailer | — | Gmail SMTP for notifications |
| UI | tailwindcss | 4.x | Utility-first CSS |
| Components | shadcn/ui (radix-ui) | — | Accessible UI primitives |
| Icons | lucide-react | 0.577.0 | Icon set |
| Dates | date-fns | 4.1.0 | UTC/CLT conversion, formatting |
| Toast | sonner | 2.0.7 | Notifications |

## Architecture Decision Records

### ADR-1: NextAuth v5 JWT over database sessions
**Decision**: Use JWT session strategy, not database sessions.
**Rationale**: Vercel serverless functions are stateless. Database sessions require an extra DB read on every request. JWT avoids this while still allowing role-based access via token claims.

### ADR-2: Existence-check + createMany for match inserts
**Decision**: Check `externalId` existence first, then `createMany()` — no upsert.
**Rationale**: Prisma lacks MongoDB's `$setOnInsert` semantics. A naive upsert would overwrite admin-edited fields (status, result). The existence check ensures only genuinely new fixtures are inserted.

### ADR-3: Tiered scoring (mutually exclusive)
**Decision**: exact_score > score_difference > one_team_score are mutually exclusive.
**Rationale**: These three rules measure overlapping aspects of score accuracy. Allowing all simultaneously would unfairly reward lucky partial guesses alongside exact matches.

### ADR-4: Admin creates all accounts
**Decision**: No self-registration — admin creates accounts for friends.
**Rationale**: Private group app. Closed registration prevents spam and keeps the leaderboard meaningful.

### ADR-5: Migrated from MongoDB/Mongoose to PostgreSQL/Prisma
**Decision**: Replace Mongoose ODM with Prisma + PostgreSQL.
**Rationale**: Relational integrity (foreign keys, cascades) better fits the prediction/match/user model. Free tiers on Supabase and Neon are production-grade. `src/lib/db.ts` is a no-op shim kept for import compatibility — never call `connectDB()`.

### ADR-6: Migrated from API-Football (RapidAPI) to football-data.org v4
**Decision**: Replace RapidAPI/API-Football with football-data.org v4 directly.
**Rationale**: Eliminates RapidAPI middleman and billing. football-data.org free tier provides 10 req/min which is sufficient for cron-based fetching. Public interface (`APIFixture`, `APILeague`, etc.) is unchanged — only the internal HTTP client changed.

### ADR-7: notificationEmail separate from login email
**Decision**: Users have an optional `notificationEmail` field distinct from `email`.
**Rationale**: Some users log in with a work email but prefer notifications to a personal address. Decoupling the two avoids forcing users to change their login credential.

### ADR-8: Repository layer between services and Prisma
**Decision**: Introduce `src/lib/repositories/` as thin wrappers around Prisma CRUD operations. Services call repositories; route handlers call services.
**Rationale**: Keeps query construction (where/select/include) out of service business logic, making each layer independently testable and swappable.

### ADR-9: Service layer between route handlers and the database
**Decision**: All Prisma queries live in `src/lib/services/`. Route handlers do only: authenticate → call service → serialize.
**Rationale**: Before this, `/api/matches` and `/api/mobile/matches` duplicated identical DB query logic, differing only in the auth check. Any business change (new filter, new field, DB query fix) had to be applied in two places and could drift. The service layer makes both route trees call the same method. Serialization (`serializeMatch` vs `serializeMatchForMobile`) stays in the route handler because the two clients genuinely need different response shapes.

### ADR-10: Football provider abstraction layer
**Decision**: Introduce `src/lib/football/` — a provider interface (`IFootballProvider`), a factory (`factory.ts`), and a thin service layer (`service.ts`). All callers import from `service.ts`; provider implementations live under `providers/`.
**Rationale**: Previously `football-api.ts` was the single hardwired football-data.org client. Switching providers (e.g. to API-Football or OpenLigaDB) required modifying the client and verifying every caller still worked. With the abstraction: define `IFootballProvider`, implement it for the new provider, add one `case` in `factory.ts`, set `FOOTBALL_PROVIDER` in the environment — `service.ts` and all 6 callers remain unchanged. The normalized types (`APIFixture`, `APILeague`, etc.) in `types.ts` are the stable contract regardless of provider.
