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
│   │   │   ├── test-email/ # POST send test email to self
│   │   │   └── users/      # CRUD users
│   │   │   ├── cron/
│   │   │   ├── fetch-matches     # Thu 18:00 UTC — fetch upcoming fixtures
│   │   │   ├── fetch-results     # Daily 23:00 UTC — safety-net result pass
│   │   │   ├── prediction-reminder # Fri 16:00 UTC — remind unpredicted users
│   │   │   ├── daily-reminder    # Daily 09:00 UTC — remind for today's matches
│   │   │   └── db-export         # Daily 09:00 UTC — JSON backup via email
│   │   └── jobs/
│   │       ├── check-results     # POST — QStash-triggered per-slot result handler
│   │       └── reschedule-pending # POST — manual deployment recovery (CRON_SECRET)
│   ├── login/              # Public login page
│   └── layout.tsx          # Root layout (dark mode, Inter font, Toaster)
├── lib/
│   ├── prisma.ts           # Prisma singleton — single source of DB access
│   ├── db.ts               # No-op shim (Mongoose migration artifact — do not use)
│   ├── auth.ts             # NextAuth config — JWT, credentials, role callbacks
│   ├── football-api.ts     # football-data.org v4 client
│   ├── scoring-engine.ts   # calculateScore() — only place scoring logic lives
│   ├── utils.ts            # formatKickoff(), isMatchLocked(), getWinner()
│   ├── leaderboard.ts      # Leaderboard aggregation logic
│   ├── matches-processor.ts  # Fixture upsert + slot scheduling (fetch-matches cron)
│   ├── results-processor.ts  # Result update + scoring (safety-net cron + admin)
│   ├── result-scheduler.ts   # QStash slot scheduler — scheduleSlot(), rescheduleSlot()
│   ├── standings.ts        # TeamStanding cache + football-data.org standings fetch
│   ├── client-api.ts       # Typed fetch helpers for client components
│   ├── email.ts            # Nodemailer (Gmail) — new-matches, results, reminders
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

## Primary Request Flow — Submit Prediction

```
User → matches/[matchId] page
  → fetch /api/matches/[matchId]          (attaches existing prediction)
  → user adjusts scores with +/- buttons
  → POST /api/predictions
      → auth() check
      → prisma.match.findUnique({ where: { id } })
      → isMatchLocked(match.kickoffTime) check
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

## Result Fetching — QStash Per-Slot Scheduling

Rather than polling on fixed hourly crons, results are fetched via per-match-slot jobs scheduled through **QStash (Upstash)**.

### Flow

```
fetch-matches cron runs
    │
    ├─ inserts new matches into DB
    │
    └─ groups inserted matches by kickoffTime
           │
           └─ for each unique kickoffTime → scheduleSlot(kickoffTime)
                  │
                  └─ publishes QStash job to fire at kickoffTime + 2h
                         │
                         ▼
                POST /api/jobs/check-results  (called by QStash)
                         │
                         ├─ all matches in slot finished?
                         │       └─ yes → markSlotDone()
                         │
                         └─ some still unfinished?
                                 └─ rescheduleSlot() → new job at now + 30min
                                    (repeats until all done or 6h cap)
```

**Deduplication**: Each kickoff time maps to exactly one `ResultCheckSlot` row. Before issuing a new QStash job the previous `qstashJobId` is cancelled. Inserting the same matches again (e.g. running the cron twice) is safe — `scheduleSlot()` is idempotent.

**On deployment**: `src/instrumentation.ts` runs automatically when the server starts. It finds all matches with `kickoffTime < now` and `scoresProcessed = false` and re-schedules their slots immediately, so no results are lost across deployments.

**Safety net**: The daily `fetch-results` cron at 23:00 UTC still runs `processMatchResults()` for any matches that slipped through (QStash delivery failures, API errors, etc.).

## Cron Job Flows

**fetch-matches** (Thursday 18:00 UTC):
1. Load all active leagues
2. For each: call football-data.org `/competitions/{id}/matches?dateFrom=…&dateTo=…`
3. Check `externalId` existence, then `createMany()` — never overwrites existing
4. Group newly inserted matches by `kickoffTime`, call `scheduleSlot()` once per unique time
5. Send "new matches" email to each user with `notificationEmail` set
6. Returns `{ inserted, skipped, errors }`

**check-results** (triggered by QStash, not a cron):
1. Verifies QStash signature (`upstash-signature` header)
2. Loads the `ResultCheckSlot` and its pending matches (same `kickoffTime`, not finished)
3. Groups by league — one football-data.org API call per league
4. Updates finished matches: `status`, `resultHomeScore`, `resultAwayScore`, `resultWinner`
5. Scores predictions via `calculateScore()`, marks `scoresProcessed = true`
6. Sends results email to affected users
7. Refreshes league standings
8. If all matches done → `markSlotDone()`. If any remain → `rescheduleSlot()` (+30 min)

**fetch-results** (daily 23:00 UTC — safety net only):
1. Queries any match with `kickoffTime < now` and `status NOT IN (finished, cancelled)`
2. Runs the same result + scoring logic as check-results
3. Catches anything QStash missed (network failures, 6h cap reached, etc.)

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
| Job queue | @upstash/qstash | 2.10.1 | Per-match-slot result-check scheduling |
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

### ADR-8: QStash per-slot scheduling replaces fixed hourly crons
**Decision**: Replace 8 repeated `fetch-results` cron entries with per-kickoff-slot QStash jobs scheduled at match-insert time.
**Rationale**: Fixed hourly crons over-poll (most hours have no matches finishing), under-adapt (extra-time or postponed matches fall outside the window), and cap at Vercel's cron limit. QStash fires exactly when needed, retries every 30 minutes only while a match is still live, and the 6-hour safety cap prevents runaway jobs. Existing `processMatchResults` cron is kept as a nightly safety net.

### ADR-7: notificationEmail separate from login email
**Decision**: Users have an optional `notificationEmail` field distinct from `email`.
**Rationale**: Some users log in with a work email but prefer notifications to a personal address. Decoupling the two avoids forcing users to change their login credential.
