# Deployment Guide

## CI/CD Pipeline

```
git push → Vercel auto-detect → Build (prisma migrate deploy && next build) → Deploy → CDN propagation
```

No formal CI/CD pipeline configured. Vercel auto-deploys on push to the main branch. The build script runs `prisma migrate deploy` (against `DIRECT_URL`) before `next build`, so every deploy applies any pending migrations automatically — this was previously a manual step and got missed once in practice (a new `Match` migration shipped in code while the production DB stayed on the old schema, causing runtime `column does not exist` errors), which is why it's now baked into `build` instead of documented as a thing to remember. `prisma migrate deploy` is a no-op when there's nothing pending, so this adds no cost to deploys with no schema change.

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

### 2. Migrations

Handled automatically by the `build` script (`prisma migrate deploy && next build`) on every Vercel deploy — no manual step, as long as `DIRECT_URL` is set in Vercel's environment variables (§6 below). To apply a migration ahead of a deploy (e.g. while testing locally against prod), run it manually:

```bash
# Run against your production database via DIRECT_URL
DIRECT_URL=postgres://... DATABASE_URL=postgres://... npx prisma migrate deploy
```

### 3. Football Provider API Key

The app supports multiple football data providers behind `src/lib/football/factory.ts`.
Set `FOOTBALL_PROVIDER` plus the matching key — see
`docs/football-providers/FOOTBALL_API_FREE_APIS.md` for full comparison and setup guides.

| `FOOTBALL_PROVIDER` | Key to set | Notes |
|---|---|---|
| `football-data` (default if unset) | `FOOTBALL_API_KEY` | Sign up at football-data.org. Free tier: 10 req/min |
| `api-football` | `API_FOOTBALL_KEY` | Sign up at dashboard.api-football.com. Free tier: 100 req/day |
| `thesportsdb` | `THESPORTSDB_API_KEY` | **Paid plan required** ($9/mo+ at thesportsdb.com/pricing) — the implementation throws without a key |

Only set the env vars for the provider you're actually running; the others are ignored.

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
CRON_SECRET=<32+ char random string>
GMAIL_USER=your-gmail@gmail.com
GMAIL_APP_PASSWORD=<16-char app password>
TRIGGER_SECRET=<32+ char random string — used by cron-job.org to authenticate fetch-results calls>

# Football provider — set FOOTBALL_PROVIDER + the matching key (see §3 above)
FOOTBALL_PROVIDER=api-football
API_FOOTBALL_KEY=<your-api-football-key>

# QStash — schedules the per-match live-goal polling chain (see "Live Goal
# Notifications" in SYSTEM_ARCHITECTURE.md). Get these from
# console.upstash.com/qstash, or install the "Upstash QStash" Vercel
# Marketplace integration to have them injected automatically.
QSTASH_URL=https://qstash.upstash.io
QSTASH_TOKEN=<from Upstash console>
QSTASH_CURRENT_SIGNING_KEY=<from Upstash console>
QSTASH_NEXT_SIGNING_KEY=<from Upstash console>
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

## Scheduled Jobs (Upstash QStash)

All recurring jobs run as **QStash Schedules** — `vercel.json` stays empty (`{}`) and cron-job.org is no longer used for anything in this app. QStash schedules a signed HTTP call on a cron expression; the destination routes verify it the same way `/api/webhooks/qstash/live-goals` does (see below), so no shared secret needs to live in the schedule config.

| Schedule ID | Endpoint | Cron | Fires | Purpose |
|---|---|---|---|---|
| `predictions-fetch-matches` | `/api/cron/fetch-matches` | `CRON_TZ=Africa/Cairo 0 20 * * 4` | Every Thursday, 8 PM Cairo local (DST-aware — QStash resolves the IANA offset itself) | Fetch fixtures for today + the next 7 days (Thursday → next Thursday) |
| `predictions-daily-reminder` | `/api/cron/daily-reminder` | `0 9 * * *` | Daily, 09:00 UTC | Remind users who haven't predicted a match kicking off in the next 24h — no-ops on days with no matches |
| `predictions-db-export` | `/api/cron/db-export` | `0 9 * * *` | Daily, 09:00 UTC | JSON backup of all DB tables → email |

`fetch-results` has **no schedule at all** — see "Live Goal Notifications" below, it's driven by the per-match QStash chain instead. `prediction-reminder` (weekly "you still have matches to predict this week" digest) is intentionally **not scheduled**; the route still exists but nothing calls it.

### Setup

```bash
# From a shell with production QSTASH_TOKEN and NEXTAUTH_URL set
# (e.g. `vercel env pull` first, or export them manually)
npm run setup-qstash-schedules
```

This runs `scripts/setup-qstash-schedules.ts`, which is idempotent — each schedule has a fixed `scheduleId`, so re-running it updates the existing schedule instead of creating duplicates. Verify at [console.upstash.com/qstash/schedules](https://console.upstash.com/qstash/schedules).

After confirming the schedules are live, **delete the corresponding jobs in cron-job.org** (Prediction Match Fetching, Predictions Daily Reminder, Prediction Daily Backup Export) — they're now redundant. Prediction Result Fetching and Prediction Weekly Reminder were already inactive there and can be deleted too.

### How the destination routes authenticate

`verifyCronRequest()` in `src/lib/cron-auth.ts` accepts any of:

| Source | Header |
|---|---|
| Vercel internal cron (if `vercel.json` crons are ever added back) | `x-vercel-cron-schedule` header (set automatically) |
| Manual / internal scripts | `Authorization: Bearer CRON_SECRET` |
| Legacy external cron trigger | `Authorization: Bearer TRIGGER_SECRET` |
| QStash schedule | `Upstash-Signature` header, verified via `Receiver.verify()` against `QSTASH_CURRENT_SIGNING_KEY`/`QSTASH_NEXT_SIGNING_KEY` — same mechanism as the live-goals webhook |

## Live Goal Notifications (Upstash QStash)

`/api/webhooks/qstash/live-goals` is called dynamically by QStash's own delayed-message scheduling, registered per-match at insert time — not a fixed schedule. This chain is also what fetches results in near-real-time (via `processFinishedMatchRealtime` when a match reaches a terminal status), which is why `fetch-results` doesn't need its own schedule. See "Live Goal Notifications" in `SYSTEM_ARCHITECTURE.md` for the full design.

### Setup
1. Create a QStash instance at [console.upstash.com/qstash](https://console.upstash.com/qstash) (or install the "Upstash QStash" integration from the Vercel Marketplace, which provisions the env vars automatically).
2. Add `QSTASH_URL`, `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY` to Vercel env vars (see §6 above).
3. No further action — new matches inserted via `fetch-matches` (QStash schedule or admin "Fetch") automatically register their own chain.

### Quota watch
Free tier: 1,000 messages/day, 10 max concurrent in-flight requests account-wide. At the app's 1.5-minute base poll interval, a ~2h match costs ~80 messages — comfortable for normal match volume, but a packed fixture day across many tracked leagues is worth watching via the Upstash console (`parallelismMax`/`parallelismCount`, and daily message count), since the tighter interval leaves less headroom than the earlier 3-minute cadence did. If usage regularly approaches the cap, either widen `LIVE_POLL_INTERVAL_SECONDS` in `src/lib/live-goal-config.ts` or move to QStash's pay-as-you-go tier ($1/100K messages, no daily cap).

### Local development
QStash calls a public HTTPS URL, so `localhost` isn't directly reachable. Run `npx @upstash/qstash-cli dev` for a local QStash-compatible server (point `QSTASH_URL` at `http://127.0.0.1:8080`), or tunnel your dev server (ngrok/cloudflared) and use the real cloud service against the tunnel URL.

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

# Production — applies pending migrations (no file creation).
# Runs automatically as part of `npm run build` on every Vercel deploy —
# this manual form is only needed to apply a migration ahead of a deploy.
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
- [ ] QStash schedules created (`npm run setup-qstash-schedules`) and visible at console.upstash.com/qstash/schedules
- [ ] Old cron-job.org jobs deleted

## Mobile Distribution (native apps)

The mobile apps are `native/ios/` (SwiftUI) and `native/android/` (Jetpack Compose). Day-to-day guide: [`docs/NATIVE_MOBILE_GUIDE.md`](../NATIVE_MOBILE_GUIDE.md).

### Android — Firebase App Distribution

- **Firebase Project ID**: `football-prediction-18478`; Android package `com.maamoun.footballpredictions`.
- `native/android/app/google-services.json` is the Firebase config. To regenerate it: Firebase console → **Project settings** → your Android app → download `google-services.json` and replace that file.
- Testers: Firebase console → **App Distribution** → **Testers & Groups** → group `testers`. Members get an email invite to install the **Firebase App Tester** app and then the APK.
- Release: run *Android (native)* from the Actions tab (`native-android-publish.yml`). It runs the unit tests, builds the signed R8 release APK and distributes it to the `testers` group.

To distribute an APK by hand:

```bash
npm install -g firebase-tools && firebase login
firebase appdistribution:distribute path/to/app.apk \
  --app <Firebase Android app id> \
  --groups "testers" \
  --release-notes "Describe what changed in this build"
```

### iOS — TestFlight

- App Store Connect app: bundle ID `com.maamoun.footballpredictions`, App ID `6766777997`. Requires Apple Developer Program membership.
- Release: run *iOS (native) — Archive → TestFlight* from the Actions tab (`native-ios-publish.yml`): XcodeGen → archive → upload. Apple processing takes ~5–15 min before the build shows in TestFlight.

**Signing (certificate created only once):** `.github/scripts/ios-signing.py` talks to the App Store Connect API and uses manual signing, so Xcode never creates certificates during a build.
- `IOS_CERTIFICATE_P12_BASE64` set → that distribution certificate ("Apple Distribution" `DISTRIBUTION` or legacy `IOS_DISTRIBUTION` type) is verified against the Apple account by serial number and reused. On a mismatch the job logs the secret's subject, serial and expiry next to the account's certificates.
- Secret empty and no distribution certificate exists in the account → one is created and stored back into the `IOS_CERTIFICATE_P12_BASE64` / `IOS_CERTIFICATE_PASSWORD` repo secrets (requires a `GH_PAT` secret with repo-secrets write access).
- Secret empty but a certificate already exists in the account → the job fails rather than creating another (its private key is unrecoverable; supply the `.p12` or revoke it).
- The App Store provisioning profile is reused if an active one contains the certificate, otherwise created.
- **Build number:** `.github/scripts/ios-build-number.py` asks App Store Connect for the highest build already uploaded and uses that + 1, so TestFlight never rejects the upload as a duplicate.
- Reusable, repo-agnostic version of this setup (stack detection, workflow template, secrets): [`docs/IOS_PUBLISH_ACTION_GUIDE.md`](../IOS_PUBLISH_ACTION_GUIDE.md).

### Required GitHub Secrets

**GitHub → Settings → Secrets and variables → Actions:**

| Secret | Used by | Value |
|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | Android | Firebase service account JSON — Firebase console → Project settings → Service accounts → **Generate new private key**; paste the whole file |
| `APPLE_TEAM_ID` | iOS | Apple Developer team ID |
| `ASC_API_KEY_ID` | iOS | App Store Connect API key ID (from the `.p8` filename) |
| `ASC_API_KEY_ISSUER_ID` | iOS | UUID at the top of App Store Connect → Users and Access → [Keys](https://appstoreconnect.apple.com/access/integrations/api) |
| `ASC_API_KEY_CONTENT` | iOS | Full contents of the `AuthKey_<id>.p8` file, including the `-----BEGIN/END PRIVATE KEY-----` lines |
| `IOS_CERTIFICATE_P12_BASE64`, `IOS_CERTIFICATE_PASSWORD` | iOS | Distribution certificate (see Signing above) |
| `GH_PAT` | iOS | Only needed when the signing script has to store a newly created certificate back into the repo secrets |

`.p8` key files are git-ignored; keep them outside the repo.

### TestFlight: Internal Testing

Internal testers are Apple Developer team members — no Beta App Review required, available immediately after Apple processing.

1. App Store Connect → your app → **TestFlight** tab
2. Left sidebar → **Internal Testing** → click **+** to create a group
3. Add testers by **Apple ID email** — they must first be added as team members (**Users and Access** → **People** → **+**)
4. Once the build finishes processing, select it and assign it to the group
5. Testers receive an email → install **TestFlight** app → install your build

### TestFlight: External Testing

External testers do **not** need to be team members. Requires a one-time **Beta App Review** by Apple (usually a few hours, up to 1 business day).

1. App Store Connect → **TestFlight** → left sidebar → **+** next to **External Testing**
2. Name the group and add testers by email — up to 10,000 testers
3. Select the build to test → **Submit for Beta Review** and fill in **Test Information**
4. Apple reviews → testers receive an email → install **TestFlight** → install your build

---

## Native Apps CI (`native/`)

| Workflow | Trigger | What it does |
|---|---|---|
| `native-checks.yml` | PRs touching `native/**` | `native-parity` (both platforms changed or a `Parity: …-only` waiver), `tokens-drift` (`generate.mjs --check`), `android-test` (unit/fixture tests + debug build), `ios-test` (macos-26; only when iOS/contract changed) |
| `native-ios-publish.yml` | **manual** (`push` trigger commented) | XcodeGen → archive (manual signing from `project.yml`, reusing `.github/scripts/ios-signing.py` / `ios-build-number.py`) → TestFlight. Expected ~4–7 min: no npm/Expo/CocoaPods. SPM cache keyed on `project.yml` |
| `native-android-publish.yml` | **manual** (`push` trigger commented) | Unit tests → signed R8 release APK (`versionCode` = run number + 1000, `versionName` from `native/VERSION`) → Firebase App Distribution (same app id and `testers` group) |

The Expo / React Native app (`mobile/`) and its workflows (`ios-publish.yml`, `android-publish.yml`) were removed in October 2026; the native workflows are the only mobile pipeline. They upload to the same TestFlight / Firebase apps the RN builds used. Both are still `workflow_dispatch`-only — uncomment the `push` block in each file to publish automatically on changes under `native/`.

**Android signing:** no new secrets. The native workflow builds the release variant (R8, production API) signed with the committed `native/android/app/debug.keystore` (the standard Android debug key, the same one the old RN builds used), so testers can update in place. To ship with a real key later, set `ANDROID_KEYSTORE_PATH`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` in the workflow env (`build.gradle.kts` already honours them). iOS secrets are unchanged.

## Vercel Plan Considerations

| Feature | Hobby | Pro |
|---|---|---|
| Serverless function timeout | 10s | 60s |
| Cron jobs | 2 | unlimited |
| Bandwidth | 100 GB/mo | 1 TB/mo |

If bulk operations (recalculate all predictions, large fixture fetches) time out on Hobby, upgrade to Pro for the 60s function timeout.
