# Football Predictions

A full-stack football match predictions app where friends predict scores and compete on a leaderboard. Built with Next.js 16 App Router, PostgreSQL/Prisma, and the football-data.org free tier.

## Quick Reference
- **Stack**: TypeScript 5, Next.js 16.2.1, React 19.2.4, Tailwind CSS 4, shadcn/ui
- **Auth**: NextAuth.js v5 (beta.30) — JWT strategy, credentials provider
- **DB**: PostgreSQL via Prisma 6.19.3 — `DATABASE_URL` (pooled) + `DIRECT_URL` (non-pooled)
- **Football API**: football-data.org v4 — `FOOTBALL_API_KEY` env var, free tier has rate limits
- **Deployment**: Vercel with cron jobs defined in `vercel.json`
- **Docs**: See `docs/architecture/INDEX.md` for full architecture documentation

## Build & Run
- `npm run dev` — Start development server (http://localhost:3000)
- `npm run build` — Build for production (must pass before deploying)
- `npm run lint` — Run ESLint
- `npm run seed` — Seed admin user, General group, and default scoring rules
- `npx prisma migrate dev` — Run pending migrations in local dev
- `npx prisma studio` — Browse database in the browser

## Code Patterns
- **Route protection**: `src/proxy.ts` (NOT `middleware.ts`) wraps `auth()` from NextAuth
- **Route groups**: `src/app/(app)/` for all authenticated pages; `src/app/login/` is the only public page
- **DB access**: Import `prisma` from `@/lib/prisma` directly — `connectDB()` in `src/lib/db.ts` is a no-op shim left over from the Mongoose migration
- **Dates**: All dates stored as UTC in PostgreSQL; display converts to CLT (UTC+2) via `formatKickoff()` in `src/lib/utils.ts`
- **Match insertion**: Check existence by `externalId` first, then `createMany()` — never skip the existence check
- **Prediction locking**: Always call `isMatchLocked(match.kickoffTime)` before allowing a prediction to be saved
- **Serialization**: Call `serializeMatch()` from `src/models/Match.ts` when returning match data to the frontend; integer `id` must be `.toString()`-ed

## Security
- **Auth**: NextAuth JWT — `role` stored in token, propagated to session via `jwt` + `session` callbacks in `src/lib/auth.ts`
- **Admin check**: `(session.user as any).role === 'admin'` must appear in EVERY admin API handler — layout-level checks alone are not sufficient
- **Cron auth**: All cron handlers verify `Authorization: Bearer ${CRON_SECRET}` before any work
- **Secrets**: `DATABASE_URL`, `DIRECT_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `FOOTBALL_API_KEY`, `CRON_SECRET`, `GMAIL_USER`, `GMAIL_APP_PASSWORD` — all via `.env.local`; never hard-coded

## Architecture Quick Map
| Path | Purpose |
|---|---|
| `src/app/(app)/` | All authenticated pages: dashboard, matches, predictions, leaderboard, admin/* |
| `src/app/api/` | REST endpoints — matches, predictions, leaderboard, groups, admin/* |
| `src/app/api/cron/` | Vercel cron: `fetch-matches` (Fri 21:59 UTC), `fetch-results` (daily 23:00 UTC) |
| `src/lib/prisma.ts` | Prisma singleton — the single source of DB access |
| `src/lib/auth.ts` | NextAuth config — providers, JWT/session callbacks |
| `src/lib/football/service.ts` | Football external service layer — all callers import from here; delegates to provider via factory |
| `src/lib/football/factory.ts` | Provider factory — reads `FOOTBALL_PROVIDER` env var, returns `IFootballProvider` singleton |
| `src/lib/football/types.ts` | Normalized types (`APIFixture`, `APILeague`, etc.), `IFootballProvider` interface, `mapFixtureStatus` |
| `src/lib/football/providers/football-data.ts` | football-data.org v4 implementation of `IFootballProvider` |
| `src/lib/scoring-engine.ts` | `calculateScore()` — the only place scoring logic lives |
| `src/lib/utils.ts` | `formatKickoff()`, `isMatchLocked()`, `getWinner()` |
| `src/models/Match.ts` | `IMatch` interface + `serializeMatch()` helper (not a Mongoose schema) |
| `src/proxy.ts` | Route protection middleware |
| `prisma/schema.prisma` | Database schema — source of truth for all models |
| `scripts/seed.ts` | One-time setup: admin user, General group, scoring rules |

## Cross-Layer Implementation Rule

**Any feature, fix, or API change must be fully implemented across ALL three layers:**

| Layer | Path |
|---|---|
| Web frontend | `src/app/` |
| API / backend | `src/app/api/` |
| Android mobile | `../football-predictions-android/app/src/` |

Do NOT implement a feature in only one layer and leave the others outdated.  
Do NOT change an API contract without updating both the web frontend and the Android app.  
Do NOT add a screen in the Android app without the equivalent web page (and vice versa).  
When a task targets only one layer, flag it and ask which other layers need updating before proceeding.

## Service Layer Pattern

All DB query logic lives in `src/lib/services/`. Route handlers do **only** three things: authenticate, call a service method, and serialize the response.

| Service | File | Methods |
|---|---|---|
| Matches | `src/lib/services/match-service.ts` | `getMatches()`, `getMatchById()` |
| Predictions | `src/lib/services/prediction-service.ts` | `getUserPredictions()`, `upsertPrediction()`, `getUserPredictionHistory()` |
| Leaderboard | `src/lib/services/leaderboard-service.ts` | `getLeaderboard()` |
| Groups | `src/lib/services/group-service.ts` | `getUserGroups()` |
| Leagues | `src/lib/services/league-service.ts` | `getActiveLeagues()` |

**Rules:**
- **Never** write Prisma queries directly in a route handler — put them in the matching service
- Both `/api/*` and `/api/mobile/*` handlers call the **same** service method; only auth and serialization differ
- Serialization (`serializeMatch` vs `serializeMatchForMobile`) stays in the route handler, not the service
- When adding a new endpoint, create/extend the service first, then wire both web and mobile handlers

## Anti-Patterns (Do NOT)
- Never import `connectDB` from `src/lib/db.ts` — it is a no-op; use `prisma` from `@/lib/prisma`
- Never call `fetchFixtures()` or any football API function from user-facing page routes — rate limits apply to the whole app
- Never insert a match without first checking if that `externalId` already exists
- Never save a prediction without calling `isMatchLocked(match.kickoffTime)` first
- Never put scoring logic inline in an API route — always use `calculateScore()` from `src/lib/scoring-engine.ts`
- Never return a Prisma integer `id` to the frontend as a number — `.toString()` it first
- Never skip the `role === 'admin'` check in an admin API handler, even if the route is nested under `/admin/`

## Documentation Update Rule

**After every change — feature, fix, refactor, or API modification — update the relevant architecture docs before considering the task done.**

| Change type | Documents to update |
|---|---|
| New/modified API route or service method | `docs/architecture/API_SPECIFICATIONS.md`, `docs/architecture/SYSTEM_ARCHITECTURE.md` |
| New lib/ file or structural refactor | `docs/architecture/SYSTEM_ARCHITECTURE.md` (component tree + relevant section) |
| New ADR or architectural decision | `docs/architecture/SYSTEM_ARCHITECTURE.md` (ADRs section) + `docs/architecture/INDEX.md` (Key Decisions table) |
| Schema change (Prisma migration) | `docs/architecture/DATA_ARCHITECTURE.md` |
| Auth, roles, or secrets change | `docs/architecture/SECURITY_ARCHITECTURE.md` |
| Deployment, env vars, or cron change | `docs/architecture/DEPLOYMENT_GUIDE.md` |

If a task spans multiple doc files, update all of them. Do not leave docs describing the old design.

## Task-Specific Docs (read when relevant)
- `docs/architecture/SYSTEM_ARCHITECTURE.md` — System design, data flows, ADRs
- `docs/architecture/API_SPECIFICATIONS.md` — All API route contracts
- `docs/architecture/DATA_ARCHITECTURE.md` — PostgreSQL schema, indexes, access patterns
- `docs/architecture/DEPLOYMENT_GUIDE.md` — Vercel deployment, env vars, cron setup
- `docs/architecture/SECURITY_ARCHITECTURE.md` — Auth flow, role-based access, secrets
- `docs/football-providers/FOOTBALL_API_FREE_APIS.md` — Free football API comparison, rate limits, and switching guide
- `docs/football-providers/football-data.md` — Current provider: registration, endpoints, implementation
- `docs/football-providers/api-football.md` — API-Football provider guide (ready to activate)
- `docs/football-providers/sportmonks.md` — Sportmonks provider guide (ready to activate)
- `docs/football-providers/allsports.md` — AllSportsAPI provider guide (ready to activate)
