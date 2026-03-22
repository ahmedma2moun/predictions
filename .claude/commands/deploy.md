---
description: "Deploy the football predictions app to Vercel"
---
# Deployment Checklist

## Environment: $ARGUMENTS (default: production)

## Pre-deployment
1. Verify all tests pass: `npm run build` (build = type check + compile)
2. Confirm `.env.local` vars are set in Vercel Dashboard:
   - `MONGODB_URI` — MongoDB Atlas connection string
   - `NEXTAUTH_SECRET` — strong random secret
   - `NEXTAUTH_URL` — your Vercel app URL (e.g. https://football-predictions.vercel.app)
   - `RAPIDAPI_KEY` — from RapidAPI dashboard
   - `CRON_SECRET` — strong random secret for cron authentication
3. Confirm `vercel.json` cron schedule is correct (UTC times)

## Deploy steps
```bash
# First time
npx vercel --prod

# Subsequent deploys (if connected to git)
git push origin main  # Vercel auto-deploys on push
```

## Post-deployment verification
1. Visit `/login` — verify login works
2. Log in as admin → `/admin` — run "Fetch Leagues" to populate leagues
3. Activate 1-2 leagues → run "Fetch This Week" in `/admin/matches`
4. Create a test user via `/admin/users`
5. Log in as test user → verify `/matches` shows upcoming matches
6. Submit a prediction → verify `/predictions` shows it

## Seed on first deploy
```bash
MONGODB_URI=your-uri npx tsx scripts/seed.ts
```

See `docs/architecture/DEPLOYMENT_GUIDE.md` for full deployment procedures.
