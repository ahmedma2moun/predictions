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
│   │   ├── champion/       # Champion Bonus — pick view (OPEN) / reveal view (LOCKED); hidden from nav, reachable by URL
│   │   ├── seasons/        # Season list + standings (public read view)
│   │   └── admin/          # Admin panel
│   │       ├── groups/     # Group management + membership
│   │       ├── leagues/    # League fetch + activation
│   │       ├── matches/    # Fixture fetch + manual override
│   │       ├── results/    # Manual result entry
│   │       ├── scoring/    # Scoring rule editor
│   │       ├── teams/      # Team sync + activation
│   │       ├── seasons/    # Season lifecycle + ChampionBonusAdminPanel (per season card)
│   │       └── users/      # User create + edit
│   ├── api/
│   │   ├── health/         # GET liveness check (no auth)
│   │   ├── auth/           # NextAuth catch-all handler
│   │   ├── groups/         # GET user's groups
│   │   ├── leagues/        # GET active leagues
│   │   ├── matches/        # GET list + GET single match
│   │   │   └── [matchId]/  # group-predictions/ GET group's picks; form/ GET each team's last 5 games side by side; live/ GET in-play score (30s cached)
│   │   ├── predictions/    # GET history, POST submit; stats/ GET streak + badge summary
│   │   ├── leaderboard/    # GET ranked aggregation
│   │   │   ├── live/       # GET live group standing (provisional in-play points + rank movement) — consumed by the match page's Group Comparison
│   │   │   └── user-predictions/ # GET a user's scored history (active season only, with odds)
│   │   ├── champion-bonus/   # GET user state; pick/ POST set pick
│   │   ├── seasons/          # GET public seasons (ACTIVE + ENDED); [id]/ GET season + standings
│   │   ├── admin/
│   │   │   ├── groups/     # CRUD groups + membership
│   │   │   ├── leagues/    # Fetch + activate leagues
│   │   │   ├── matches/    # Fetch + paginate fixtures
│   │   │   ├── results/    # POST manual results; [matchId]/ POST override, calculate/ POST rescoring
│   │   │   ├── scoring-rules/  # GET + PATCH rules
│   │   │   ├── recalculate/    # POST recalculate all scores (+ Champion Bonus safety-net recompute)
│   │   │   ├── teams/      # Sync + activate teams
│   │   │   ├── test-email/     # POST send test email to self
│   │   │   ├── test-notification/ # POST send push notification to users/all
│   │   │   ├── notifications/devices/ # GET list FCM tokens for a user
│   │   │   ├── calculate-champions/   # POST award group_champion badges
│   │   │   ├── seasons/     # GET all seasons (any status), POST create (DRAFT)
│   │   │   │   └── [id]/    # activate/ POST DRAFT→ACTIVE + retro-assign; end/ POST ACTIVE→ENDED + record standings; preview/ GET live champion preview; retro-assign/ POST backfill matches; champion-bonus/ GET/POST/PATCH/DELETE config, lock/ POST lock picks
│   │   │   └── users/          # CRUD users
│   │   ├── cron/
│   │   │   ├── fetch-matches     # QStash schedule, Thu 8 PM Cairo local — fetch upcoming fixtures
│   │   │   ├── fetch-results     # Unscheduled — safety-net result pass, results normally come from the live-goal chain
│   │   │   ├── prediction-reminder # Unscheduled (deprecated) — weekly unpredicted-users reminder
│   │   │   ├── daily-reminder    # QStash schedule, daily 09:00 UTC — remind for today's matches
│   │   │   └── db-export         # QStash schedule, daily 09:00 UTC — JSON backup via email
│   │   ├── mobile/           # Parallel route tree with JWT Bearer auth
│   │   │   ├── auth/login/   # POST credential login → signed JWT
│   │   │   ├── matches/      # GET list; [matchId]/ GET detail, group-predictions, form, live, predictions
│   │   │   ├── predictions/  # GET history, POST submit; stats/ GET stats
│   │   │   ├── leaderboard/  # GET ranked; live/ GET live group standing; user-predictions/ GET a user's scored history (active season only)
│   │   │   ├── champion-bonus/  # GET user state; pick/ POST set pick
│   │   │   ├── seasons/      # GET public seasons; [id]/ GET season + standings
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
│   │   ├── types.ts        # Normalized types (incl. APIMatchEvent) + IFootballProvider interface + mapFixtureStatus
│   │   └── providers/
│   │       ├── football-data.ts  # football-data.org v4 implementation (default)
│   │       ├── api-football.ts   # API-Football (RapidAPI) alternative — activate via FOOTBALL_PROVIDER=api-football
│   │       ├── thesportsdb.ts     # TheSportsDB v2 alternative — activate via FOOTBALL_PROVIDER=thesportsdb (requires paid THESPORTSDB_API_KEY)
│   │       └── mock.ts           # In-memory provider for tests/local dev — FOOTBALL_PROVIDER=mock, setMockFixtures()/clearMock()
│   ├── scoring-engine.ts   # calculateScore() — only place scoring logic lives
│   ├── odds.ts             # calcMatchOdds(), calcFinalScore(), lockMatchOdds(), getLiveMatchOdds()
│   ├── feature-flags.ts    # ODDS_FEATURE_ENABLED — global kill switch, no server-only imports (safe for client components too)
│   ├── utils.ts            # formatKickoff(), isMatchLocked(), getWinner()
│   ├── validation.ts       # ValidationError + requireString()/requireDate()/requireOneOf() — thrown, caught by withErrorHandling()
│   ├── api-handler.ts      # withErrorHandling() — shared route try/catch: ValidationError → 400, else logged + generic 500
│   ├── query-params.ts     # parseLeaderboardQuery() — shared leagueId/groupId/from/to searchParams parsing
│   ├── leaderboard.ts      # Leaderboard aggregation logic
│   ├── matches-processor.ts  # fetchAndInsertMatches(), fetchThisWeekFixtures(), fetchNextMonthFixtures(), createCustomMatch(), notifyUsersOfNewMatches() (fetch-matches cron + admin/matches)
│   ├── results-processor.ts  # Result update + scoring (fetch-results cron + admin)
│   ├── standings.ts        # TeamStanding cache + football-data.org standings fetch
│   ├── client-api.ts       # Typed fetch helpers for client components
│   ├── email.ts            # Nodemailer (Gmail) — new-matches, results, reminders
│   ├── services/           # Service layer — all DB query logic lives here
│   │   ├── match-service.ts        # getMatches(), getMatchById()
│   │   ├── prediction-service.ts   # getUserPredictions(), upsertPrediction(), getUserPredictionHistory()
│   │   ├── leaderboard-service.ts  # getLeaderboard()
│   │   ├── live-standing-service.ts # getLiveGroupStanding() — leaderboard + provisional in-play points + movement
│   │   ├── group-service.ts        # getUserGroups()
│   │   ├── league-service.ts       # getActiveLeagues()
│   │   ├── user-service.ts         # getAllUsers(), createUser(), updateUser(), checkEmailExists()
│   │   ├── team-service.ts         # getByLeagueId(), syncTeamWithLeague(), deleteOrphansForLeague()
│   │   ├── scoring-rule-service.ts # getAll(), update() — scoring rule CRUD
│   │   ├── device-service.ts       # FCM token CRUD (getAll, create, upsert, remove, removeMany)
│   │   ├── streak-badge-service.ts # updateStreaksAndBadges(), awardAllTimeGroupChampions()
│   │   ├── champion-bonus-service.ts # enable/updateTeams/lock/cancel, getAdminState/getUserState, setPick, processFinishedMatch, recomputeSeason
│   │   └── season-service.ts # getActiveSeason/getAllSeasons/getPublicSeasons, createSeason, activateSeason, endSeason, retroAssign, getChampionPreview
│   ├── repositories/       # Thin Prisma wrappers — called by services, not route handlers
│   │   ├── match-repository.ts, prediction-repository.ts, league-repository.ts
│   │   ├── team-repository.ts, team-league-repository.ts, group-repository.ts
│   │   ├── group-member-repository.ts, user-repository.ts, device-repository.ts
│   │   ├── scoring-rule-repository.ts, team-standing-repository.ts, season-repository.ts
│   │   ├── champion-bonus-repository.ts  # config/teams/picks/awards CRUD + getBonusStats() raw SQL
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
| `match-service.ts` | `getMatches()`, `getMatchById()`, `getAdminMatches()` (paginated list + computed odds/vote pool, no raw Prisma in the route) | `/api/matches`, `/api/mobile/matches`, `/api/admin/matches` |
| `prediction-service.ts` | `getUserPredictions()`, `upsertPrediction()`, `getUserPredictionHistory()` (supports `seasonId` filter; returns `baseScore`, `outcomeOdds`, locked `matchOdds`) | `/api/predictions`, `/api/mobile/predictions`, leaderboard routes |
| `leaderboard-service.ts` | `getLeaderboard()` | `/api/leaderboard`, `/api/mobile/leaderboard` |
| `live-standing-service.ts` | `getLiveGroupStanding()` — base leaderboard + provisional points from in-play matches (live scores via `fetchFixtureById` 30s cache), rank movement `up`/`down`/`same` | `/api/leaderboard/live`, `/api/mobile/leaderboard/live` |
| `group-service.ts` | `getUserGroups()` | `/api/groups`, `/api/mobile/groups` |
| `league-service.ts` | `getActiveLeagues()` | `/api/leagues`, `/api/mobile/leagues` |
| `user-service.ts` | `getAllUsers()`, `createUser()`, `updateUser()`, `checkEmailExists()` | `/api/admin/users`, auth |
| `team-service.ts` | `getByLeagueId()`, `syncTeamWithLeague()`, `deleteOrphansForLeague()`, `getActiveTeamsByLeagueMap()` | `/api/admin/teams`, fixture processor |
| `scoring-rule-service.ts` | `getAll()`, `update()` | `/api/admin/scoring-rules` |
| `device-service.ts` | `getAll()`, `create()`, `upsert()`, `remove()`, `removeMany()` | `/api/mobile/devices`, `/api/admin/notifications/devices`, push notifications |
| `streak-badge-service.ts` | `updateStreaksAndBadges()`, `awardAllTimeGroupChampions()` | `results-processor.ts`, `/api/admin/calculate-champions` |
| `champion-bonus-service.ts` | `enable()`/`updateTeams()`/`lock()`/`cancel()`, `getAdminState()`/`getUserState()`, `setPick()`, `processFinishedMatch()`, `recomputeSeason()` | `/api/champion-bonus`, `/api/mobile/champion-bonus`, `/api/admin/seasons/[id]/champion-bonus` |
| `season-service.ts` | `getActiveSeason()`, `getAllSeasons()`, `getPublicSeasons()`, `getSeasonWithStandings()`, `createSeason()`, `activateSeason()` (DRAFT→ACTIVE + retro-assign), `endSeason()` (ACTIVE→ENDED + records `SeasonStanding` + awards season badges), `retroAssign()`, `getChampionPreview()` | `/api/seasons`, `/api/mobile/seasons`, `/api/admin/seasons` |

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
/api/seasons                         /api/mobile/seasons
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

**fetch-matches** (QStash schedule, Thursday 8 PM Cairo local):
1. Load all active leagues
2. For each: call football-data.org `/competitions/{id}/matches?dateFrom=…&dateTo=…`
3. Check `externalId` existence, then `createMany()` — never overwrites existing
4. Send "new matches" email to each user with `notificationEmail` set
5. Returns `{ inserted, skipped, errors }`

**fetch-results** (unscheduled — no QStash schedule or cron trigger; kept only as a manually-invoked safety net):
1. Queries any match with `kickoffTime < now` and `status NOT IN (finished, cancelled)`
2. Groups by league — one football-data.org API call per league
3. Updates finished matches: `status`, `resultHomeScore`, `resultAwayScore`, `resultWinner`
4. Scores predictions via `calculateScore()`, marks `scoresProcessed = true`
5. Sends results email to affected users
6. Refreshes league standings

In normal operation this same logic runs per-match, near-real-time, via `processFinishedMatchRealtime()` inside the live-goal QStash chain (see "Live Goal Notifications" below) — that's the actual result-fetching path in production.

**prediction-reminder** (unscheduled/deprecated — route still exists, nothing calls it):
1. Find all scheduled matches in the current week with kickoff in the future
2. For each user: find matches without a prediction
3. Send reminder email if any unpredicted matches remain

**daily-reminder** (QStash schedule, daily 09:00 UTC):
1. Find all scheduled matches kicking off today (CLT)
2. For each user: find today's matches without a prediction
3. Send urgent reminder email if any unpredicted matches remain
4. No-ops cleanly if there are no matches today — this is what makes a fixed daily schedule correct for "remind only on days with a match"

**db-export** (QStash schedule, daily 09:00 UTC):
1. Serialize all Prisma tables to JSON
2. Gzip if over threshold
3. Email export file to configured recipients (admin)

## Live Goal Notifications

Vercel cron can't run per-resource dynamic schedules (jobs are static, declared in `vercel.json` at deploy time, and Hobby caps invocation frequency). Instead, each match gets its own **self-chaining QStash schedule**, registered when the match row is inserted:

```
fetchAndInsertMatches() inserts new fixtures
    │
    └─ registerLiveGoalChain() — publishes one QStash message,
       notBefore = kickoffTime + KICKOFF_GRACE_SECONDS (1 min),
       body = { matchId: externalId, tick: kickoffTimeUnix + KICKOFF_GRACE_SECONDS }
                        │
                        ▼
   QStash delivers → POST /api/webhooks/qstash/live-goals
   (Upstash-Signature verified against QSTASH_CURRENT/NEXT_SIGNING_KEY)
                        │
                        ▼
              processLiveGoalTick(externalId, tick)
    │
    ├─ fetchFixtureById() (30s-cached, ADR-11)
    │
    ├─ status finished/postponed/cancelled → update Match.status, stop (no rearm)
    ├─ status scheduled (delayed kickoff)   → rearm in PRE_KICKOFF_POLL_SECONDS
    └─ status live:
         ├─ compare-and-swap Match.liveHomeScore/liveAwayScore against the
         │  fetched goals (guards against QStash's at-least-once delivery
         │  double-firing the same tick and sending a duplicate push)
         ├─ if this is the first tick to see Match.status flip to 'live'
         │  (same CAS claim) → sendPushToUsers() "Kick-off!" to that match's
         │  predictors (data.type = 'match_started')
         ├─ if score advanced → sendPushToUsers() to that match's predictors,
         │  scorer name/minute pulled from fixture.events when available
         │  (data.type = 'goal')
         └─ rearm: LIVE_POLL_INTERVAL_SECONDS (1.5 min), or
                   HALF_TIME_POLL_SECONDS (10 min) during HT
```

The chain's first tick is scheduled `KICKOFF_GRACE_SECONDS` (1 min, config in `src/lib/live-goal-config.ts`) after `kickoffTime` rather than exactly at kickoff, giving the provider a moment to flip the fixture to `live` so the first poll isn't wasted on a still-`scheduled` status.

Each rearm publishes a new QStash message with a deterministic `deduplicationId` derived from the *canonical* schedule tick (not wall-clock time), so a QStash retry of the same invocation can't fork a duplicate parallel chain. A per-match jitter (`externalId % 30` seconds) is applied only to the delivery time, not the canonical schedule, to spread matches that kick off simultaneously across QStash's parallelism pool without the offset compounding over the chain's lifetime. A hard cap (`MAX_CHAIN_HOURS`, config in `src/lib/live-goal-config.ts`) stops the chain if a match never reports `finished`.

The mobile app routes both `goal` and `match_started` push notifications to that match's detail screen (`src/notifications/route-for-notification.ts`).

Admin test hook: `POST /api/admin/live-goals/test` (Admin → Notifications page) publishes one immediate tick for a chosen match, exercising the full pipeline without waiting for kickoff.

Key files: `src/lib/live-goal-config.ts` (tunable constants), `src/lib/qstash.ts` (Client/Receiver singletons), `src/lib/live-goal-service.ts` (tick logic + chain registration), `src/app/api/webhooks/qstash/live-goals/route.ts`.

## Match Kickoff Reminders

Same self-chaining-schedule idea as Live Goal Notifications, but a single one-shot QStash message instead of a chain — every user gets reminded about every upcoming match 60 minutes before kickoff, regardless of whether they've predicted it (this is deliberately unfiltered, unlike `prediction-reminder`/`daily-reminder`, which only nudge users with missing predictions):

```
fetchAndInsertMatches() inserts new fixtures
    │
    └─ registerMatchReminderChain() — publishes one QStash message per fixture,
       notBefore = kickoffTime - 60min, body = { externalId }
       (skipped if kickoff is already inside the 60-minute window)
                        │
                        ▼
   QStash delivers → POST /api/webhooks/qstash/match-reminder
   (Upstash-Signature verified against QSTASH_CURRENT/NEXT_SIGNING_KEY)
                        │
                        ▼
              sendMatchKickoffReminder(externalId)
    │
    ├─ match missing or status no longer 'scheduled' (postponed/cancelled) → no-op
    └─ otherwise: email every user with a notificationEmail set, and push
       every user with a registered device token — prediction status ignored
```

No re-arming — this fires exactly once per match. A `flowControl` key (`match-reminders`, parallelism 3) keeps several fixtures sharing the same kickoff slot from all firing their full email/push broadcast in the same instant.

Key files: `src/lib/match-reminder-service.ts` (scheduling + reminder logic), `src/app/api/webhooks/qstash/match-reminder/route.ts`, `sendKickoffReminderEmail()` in `src/lib/email.ts`. Mobile push type `match_reminder` (like `goal`) routes straight to that match's detail screen via `data.matchId`, falling back to the Matches tab if `matchId` is missing (`mobile/src/notifications/route-for-notification.ts`).

**Mobile tap-routing gotcha**: the Android build links both `@react-native-firebase/messaging` (native module, used only for iOS FCM token minting in JS) and `expo-notifications`. Both declare a `com.google.firebase.MESSAGING_EVENT` service in the manifest, but Expo's own service is registered at `android:priority="-1"` — lower than RNFirebase's default — so RNFirebase always wins the race and is the library that actually receives a tapped notification on Android. `mobile/app/_layout.tsx` therefore routes taps through `messaging().onNotificationOpenedApp()` / `messaging().getInitialNotification()` (exposed via `getMessaging()` in `mobile/src/notifications/push.ts`) rather than `expo-notifications`' own response listeners, falling back to the latter only when the native RNFirebase module isn't present (Expo Go). Using the expo-notifications listeners as the primary path silently drops `data` on every tap, regardless of type — a past regression.

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

### ADR-11: 30s shared cache on `fetchFixtureById` for live-score polling
**Decision**: `service.ts#fetchFixtureById()` caches the in-flight/resolved promise per `fixtureId` for 30 seconds (module-level `Map`, evicted on failure) before delegating to the provider.
**Rationale**: The live-score feature (`/api/matches/[matchId]/live`, `/api/mobile/matches/[matchId]/live`) originally called `https://api.football-data.org` directly from the route handler, bypassing the provider abstraction and polling once per open match page every 60s with zero rate-limit protection. Free-tier providers cap requests at ~10/min shared across the whole app (cron jobs included), so a live match with just a few concurrent viewers could exhaust the budget and start failing with 429s. Routing through `fetchFixtureById()` with a shared 30s cache means N viewers of the same live match cost one upstream call per cache window, not N calls — consistent with how `getStandingsMap()` already caches standings.

### ADR-12: Champion Bonus as a separate aggregate, never touching `Prediction.pointsAwarded`
**Decision**: Champion Bonus lives in 4 new tables (`ChampionBonus`, `ChampionBonusTeam`, `ChampionBonusPick`, `ChampionBonusAward`) rather than as fields on `Season` or `Prediction`. Bonus points are computed on read (leaderboard, standings) as a separate additive term, never written into `Prediction.pointsAwarded`.
**Rationale**: `recalculateAllScores()` (`prediction-service.ts`) overwrites `pointsAwarded` for every prediction, and leaderboard accuracy assumes points come only from match scoring — mixing bonus points into that field would make both wrong. `seasonId @unique` on `ChampionBonus` enforces one league per season at the schema level. There is no `CANCELLED` status: cancel is a cascading delete of the whole aggregate (dead configs simply don't exist, so no query path ever needs to filter them out); re-enabling after cancel is a fresh insert.
**Awards are per (team, match), not per (user, match)**: `ChampionBonusAward` has one row per counted game of an allowed team, keyed by `@@unique([championBonusId, teamId, matchId])`. Users' bonus totals join `pick.teamId = award.teamId`, so N users who picked the same team share the same award rows instead of an N×games explosion — the expandable reveal UI reads the breakdown straight from this table, and a correction is a per-team delete+insert, not a per-user rewrite.
**Recompute-from-scratch idempotency**: on every relevant finished/corrected match, the whole ledger for the affected team(s) is rebuilt ordered by `(kickoffTime asc, id asc)`, giving a deterministic `gameNumber` regardless of result arrival order. Double-processing and result corrections are both harmless — the unique constraint plus full rebuild make every mutation idempotent.

### ADR-13: Season lifecycle with frozen final standings, not a live view
**Decision**: `Season` moves through `DRAFT → ACTIVE → ENDED` (`season-service.ts`). Activating retro-assigns any unassigned match with `kickoffTime >= Season.startDate` (`Match.seasonId`, set null on delete). Ending a season computes overall + per-group standings once and writes them to `SeasonStanding` (delete-all + recreate, so re-ending is idempotent), then awards `season_champion` / `season_podium` / `group_season_champion` badges and notifies users by email + push.
**Rationale**: Standings must stay stable for a season after it ends, even as later admin actions (score recalculation, badge changes) touch other data — a live-computed view would let historical results drift. Only one `ACTIVE` season is allowed at a time (enforced in the service, not the schema) since `Match.seasonId` assignment on fetch assumes a single target season. `getChampionPreview()` exposes the same standings computation read-only before the season ends, so admins can sanity-check rankings without side effects.

### ADR-14: Match events (goals/cards) embedded in `APIFixture`, not a separate provider method
**Decision**: `APIFixture` gained an `events: APIMatchEvent[]` field, populated inside `fetchFixtureById()` rather than via a new `IFootballProvider` method. TheSportsDB's implementation calls `/lookuptimeline.php` and maps `Goal`/`Card` timeline entries to `APIMatchEvent` only when the fixture's normalized status is `finished` or `live` (never for `scheduled`, to avoid a wasted request); every other provider (football-data.org, API-Football) always returns `events: []` since they don't expose a per-fixture timeline on the tiers in use.
**Rationale**: Reusing the existing `fetchFixtureById()` call — already the single entry point for `/api/matches/[matchId]/live` and `/api/mobile/matches/[matchId]/live` — meant no new route, no new client-side fetch, and no extra request budget beyond one additional upstream call per cache window (still covered by the existing 30s shared cache, ADR-11). The alternative (a dedicated `fetchMatchEvents()` service method + its own route) would double the request footprint per poll for no benefit, since events are only ever wanted alongside the score. Web renders the result via `MatchEvents.tsx`, mobile via `MatchEventRow.tsx` — both are purely presentational over the same `events` array already present in the live-score response.

### ADR-15: `ODDS_FEATURE_ENABLED` as a single kill switch for the odds multiplier
**Decision**: `src/lib/feature-flags.ts` (mirrored at `mobile/src/constants/featureFlags.ts`) exports `ODDS_FEATURE_ENABLED = false`. Every call site that builds an `OddsConfig` — `match-service.ts`, `prediction-service.ts`, `live-standing-service.ts`, `results-processor.ts`, `/api/admin/matches`, `/api/admin/results/[matchId]/calculate` — ANDs this flag against the per-season `Season.oddsEnabled` value instead of using `Season.oddsEnabled` directly. Admin UI (`admin/matches`, `SeasonsAdminClient`) and the mobile odds onboarding modal (`(tabs)/_layout.tsx`) gate their odds-related UI on the same flag.
**Rationale**: The odds feature needed to be turned off app-wide without touching per-season data (`Season.oddsEnabled`/`oddsMin`/`oddsMax`) or `MatchOdds`/`Prediction.outcomeOdds` rows already persisted — flipping the constant back to `true` fully restores prior behavior with no migration or backfill. A single flag file (no server-only imports, safe for both server code and `"use client"` components) was simpler than threading an env var through every layer, and keeps web/mobile in sync by convention (mobile mirrors the constant since it has no access to the web `lib/` tree). This is a temporary kill switch, not a permanent feature-flag system — there's no admin toggle or per-environment override, just the constant.

### ADR-16: Self-chaining QStash messages for per-match live-goal polling, not a global cron
**Decision**: Live-goal detection uses Upstash QStash's delayed-message API, not Vercel Cron: `registerLiveGoalChain()` publishes one message per newly-inserted match, scheduled for `kickoffTime + KICKOFF_GRACE_SECONDS` (1 min); the webhook handler (`/api/webhooks/qstash/live-goals`) re-publishes itself every `LIVE_POLL_INTERVAL_SECONDS` (1.5 min, longer during HT) until the match reaches a terminal status, at which point it simply stops re-arming. The first tick to observe the fixture as `live` also fires a one-time "match started" push to that match's predictors, gated by the same CAS claim used for goal detection.
**Rationale**: Vercel Cron Jobs are static (declared in `vercel.json` at deploy time) — there is no API to register a new one at runtime per match, and Hobby further restricts invocation frequency. A single global cron polling all live matches every N minutes was considered and rejected: it would run continuously regardless of whether anything is live, whereas a per-match chain only exists for the ~2h a given match is actually in play. QStash's free tier caps at 1,000 messages/day and 10 concurrent in-flight requests account-wide; a per-match jitter (`externalId % 30`s, applied to delivery time only, never compounded into the canonical schedule) spreads simultaneous kickoffs across that concurrency pool. The 1.5-minute cadence (down from an earlier 3-minute default) roughly doubles per-match message volume (~80 messages for a ~2h match vs. ~40 before) — comfortable for normal match volume, but worth watching via the Upstash console on days with many concurrent live matches; see `DEPLOYMENT_GUIDE.md`. The chain's first tick is delayed `KICKOFF_GRACE_SECONDS` past kickoff rather than firing exactly at it, since providers routinely take a short moment to flip a fixture to `live` — polling at the exact kickoff instant would just waste that first tick on a still-`scheduled` status. Idempotency against QStash's at-least-once delivery is handled two ways: a compare-and-swap on `Match.liveHomeScore`/`liveAwayScore` before notifying (so a duplicate tick can't double-push a goal or a match-started notification), and a `deduplicationId` derived from the canonical schedule tick rather than wall-clock time (so a retry of the same invocation can't fork a second parallel chain).

### ADR-17: TheSportsDB `/livescore/{leagueId}` overrides `/lookup/event/{id}` for live status/score
**Decision**: `TheSportsDBProvider.fetchFixtureById()` still calls `/lookup/event/{id}` first (for team/league/venue metadata), but when that call reports the fixture as `live`, a second call to `/livescore/{leagueId}` is made and, if the fixture is found in that feed, its `strStatus`/`intHomeScore`/`intAwayScore` overwrite the values from `/lookup/event`. If the fixture isn't in the livescore feed (e.g. a transient gap), the `/lookup/event` data is kept as-is — no error, no null result.
**Rationale**: `/lookup/event/{id}` was observed lagging real match state by several minutes — confirmed by hand with two `curl` calls at the same moment against the same fixture: `/lookup/event` reported `HT` while `/livescore/{leagueId}` already reported `2H`. This directly caused stale scores in both the `/api/matches/[matchId]/live` polling routes and the QStash live-goal chain's goal-push detection (`live-goal-service.ts`), since both go through this same `fetchFixtureById()`. `/livescore` only lists matches TheSportsDB currently considers live, so it can't replace `/lookup/event` outright (no venue/league metadata, and finished/scheduled fixtures never appear there) — it's used strictly as a fresher overlay for the live case, with the original call's data as the fallback.
