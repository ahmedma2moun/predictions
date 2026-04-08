---
description: "Debug an issue in the football predictions app"
---
# Debugging Protocol

## Step 1 — Reproduce
Identify the exact symptom: which page, which API route, what error message or unexpected behavior.

## Step 2 — Check logs
- **Dev**: browser console + Next.js terminal output (`npm run dev`)
- **Prod**: Vercel Dashboard → Functions tab → select the failing function

## Step 3 — Identify the layer
| Symptom | Likely Cause | Where to Look |
|---|---|---|
| Redirect loop on login | Session cookie or `NEXTAUTH_SECRET` mismatch | `src/lib/auth.ts`, `.env.local` |
| 401 on any authenticated page | Session expired / proxy mismatch | `src/proxy.ts`, `src/lib/auth.ts` |
| 403 on admin API | Missing or wrong role check | Every admin handler must check `role === 'admin'` |
| Prediction not saving | Match already locked | `isMatchLocked(kickoffTime)` returns true; check `kickoffTime` in DB |
| Duplicate key error on match insert | Existence check skipped | `src/app/api/admin/matches/route.ts` — check pre-insert exists query |
| Zero points after result | `scoresProcessed` already true, or cron missed it | Check `Match.scoresProcessed` flag; re-run via admin fetch-results |
| Football API 401/403 | Bad or missing `FOOTBALL_API_KEY` | Check `.env.local` and Vercel env vars |
| Football API errors | Endpoint or param mismatch (football-data.org v4) | `src/lib/football-api.ts` — uses `BASE_URL = https://api.football-data.org/v4` |
| BigInt serialization error | `$queryRaw` returns BigInt | Wrap with `Number()` before returning JSON |
| Cron job not authorized | Missing or wrong `CRON_SECRET` | Check `Authorization: Bearer ${CRON_SECRET}` header |
| Leaderboard empty | No finished matches or group has no members | Check `Match.status === 'finished'` and `GroupMember` table |

## Step 4 — Test the API directly
```bash
# Manually trigger fetch-results cron (dev)
curl http://localhost:3000/api/cron/fetch-results -H "Authorization: Bearer YOUR_CRON_SECRET"

# Manually trigger fetch-matches cron (dev)
curl http://localhost:3000/api/cron/fetch-matches -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## Step 5 — Inspect the database
```bash
npx prisma studio
# Navigate to Match, Prediction, or ScoringRule tables directly
```

## Step 6 — Check scoring engine
Scoring logic lives exclusively in `src/lib/scoring-engine.ts`:
- `correct_winner`: always evaluated independently (+2 pts)
- `exact_score` → `score_difference` → `one_team_score`: tiered — only highest match applies

See `docs/architecture/SYSTEM_ARCHITECTURE.md` for full data flow context.
