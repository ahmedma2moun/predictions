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
| `src/lib/football-api.ts` | football-data.org v4 client — `fetchFixtures`, `fetchLeagues`, `fetchTeams` |
| `src/lib/scoring-engine.ts` | `calculateScore()` — the only place scoring logic lives |
| `src/lib/utils.ts` | `formatKickoff()`, `isMatchLocked()`, `getWinner()` |
| `src/models/Match.ts` | `IMatch` interface + `serializeMatch()` helper (not a Mongoose schema) |
| `src/proxy.ts` | Route protection middleware |
| `prisma/schema.prisma` | Database schema — source of truth for all models |
| `scripts/seed.ts` | One-time setup: admin user, General group, scoring rules |

## Anti-Patterns (Do NOT)
- Never import `connectDB` from `src/lib/db.ts` — it is a no-op; use `prisma` from `@/lib/prisma`
- Never call `fetchFixtures()` or any football API function from user-facing page routes — rate limits apply to the whole app
- Never insert a match without first checking if that `externalId` already exists
- Never save a prediction without calling `isMatchLocked(match.kickoffTime)` first
- Never put scoring logic inline in an API route — always use `calculateScore()` from `src/lib/scoring-engine.ts`
- Never return a Prisma integer `id` to the frontend as a number — `.toString()` it first
- Never skip the `role === 'admin'` check in an admin API handler, even if the route is nested under `/admin/`

## Task-Specific Docs (read when relevant)
- `docs/architecture/SYSTEM_ARCHITECTURE.md` — System design, data flows, ADRs
- `docs/architecture/API_SPECIFICATIONS.md` — All API route contracts
- `docs/architecture/DATA_ARCHITECTURE.md` — PostgreSQL schema, indexes, access patterns
- `docs/architecture/DEPLOYMENT_GUIDE.md` — Vercel deployment, env vars, cron setup
- `docs/architecture/SECURITY_ARCHITECTURE.md` — Auth flow, role-based access, secrets
