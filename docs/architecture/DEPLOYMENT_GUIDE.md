# Deployment Guide

## CI/CD Pipeline

```
git push → Vercel auto-detect → Build (next build) → Deploy → CDN propagation
```

No formal CI/CD pipeline configured. Vercel auto-deploys on push to the main branch.

## First-Time Setup

### 1. PostgreSQL Database

Use any PostgreSQL provider with a free tier (Supabase or Neon recommended):

**Supabase:**
1. Create a project at supabase.com
2. Go to Settings → Database → Connection Pooling → copy "Transaction" URL → `DATABASE_URL`
3. Copy the "Direct connection" URL → `DIRECT_URL`

**Neon:**
1. Create a project at neon.tech
2. Copy the pooled connection string → `DATABASE_URL`
3. Copy the unpooled string → `DIRECT_URL`

Both `DATABASE_URL` and `DIRECT_URL` are required. Prisma uses `DIRECT_URL` for migrations and `DATABASE_URL` for all runtime queries.

### 2. Run Migrations

```bash
# Run against your production database via DIRECT_URL
DIRECT_URL=postgres://... DATABASE_URL=postgres://... npx prisma migrate deploy
```

### 3. football-data.org API Key

1. Sign up at football-data.org
2. Copy your API token → set as `FOOTBALL_API_KEY`
3. Free tier: 10 requests/minute. Each cron call costs 1 request per league.

### 4. Gmail App Password (for notifications)

1. Enable 2-Step Verification on your Google account
2. Go to myaccount.google.com → Security → App passwords
3. Generate a password for "Mail" → set as `GMAIL_APP_PASSWORD`
4. Set the sending address as `GMAIL_USER`

### 5. Vercel Deployment

```bash
npm install -g vercel
vercel login
cd football-predictions
vercel --prod
```

### 6. Environment Variables (set in Vercel Dashboard)

```
DATABASE_URL=postgres://user:pass@host:6543/db?pgbouncer=true
DIRECT_URL=postgres://user:pass@host:5432/db
NEXTAUTH_SECRET=<32+ char random string>
MOBILE_JWT_SECRET=<32+ char random string — used for mobile app auth>
NEXTAUTH_URL=https://your-app.vercel.app
FOOTBALL_API_KEY=<your-football-data.org-key>
CRON_SECRET=<32+ char random string>
GMAIL_USER=your-gmail@gmail.com
GMAIL_APP_PASSWORD=<16-char app password>
TRIGGER_SECRET=<32+ char random string — used by cron-job.org to authenticate fetch-results calls>
```

### 7. Seed the Database

```bash
# Run locally pointing at production DIRECT_URL
DATABASE_URL=postgres://... DIRECT_URL=postgres://... npm run seed
```

Creates: `admin@predictions.app` / `changeme123` + General group + 4 default scoring rules.

**Change the admin password immediately after first login.**

### 8. Initial Data Load

1. Log in as admin → `/admin/leagues` → "Fetch from API"
2. Activate desired leagues (toggle switch)
3. Go to `/admin/teams` → sync teams for each active league
4. Go to `/admin/matches` → "Fetch This Week"
5. Create user accounts at `/admin/users`
6. Set `notificationEmail` for users who want email alerts

## Cron Jobs (`vercel.json`)

```json
{
  "crons": [
    { "path": "/api/cron/db-export",           "schedule": "0 9 * * *"   },
    { "path": "/api/cron/fetch-matches",        "schedule": "00 18 * * 4" },
    { "path": "/api/cron/fetch-results",        "schedule": "0 23 * * *"  },
    { "path": "/api/cron/prediction-reminder",  "schedule": "0 16 * * 5"  },
    { "path": "/api/cron/daily-reminder",       "schedule": "0 9 * * *"   }
  ]
}
```

| Cron | UTC Schedule | CLT (UTC+2) | Purpose |
|---|---|---|---|
| db-export | 09:00 daily | 11:00 daily | JSON backup of all DB tables → email |
| fetch-matches | 18:00 Thursday | 20:00 Thursday | Fetch fixtures for the upcoming week |
| fetch-results | 23:00 daily | 01:00 daily | Fetch results for all unfinished past matches |
| prediction-reminder | 16:00 Friday | 18:00 Friday | Remind users with missing predictions |
| daily-reminder | 09:00 daily | 11:00 daily | Urgent reminder for today's matches |

Vercel calls these endpoints with `Authorization: Bearer {CRON_SECRET}`.

> **Note**: The Vercel Hobby plan allows up to 2 cron jobs. You need a Pro plan (or higher) to run all 5 crons. Running two crons at the same UTC time (db-export and daily-reminder at 09:00) is intentional — Vercel triggers them independently.

## External Cron Provider (cron-job.org)

`fetch-results` is also triggered by **[cron-job.org](https://console.cron-job.org/jobs)** on a fine-grained schedule (e.g. every hour during match windows) to supplement or replace the Vercel cron slots.

### Setup

1. Sign up at [cron-job.org](https://cron-job.org) and go to the Jobs console
2. Create a new job with:
   - **URL**: `https://your-app.vercel.app/api/cron/fetch-results`
   - **Method**: GET
   - **Header**: `Authorization: Bearer <TRIGGER_SECRET>`
3. Set `TRIGGER_SECRET` in Vercel environment variables (a strong random string, **different** from `CRON_SECRET`)

### How it authenticates

The `fetch-results` handler accepts three sources:

| Source | Header |
|---|---|
| Vercel internal cron | `x-vercel-cron-schedule` header (set automatically) |
| Manual / internal scripts | `Authorization: Bearer CRON_SECRET` |
| cron-job.org | `Authorization: Bearer TRIGGER_SECRET` |

Add `TRIGGER_SECRET` to the environment variables table above and to your Vercel dashboard.

## Manual Triggers (testing/recovery)

```bash
# Cron endpoints
curl https://your-app.vercel.app/api/cron/fetch-matches \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

curl https://your-app.vercel.app/api/cron/fetch-results \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

curl https://your-app.vercel.app/api/cron/db-export \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## Database Migrations

```bash
# Local dev — creates migration file and applies it
npx prisma migrate dev --name describe_the_change

# Production — applies pending migrations (no file creation)
npx prisma migrate deploy

# View/edit data
npx prisma studio
```

## Rollback

Vercel maintains deployment history. In Dashboard → Deployments → select previous → "Promote to Production".

For database rollbacks, restore from the daily JSON export (db-export cron) or use your PostgreSQL provider's point-in-time recovery.

## Post-Deployment Checklist

- [ ] `/login` works
- [ ] Admin login → `/admin` shows stats
- [ ] Leagues fetch works (API key valid)
- [ ] Matches fetch works for active leagues
- [ ] Test user can submit a prediction
- [ ] Leaderboard shows rankings
- [ ] Cron endpoints return 200 with CRON_SECRET
- [ ] Test email endpoint `/api/admin/test-email` delivers to admin inbox
- [ ] db-export cron delivers JSON backup to configured recipients
- [ ] `TRIGGER_SECRET` set in Vercel dashboard and matching the header configured in cron-job.org

## Mobile APK Distribution (Firebase App Distribution)

### Prerequisites
- Firebase project with the Android app registered
- EAS CLI installed and authenticated
- Firebase CLI installed and authenticated

### 1. Create a Firebase Project
1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. **Add project** → name it (e.g. `Antigravity Predictions`)
3. Disable Google Analytics if not needed → **Create project**

### 2. Register the Android App in Firebase
- **Firebase Project ID**: `football-prediction-18478`

1. In Firebase console → **Project settings** → **Add app** → Android
2. Enter package name: `com.maamoun.footballpredictions`
3. Download the generated `google-services.json` → replace `mobile/google-services.json`

### 3. Enable App Distribution
1. In Firebase console → left sidebar → **App Distribution**
2. Click **Get started**

### 4. Install Firebase CLI
```bash
npm install -g firebase-tools
firebase login
```

### 5. Build the APK via EAS
```bash
cd football-predictions/mobile
eas build --profile preview --platform android
```
EAS builds on Expo's cloud servers. When done, download the `.apk` from the EAS dashboard or the URL printed in the terminal.

### 6. Distribute the APK via Firebase
```bash
firebase appdistribution:distribute path/to/app.apk \
  --app android:com.maamoun.footballpredictions \
  --groups "testers" \
  --release-notes "Describe what changed in this build"
```

### 7. Add Testers
1. Firebase console → **App Distribution** → **Testers & Groups**
2. Create a group (e.g. `testers`)
3. Add tester emails — they receive an email invite to install the **Firebase App Tester** app and then your APK

### EAS Build Profiles (eas.json)
| Profile | Output | Use case |
|---|---|---|
| `development` | APK | Local dev with dev client |
| `preview` | APK | Internal distribution / Firebase |
| `production` | AAB | Google Play Store submission |

Use `--profile preview` for Firebase distribution builds.

---

## Vercel Plan Considerations

| Feature | Hobby | Pro |
|---|---|---|
| Serverless function timeout | 10s | 60s |
| Cron jobs | 2 | unlimited |
| Bandwidth | 100 GB/mo | 1 TB/mo |

If bulk operations (recalculate all predictions, large fixture fetches) time out on Hobby, upgrade to Pro for the 60s function timeout.
