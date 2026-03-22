# System Architecture

## Executive Summary

Football Predictions is a single Next.js 16 application deployed on Vercel. Friends predict football match scores; the app fetches results from API-Football, scores predictions automatically via a pluggable engine, and ranks users on a leaderboard. Admin controls leagues, matches, users, and scoring rules.

## Component Architecture

```
src/
├── app/
│   ├── (app)/              # Authenticated route group
│   │   ├── dashboard/      # Stats + upcoming matches overview
│   │   ├── matches/        # Match list + [matchId] prediction form
│   │   ├── predictions/    # User prediction history
│   │   ├── leaderboard/    # Ranked table with period filters
│   │   └── admin/          # Admin panel (leagues/teams/matches/users/scoring)
│   ├── api/
│   │   ├── auth/           # NextAuth handler
│   │   ├── matches/        # GET list + GET single match
│   │   ├── predictions/    # GET history, POST submit
│   │   ├── leaderboard/    # GET ranked aggregation
│   │   ├── admin/          # leagues, teams, matches, users, scoring-rules, recalculate
│   │   └── cron/           # fetch-matches, fetch-results
│   ├── login/              # Public login page
│   └── layout.tsx          # Root layout (dark mode, Inter font, Toaster)
├── lib/
│   ├── db.ts               # Mongoose connection — cached for serverless
│   ├── auth.ts             # NextAuth config — JWT, credentials, role callbacks
│   ├── football-api.ts     # API-Football v3 client wrapper
│   ├── scoring-engine.ts   # Pluggable scoring calculation
│   └── utils.ts            # formatKickoff, isMatchLocked, getWinner, getFridayDate
├── models/                 # Mongoose models (see DATA_ARCHITECTURE.md)
├── components/
│   ├── Navbar.tsx           # Bottom nav (mobile) / top nav (desktop)
│   ├── SessionProvider.tsx  # NextAuth client wrapper
│   └── ui/                  # shadcn/ui components
└── middleware.ts            # Route protection — redirects to /login or /dashboard
```

## Primary Request Flow — Submit Prediction

```
User → matches/[matchId] page
  → fetch /api/matches/[matchId]          (attaches existing prediction)
  → user adjusts scores with +/- buttons
  → POST /api/predictions
      → auth() check
      → Match.findById(matchId)
      → isMatchLocked check (kickoffTime >= now)
      → Prediction.findOneAndUpdate (upsert by userId+matchId)
  → toast success → redirect /matches
```

## Scoring Engine (`src/lib/scoring-engine.ts`)

Scoring rules loaded from MongoDB `scoringRules` collection. Two evaluation tracks:

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

## Cron Job Flows

**fetch-matches** (Friday 21:59 UTC → 11:59 PM CLT):
1. Load all active leagues
2. For each: call API-Football `/fixtures?from=friday&to=nextFriday`
3. `bulkWrite` with `$setOnInsert` — never overwrites existing matches
4. Returns `{ inserted, skipped, errors }`

**fetch-results** (daily 23:00 UTC → 1:00 AM CLT):
1. Load active leagues
2. For each: call API-Football `/fixtures?date=yesterday`
3. Update match `status=finished` + `result`
4. For unscored matches: calculate + save prediction scores
5. Mark `match.scoresProcessed = true`

## Technology Stack

| Component | Package | Version | Purpose |
|---|---|---|---|
| Framework | next | 16.2.1 | App Router, RSC, API routes |
| Language | typescript | 5.x | Type safety |
| Auth | next-auth | 5.0.0-beta.30 | JWT sessions, credentials provider |
| ORM | mongoose | 9.3.1 | MongoDB schema + validation |
| Passwords | bcryptjs | 3.0.3 | Password hashing (cost 12) |
| UI | tailwindcss | 4.x | Utility-first CSS |
| Components | shadcn/ui (radix-ui) | 1.4.3 | Accessible UI primitives |
| Icons | lucide-react | 0.577.0 | Icon set |
| Dates | date-fns | 4.1.0 | UTC/CLT conversion, formatting |
| Toast | sonner | 2.0.7 | Notifications |

## Architecture Decision Records

### ADR-1: NextAuth v5 JWT over database sessions
**Decision**: Use JWT session strategy, not database sessions.
**Rationale**: Vercel serverless functions are stateless. Database sessions require an additional MongoDB read on every request. JWT avoids this while still allowing role-based access via token claims.

### ADR-2: $setOnInsert for match upserts
**Decision**: Use `bulkWrite` with `$setOnInsert` instead of `findOneAndUpdate`.
**Rationale**: Prevents overwriting match status/result when a cron runs twice (idempotent). Ensures admin-set data is never clobbered by re-fetch.

### ADR-3: Tiered scoring (mutually exclusive)
**Decision**: exact_score > score_difference > one_team_score are mutually exclusive.
**Rationale**: These three rules measure overlapping aspects of score accuracy. Allowing all three simultaneously would unfairly reward lucky partial guesses alongside exact matches.

### ADR-4: Admin creates all accounts
**Decision**: No self-registration — admin creates accounts for friends.
**Rationale**: This is a private group app. Closed registration prevents spam accounts and keeps the leaderboard meaningful.
