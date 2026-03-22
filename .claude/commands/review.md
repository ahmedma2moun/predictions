---
description: "Review architecture impact of changes"
---
# Architecture Review Checklist

## 1. Which services are affected?
Check the service map in `CLAUDE.md` — identify all touched files.

## 2. API rate limit impact
- Any new calls to `src/lib/football-api.ts`? → Check if it can be cached/deferred
- Free tier: 100 requests/day. Never call football API in user-facing request paths

## 3. MongoDB index impact
- New queries added? → Verify there's an index for the filter fields
- Critical indexes: `externalId` (unique) on Match, `{userId, matchId}` (compound unique) on Prediction

## 4. Prediction locking
- Any change to prediction submission? → Must still enforce `isMatchLocked()` check
- UI + API must both enforce the lock

## 5. Scoring engine changes
- Changed scoring rules or engine logic? → Must run `POST /api/admin/recalculate` after deploy
- Scoring breakdown stored per prediction — stale on rule change until recalculated

## 6. Auth impact
- New route added? → Ensure `src/middleware.ts` protects it
- New admin action? → Add `role === 'admin'` check in EVERY handler (not just layout)

## 7. Time zone correctness
- Any date displayed to user? → Use `formatKickoff()` from `src/lib/utils.ts` (converts UTC → CLT)
- Any date stored to DB? → Must be UTC

See `docs/architecture/SYSTEM_ARCHITECTURE.md` for component architecture context.
