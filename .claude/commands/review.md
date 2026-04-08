---
description: "Review architecture impact of changes"
---
# Architecture Review Checklist

## 1. Which layer is affected?
Check `CLAUDE.md` architecture map — identify all touched paths.

## 2. Database changes?
- Schema changed → update `prisma/schema.prisma` and run `npx prisma migrate dev --name <desc>`
- New query added → does it have an appropriate index? Critical: `externalId` (unique on Match), `userId_matchId` (unique on Prediction)
- Using `$queryRaw`? → All returned BigInt values must be wrapped with `Number()` before JSON serialization

## 3. Football API impact
- Any new call to `src/lib/football-api.ts`? → Must NOT be in user-facing request paths
- football-data.org v4 free tier has rate limits — all fetches go through admin actions or cron jobs only

## 4. Auth / admin routes
- New route added? → Does `src/proxy.ts` protect it correctly?
- New admin API handler? → Must check `(session.user as any).role === 'admin'` in the handler itself, not only at the layout level
- New cron endpoint? → Must verify `Authorization: Bearer ${CRON_SECRET}`

## 5. Prediction locking
- Any change to prediction submission? → Must still enforce `isMatchLocked(match.kickoffTime)` before saving
- Both the API handler and the UI should respect the lock

## 6. Scoring engine changes
- Changed scoring rules or engine logic? → Run `POST /api/admin/recalculate` after deploy to reprocess existing predictions
- `scoringBreakdown` is stored as JSON per prediction — becomes stale on rule changes until recalculated

## 7. Match insertion pattern
- Any new match insert path? → Must check `externalId` existence first, then use `createMany()` or `create()`; never skip the existence check

## 8. Date handling
- Any date displayed to the user? → Use `formatKickoff()` from `src/lib/utils.ts` (UTC → CLT UTC+2)
- Any date stored to DB? → Must be UTC

## 9. Serialization
- Any Prisma model returned to frontend? → Integer `id` must be `.toString()`-ed; use `serializeMatch()` for Match objects

See `docs/architecture/SYSTEM_ARCHITECTURE.md` for component architecture context.
