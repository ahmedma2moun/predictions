---
description: "Deploy the football predictions app to Vercel"
---
# Deployment

## Environment: $ARGUMENTS (default: production)

## Pre-deployment checklist
1. `npm run build` — must succeed with zero errors (type-check + compile)
2. `npm run lint` — must pass
3. Run any pending migrations: `npx prisma migrate deploy`
4. Verify all required env vars are set in Vercel Dashboard:
   - `DATABASE_URL` — PostgreSQL pooled connection string (Supabase/Neon)
   - `DIRECT_URL` — PostgreSQL direct (non-pooled) connection string
   - `NEXTAUTH_SECRET` — random 32+ char secret
   - `NEXTAUTH_URL` — production URL (e.g. https://your-app.vercel.app)
   - `FOOTBALL_API_KEY` — football-data.org API key
   - `CRON_SECRET` — secret for Vercel cron authorization
5. Confirm `vercel.json` cron schedule is correct (UTC times):
   - `fetch-matches`: `59 21 * * 5` — Friday 21:59 UTC
   - `fetch-results`: `0 23 * * *` — daily 23:00 UTC

## Deploy
```bash
# Auto-deploy: push to main branch (Vercel CI watches main)
git push origin main

# Manual deploy
npx vercel --prod
```

## First-time setup
```bash
# After initial deploy, run seed to create admin user + General group + scoring rules
npm run seed
```

## Post-deployment verification
1. Visit `/login` — verify login works with `admin@predictions.app` / `changeme123`
2. Change admin password immediately after first login
3. Log in as admin → `/admin/leagues` — import active leagues
4. Activate leagues → `/admin/teams` — import teams
5. `/admin/matches` — run "Fetch This Week" to populate fixtures
6. Create a test user via `/admin/users`
7. Log in as test user → verify `/matches` shows upcoming matches
8. Submit a prediction → verify `/predictions` shows it
9. Check Vercel Functions logs for any cron or API errors

See `docs/architecture/DEPLOYMENT_GUIDE.md` for full deployment procedures.
