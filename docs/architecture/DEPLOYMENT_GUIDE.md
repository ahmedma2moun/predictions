# Deployment Guide

## CI/CD Pipeline

```
git push → Vercel auto-detect → Build (next build) → Deploy → CDN propagation
```
No formal CI/CD pipeline configured. Vercel auto-deploys on push to main branch.

## First-Time Setup

### 1. MongoDB Atlas
1. Create free M0 cluster at cloud.mongodb.com
2. Create database user with read/write to `football-predictions` DB
3. Add 0.0.0.0/0 to IP allowlist (Vercel uses dynamic IPs)
4. Copy connection string → set as `MONGODB_URI`

### 2. RapidAPI / API-Football
1. Sign up at rapidapi.com → subscribe to api-football
2. Copy API key → set as `RAPIDAPI_KEY`
3. Free tier: 100 requests/day. Each league = 1 request per cron run.

### 3. Vercel Deployment
```bash
npm install -g vercel
vercel login
cd football-predictions
vercel --prod
```

### 4. Environment Variables (set in Vercel Dashboard)
```
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/football-predictions
NEXTAUTH_SECRET=<32+ char random string>
NEXTAUTH_URL=https://your-app.vercel.app
RAPIDAPI_KEY=<your-rapidapi-key>
CRON_SECRET=<32+ char random string>
```

### 5. Seed the Database
```bash
# Run locally with production MONGODB_URI
MONGODB_URI=mongodb+srv://... npm run seed
```
Creates: `admin@predictions.app` / `changeme123` + 4 default scoring rules.

**Change the admin password immediately after first login.**

### 6. Initial Data Load
1. Log in as admin → `/admin/leagues` → "Fetch from API"
2. Activate desired leagues (toggle switch)
3. Go to `/admin/matches` → "Fetch This Week"
4. Create user accounts at `/admin/users`

## Cron Jobs (`vercel.json`)

```json
{
  "crons": [
    { "path": "/api/cron/fetch-matches", "schedule": "59 21 * * 5" },
    { "path": "/api/cron/fetch-results", "schedule": "0 23 * * *" }
  ]
}
```

- `59 21 * * 5` → Friday 11:59 PM CLT (UTC+2)
- `0 23 * * *` → Daily 1:00 AM CLT

Vercel calls these endpoints with `Authorization: Bearer {CRON_SECRET}`.

## Manual Cron Trigger (testing/recovery)
```bash
curl https://your-app.vercel.app/api/cron/fetch-matches \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

curl https://your-app.vercel.app/api/cron/fetch-results \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## Rollback
Vercel maintains deployment history. In Dashboard → Deployments → select previous → "Promote to Production".

## Post-Deployment Checklist
- [ ] `/login` works
- [ ] Admin login → `/admin` shows stats
- [ ] Leagues fetch works (API key valid)
- [ ] Matches fetch works for active leagues
- [ ] Test user can submit a prediction
- [ ] Leaderboard shows rankings
- [ ] Cron endpoints return 200 with CRON_SECRET

## Vercel Free Tier Limits
- Serverless functions: 10s timeout (use Pro for 60s if bulk operations time out)
- Cron jobs: 2 cron jobs on hobby plan
- Bandwidth: 100 GB/month
