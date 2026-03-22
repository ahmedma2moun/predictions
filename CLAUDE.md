# Football Predictions

A full-stack football match predictions app where friends predict scores and compete on a leaderboard. Built with Next.js 15 App Router, MongoDB, and the API-Football free tier.

## Quick Reference
- **Stack**: TypeScript 5, Next.js 16.2.1, React 19, Tailwind CSS 4, shadcn/ui
- **Auth**: NextAuth.js v5 (beta) — JWT strategy, credentials provider, admin creates accounts
- **DB**: MongoDB via Mongoose 9 — cached connection for serverless
- **Football API**: API-Football v3 via RapidAPI — 100 req/day free tier
- **Deployment**: Vercel with cron jobs
- **Docs**: See `docs/architecture/INDEX.md` for full architecture documentation

## Build & Run
- `npm run dev` — Start development server (http://localhost:3000)
- `npm run build` — Build for production
- `npm run lint` — Run ESLint
- `npm run seed` — Seed admin user + default scoring rules (requires MONGODB_URI in .env.local)

## Code Patterns
- Route groups: `src/app/(app)/` for authenticated pages, `src/app/login/` for public
- All dates stored UTC in MongoDB; display converts to CLT (UTC+2) via `formatKickoff()`
- Use `bulkWrite` with `$setOnInsert` for match upserts — never overwrite existing matches
- Prediction locking: check `isMatchLocked(match.kickoffTime)` before saving predictions
- Admin-only routes require `(session.user as any).role === 'admin'` check in EVERY handler

## Security
- Auth: NextAuth JWT — role stored in token, propagated to session via callbacks in `src/lib/auth.ts`
- Secrets: MONGODB_URI, NEXTAUTH_SECRET, RAPIDAPI_KEY, CRON_SECRET — all via .env.local
- Cron endpoints verify `Authorization: Bearer ${CRON_SECRET}` header before processing

## Architecture Quick Map
| Service/Module | Path | Purpose |
|---|---|---|
| App pages | `src/app/(app)/` | All authenticated user-facing pages |
| API routes | `src/app/api/` | REST endpoints (matches, predictions, leaderboard, admin) |
| Cron jobs | `src/app/api/cron/` | fetch-matches (Friday 21:59 UTC), fetch-results (daily 23:00 UTC) |
| Models | `src/models/` | Mongoose: User, League, Team, Match, Prediction, ScoringRule |
| Lib | `src/lib/` | db.ts, auth.ts, football-api.ts, scoring-engine.ts, utils.ts |
| Scripts | `scripts/` | seed.ts — creates admin user + scoring rules |

## Anti-Patterns (Do NOT)
- Never re-fetch league/team data unless explicitly triggered by admin — API rate limit is 100 req/day
- Never use `Match.create()` for fetched fixtures — always use `bulkWrite` upsert by `externalId`
- Never save a prediction without checking `kickoffTime >= now`
- Never put scoring logic in API routes — use `calculateScore()` from `src/lib/scoring-engine.ts`
- Never trust MongoDB `_id` in frontend without `.toString()` serialization

## Task-Specific Docs (read when relevant)
- `docs/architecture/SYSTEM_ARCHITECTURE.md` — System design, data flows, component architecture
- `docs/architecture/API_SPECIFICATIONS.md` — All API route contracts
- `docs/architecture/DATA_ARCHITECTURE.md` — MongoDB schema, indexes, access patterns
- `docs/architecture/DEPLOYMENT_GUIDE.md` — Vercel deployment, env vars, cron setup
- `docs/architecture/SECURITY_ARCHITECTURE.md` — Auth flow, role-based access
