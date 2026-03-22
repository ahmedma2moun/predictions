---
description: "Debug an issue in the football predictions app"
---
# Debugging Protocol

## Step 1 — Reproduce
Identify the exact symptom: which page, which API route, what error message.

## Step 2 — Check logs
- Dev: browser console + Next.js terminal output
- Prod: Vercel Functions logs → Dashboard → Functions tab

## Step 3 — Identify the layer
| Symptom | Likely Cause | Where to Look |
|---|---|---|
| 401 on any page | Session expired / middleware | `src/middleware.ts`, `src/lib/auth.ts` |
| 403 on /admin/* | Not admin role in JWT | `src/lib/auth.ts` callbacks |
| Match not saving | Prediction locked or duplicate | `src/app/api/predictions/route.ts` |
| Duplicate matches | Missing upsert by externalId | `src/app/api/admin/matches/route.ts` |
| Zero points after result | Scoring not triggered | `src/app/api/cron/fetch-results/route.ts` |
| MongoDB timeout | Cold start / bad URI | `src/lib/db.ts` — check MONGODB_URI |
| API rate limit hit | >100 requests/day used | Avoid calling football-api.ts directly |

## Step 4 — Test the API directly
```bash
# Test auth
curl -X POST http://localhost:3000/api/auth/callback/credentials -d 'email=admin@predictions.app&password=changeme123'

# Test matches endpoint
curl http://localhost:3000/api/matches -H "Cookie: ..."

# Manually trigger cron (dev)
curl http://localhost:3000/api/cron/fetch-results -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## Step 5 — Check scoring engine
The scoring logic lives in `src/lib/scoring-engine.ts`. The rules are:
- `correct_winner`: always evaluated independently (+2 pts)
- `exact_score` → `score_difference` → `one_team_score`: only highest applies (mutually exclusive tiers)

See `docs/architecture/SYSTEM_ARCHITECTURE.md` for full data flow diagrams.
