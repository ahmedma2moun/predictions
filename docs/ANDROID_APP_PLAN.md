# Android App — Implementation Plan & Agent Task List

Native Android client for the Football Predictions app. This document is written for Claude Code agents: every task is atomic, every file path is exact, every code contract is fully specified. Read the **Agent Context** section before starting any phase.

---

## System Overview

```
[Android App]  ──Bearer JWT──►  [/api/mobile/* (new route group, same Vercel deployment)]
                                       │
                                       ├── reuses: prisma, scoring-engine, utils, leaderboard
                                       ├── new:    mobile-auth.ts, fcm.ts
                                       └── DB: DeviceToken (new table)

[Vercel Crons — schedule unchanged]
   fetch-matches       ──► email (existing) + FCM push (new, parallel)
   fetch-results       ──► email (existing) + FCM push (new, parallel)
   prediction-reminder ──► email (existing) + FCM push (new, parallel)
   daily-reminder      ──► email (existing) + FCM push (new, parallel)

[Firebase Cloud Messaging] ──► [Android device notification]
```

---

## Agent Context

> **Read this before touching any file.** This summarises everything about the existing codebase that is relevant to the tasks below.

### Repository root
`d:/Antigravity/Matches Prediction/football-predictions/`

### Existing stack
- Next.js 16.2.1, TypeScript 5, React 19.2.4, Tailwind CSS 4
- NextAuth v5 (`next-auth@5.0.0-beta.30`), JWT strategy, credentials provider
- PostgreSQL via Prisma 6.19.3
- Deployed on Vercel

### Existing packages already installed
`bcryptjs`, `date-fns`, `nodemailer`, `next-auth` — do NOT reinstall these.

### Packages that must be installed for this plan
```
firebase-admin   jose
```

### Key existing files an agent will need to read before editing
| File | Why |
|---|---|
| `prisma/schema.prisma` | Add `DeviceToken` model and `User.deviceTokens` relation |
| `src/lib/auth.ts` | Copy the `bcrypt.compare` credential logic into the mobile login route |
| `src/lib/utils.ts` | `isMatchLocked(kickoffTime)` — must be called in `POST /api/mobile/predictions` |
| `src/lib/scoring-engine.ts` | `calculateScore()` — already used by `results-processor.ts`, no changes needed |
| `src/lib/matches-processor.ts` | Add FCM push after the `sendNewMatchesEmail` loop (lines ~131–156) |
| `src/lib/results-processor.ts` | Add FCM push after the `sendResultsEmail` loop (lines ~164–183) |
| `src/app/api/cron/prediction-reminder/route.ts` | Add FCM push after `sendPredictionReminderEmail` call |
| `src/app/api/cron/daily-reminder/route.ts` | Add FCM push after `sendDailyReminderEmail` call |
| `src/app/api/matches/route.ts` | Reference implementation for `GET /api/mobile/matches` |
| `src/app/api/predictions/route.ts` | Reference implementation for `GET/POST /api/mobile/predictions` |
| `src/lib/leaderboard.ts` | Import `getUserGroupLeaderboards` for leaderboard route |
| `src/models/Match.ts` | `serializeMatch()` — must be called on every match before returning to client |

### Invariants that must never be broken
- **Never** call Football API functions from user-facing routes (rate limit constraint)
- **Always** call `isMatchLocked(match.kickoffTime)` before saving a prediction
- **Always** `.toString()` Prisma integer `id` fields before returning them to the client
- **Never** return `$queryRaw` BigInt without wrapping in `Number()`
- **Never** modify any file under `src/app/api/` except those listed in the task list
- All existing web routes (`/api/matches`, `/api/predictions`, etc.) must remain **completely unchanged**
- In Next.js 16, route handler `params` are Promises — always `await params`

### Existing notification email functions (in `src/lib/email.ts`)
| Function | When called |
|---|---|
| `sendNewMatchesEmail(to, matches)` | `src/lib/matches-processor.ts` after inserting new matches |
| `sendResultsEmail(to, matches, leaderboards)` | `src/lib/results-processor.ts` after scoring predictions |
| `sendPredictionReminderEmail(to, matches)` | `src/app/api/cron/prediction-reminder/route.ts` |
| `sendDailyReminderEmail(to, matches)` | `src/app/api/cron/daily-reminder/route.ts` |

### Push notification data types
Every FCM push must include a `data` object with a `type` field so the Android app routes the tap to the correct screen:

| Event | `data.type` | Android tap target |
|---|---|---|
| New matches fetched | `new_matches` | Matches screen |
| Results scored | `results` | Predictions screen |
| Weekly reminder | `prediction_reminder` | Matches screen |
| Daily reminder | `daily_reminder` | Matches screen |

---

## Master Checklist

### Phase 0 — Firebase (manual, human must do)
- [ ] P0-A: Create Firebase project named `football-predictions`
- [ ] P0-B: Register Android app with package `com.maamoun.footballpredictions`, download `google-services.json`
- [ ] P0-C: Generate service account private key, base64-encode, add as `FIREBASE_SERVICE_ACCOUNT_JSON` to Vercel env vars (Production + Preview + Development)
- [ ] P0-D: Delete the raw `firebase-service-account.json` from disk after encoding

### Phase 1 — Backend (Next.js project)
- [ ] B1: Install `firebase-admin` and `jose`
- [ ] B2: Add `DeviceToken` model to `prisma/schema.prisma` and `deviceTokens` relation to `User`
- [ ] B3: Run Prisma migration `add_device_tokens`
- [ ] B4: Create `src/lib/fcm.ts`
- [ ] B5: Create `src/lib/mobile-auth.ts`
- [ ] B6: Create `src/app/api/mobile/auth/login/route.ts`
- [ ] B7: Create `src/app/api/mobile/devices/route.ts`
- [ ] B8: Create `src/app/api/mobile/matches/route.ts`
- [ ] B9: Create `src/app/api/mobile/predictions/route.ts`
- [ ] B10: Create `src/app/api/mobile/leaderboard/route.ts`
- [ ] B11: Create `src/app/api/mobile/profile/route.ts`
- [ ] B12: Wire FCM push into `src/lib/matches-processor.ts`
- [ ] B13: Wire FCM push into `src/lib/results-processor.ts`
- [ ] B14: Wire FCM push into `src/app/api/cron/prediction-reminder/route.ts`
- [ ] B15: Wire FCM push into `src/app/api/cron/daily-reminder/route.ts`
- [ ] B16: Run `npm run build` — must produce zero type errors
- [ ] B17: Smoke-test all mobile API routes with `curl` (see verification commands in Phase 1 detail)

### Phase 2 — Android app
- [ ] A1: Create Android Studio project with package `com.maamoun.footballpredictions`
- [ ] A2: Configure project-level `build.gradle.kts`
- [ ] A3: Configure app-level `app/build.gradle.kts`
- [ ] A4: Place `google-services.json` in `app/`
- [ ] A5: Create `AndroidManifest.xml` with all required permissions and service declarations
- [ ] A6: Create `FootballPredictionsApp.kt` (Application class — Hilt entry point + notification channel)
- [ ] A7: Create data models (`Match.kt`, `Prediction.kt`, `LeaderboardEntry.kt`, `User.kt`)
- [ ] A8: Create `MobileApi.kt` (Retrofit interface)
- [ ] A9: Create `AuthInterceptor.kt`
- [ ] A10: Create `AppModule.kt` (Hilt module)
- [ ] A11: Create `RepositoryModule.kt` (Hilt module)
- [ ] A12: Create `EncryptedPrefs.kt` (token storage helper)
- [ ] A13: Create `AuthRepository.kt`
- [ ] A14: Create `MatchRepository.kt`
- [ ] A15: Create `PredictionRepository.kt`
- [ ] A16: Create `LeaderboardRepository.kt`
- [ ] A17: Create `LoginViewModel.kt` + `LoginScreen.kt`
- [ ] A18: Create `MatchesViewModel.kt` + `MatchesScreen.kt` + `MatchCard.kt`
- [ ] A19: Create `PredictionsViewModel.kt` + `PredictionsScreen.kt`
- [ ] A20: Create `LeaderboardViewModel.kt` + `LeaderboardScreen.kt`
- [ ] A21: Create `ProfileViewModel.kt` + `ProfileScreen.kt`
- [ ] A22: Create `AppNavigation.kt`
- [ ] A23: Create `MainActivity.kt`
- [ ] A24: Create `FcmService.kt`
- [ ] A25: Create `theme/Theme.kt`
- [ ] A26: Build project — must compile with zero errors

### Phase 3 — Distribution
- [ ] D1: Generate keystore (`~/keystores/football-predictions.jks`), back it up
- [ ] D2: Generate signed release APK
- [ ] D3: Install on test device and verify all screens + push notifications end-to-end
- [ ] D4: Share APK with group

---

## Phase 0 — Firebase Setup (Manual Steps)

These steps require a browser and cannot be automated. Complete them before starting Phase 1.

### P0-A · Create Firebase project
1. Open [console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project** → name: `football-predictions`
3. Toggle Google Analytics **off** → **Create project**

### P0-B · Register the Android app
1. In project overview, click the **Android** icon
2. **Android package name:** `com.maamoun.footballpredictions`
3. **App nickname:** Football Predictions
4. **SHA-1:** leave blank (add later for Play Store if needed)
5. Click **Register app**
6. Download `google-services.json` — keep it safe, you will place it in the Android project at task A4
7. Click through the remaining wizard steps without making SDK changes (SDK will be added via Gradle)

### P0-C · Generate service account key for Vercel
1. Firebase console → gear icon (top-left) → **Project Settings**
2. Tab: **Service accounts**
3. Click **Generate new private key** → confirm → JSON downloads (e.g. `football-predictions-firebase-adminsdk-xxxx.json`)
4. **Do not commit this file**

   Encode it (Windows PowerShell):
   ```powershell
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("path\to\firebase-adminsdk.json"))
   ```

   Encode it (Mac/Linux):
   ```bash
   base64 -i path/to/firebase-adminsdk.json | tr -d '\n'
   ```

5. Copy the single-line base64 string
6. In Vercel → project → **Settings → Environment Variables** → add:
   - **Key:** `FIREBASE_SERVICE_ACCOUNT_JSON`
   - **Value:** the base64 string (no line breaks)
   - **Environments:** check Production, Preview, Development
7. Save

### P0-D · Clean up
Delete the raw JSON file from disk — it is a live credential:
```powershell
Remove-Item "path\to\firebase-adminsdk.json"
```

**Verification:** confirm `FIREBASE_SERVICE_ACCOUNT_JSON` appears in the Vercel env vars list.

---

## Phase 1 — Backend Tasks (Next.js Project)

Work directory for all tasks in this phase: `d:/Antigravity/Matches Prediction/football-predictions/`

---

### B1 · Install dependencies

```bash
npm install firebase-admin jose
```

**Verify:** `package.json` now contains `"firebase-admin"` and `"jose"` in `dependencies`.

---

### B2 · Update Prisma schema

**File to edit:** `prisma/schema.prisma`

Make exactly two changes:

**Change 1** — add `deviceTokens` relation to the `User` model. The `User` model currently ends with `groupMembers GroupMember[]`. Add one line after it:
```prisma
  deviceTokens DeviceToken[]
```

**Change 2** — append the following new model at the end of the file (after `TeamStanding`):
```prisma
model DeviceToken {
  id        Int      @id @default(autoincrement())
  userId    Int
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  token     String   @unique
  platform  String   @default("android")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId])
}
```

**Verify:** `npx prisma validate` exits with no errors.

---

### B3 · Run Prisma migration

```bash
npx prisma migrate dev --name add_device_tokens
```

**Verify:** migration file appears in `prisma/migrations/`, `npx prisma studio` shows a `DeviceToken` table.

---

### B4 · Create `src/lib/fcm.ts`

Create this file exactly as shown. It is a self-contained singleton — no other existing file needs to be modified to use it.

```ts
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { prisma } from './prisma';

function initFirebase(): void {
  if (getApps().length > 0) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON env var is not set');
  const serviceAccount = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
  initializeApp({ credential: cert(serviceAccount) });
}

/**
 * Sends a push notification to every registered Android device belonging to
 * the given user IDs. Silently deletes stale tokens FCM marks as unregistered.
 * Failures are thrown to callers — wrap in try/catch at call sites.
 */
export async function sendPushToUsers(
  userIds: number[],
  notification: {
    title: string;
    body: string;
    data?: Record<string, string>;
  },
): Promise<void> {
  if (userIds.length === 0) return;
  initFirebase();

  const deviceTokens = await prisma.deviceToken.findMany({
    where: { userId: { in: userIds } },
    select: { id: true, token: true },
  });
  if (deviceTokens.length === 0) return;

  const response = await getMessaging().sendEachForMulticast({
    tokens: deviceTokens.map(d => d.token),
    notification: { title: notification.title, body: notification.body },
    data: notification.data ?? {},
    android: {
      priority: 'high',
      notification: { channelId: 'predictions' },
    },
  });

  // Clean up tokens FCM reports as permanently invalid
  const staleIds: number[] = [];
  response.responses.forEach((r, i) => {
    if (
      !r.success &&
      r.error?.code === 'messaging/registration-token-not-registered'
    ) {
      staleIds.push(deviceTokens[i].id);
    }
  });
  if (staleIds.length > 0) {
    await prisma.deviceToken.deleteMany({ where: { id: { in: staleIds } } });
  }
}
```

**Verify:** `npx tsc --noEmit` passes after creating this file.

---

### B5 · Create `src/lib/mobile-auth.ts`

Signs and verifies 30-day Bearer JWTs using the existing `NEXTAUTH_SECRET`. No new secrets are required.

```ts
import { SignJWT, jwtVerify } from 'jose';
import type { NextRequest } from 'next/server';

export interface MobileSession {
  id: string;
  email: string;
  name: string;
  role: string;
}

const getSecret = () => new TextEncoder().encode(process.env.NEXTAUTH_SECRET!);

export async function signMobileJwt(user: MobileSession): Promise<string> {
  return new SignJWT({ id: user.id, email: user.email, name: user.name, role: user.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(await getSecret());
}

export async function verifyMobileJwt(token: string): Promise<MobileSession | null> {
  try {
    const { payload } = await jwtVerify(token, await getSecret());
    return payload as unknown as MobileSession;
  } catch {
    return null;
  }
}

/**
 * Reads and verifies the Bearer token from the Authorization header.
 * Returns null if the header is missing, malformed, or the token is invalid/expired.
 */
export async function getMobileSession(req: NextRequest): Promise<MobileSession | null> {
  const header = req.headers.get('authorization') ?? '';
  if (!header.startsWith('Bearer ')) return null;
  return verifyMobileJwt(header.slice(7));
}
```

**Verify:** `npx tsc --noEmit` passes.

---

### B6 · Create `src/app/api/mobile/auth/login/route.ts`

Validates credentials (same logic as `src/lib/auth.ts` `authorize()`) and returns a signed JWT.

**Request:** `POST /api/mobile/auth/login`
```json
{ "email": "string", "password": "string" }
```

**Response 200:**
```json
{
  "token": "<jwt-string>",
  "user": { "id": "1", "name": "string", "email": "string", "role": "user|admin" }
}
```

**Response 401:** `{ "error": "Invalid credentials" }`

```ts
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { signMobileJwt } from '@/lib/mobile-auth';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const email = (body?.email as string | undefined)?.toLowerCase().trim();
  const password = body?.password as string | undefined;

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const token = await signMobileJwt({
    id: user.id.toString(),
    email: user.email,
    name: user.name,
    role: user.role,
  });

  return NextResponse.json({
    token,
    user: {
      id: user.id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
}
```

---

### B7 · Create `src/app/api/mobile/devices/route.ts`

Registers (`POST`) and unregisters (`DELETE`) FCM device tokens. Called by the Android app immediately after login and on logout.

**POST request:** `{ "fcmToken": "string" }`
**POST response 200:** `{ "success": true }`

**DELETE request:** `{ "fcmToken": "string" }`
**DELETE response 200:** `{ "success": true }`

Both endpoints require a valid Bearer token. Upsert is used on POST so re-registration is always safe.

```ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getMobileSession } from '@/lib/mobile-auth';

export async function POST(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { fcmToken } = await req.json();
  if (!fcmToken || typeof fcmToken !== 'string') {
    return NextResponse.json({ error: 'fcmToken is required' }, { status: 400 });
  }

  await prisma.deviceToken.upsert({
    where: { token: fcmToken },
    create: { userId: Number(session.id), token: fcmToken, platform: 'android' },
    update: { userId: Number(session.id), updatedAt: new Date() },
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { fcmToken } = await req.json();
  if (!fcmToken || typeof fcmToken !== 'string') {
    return NextResponse.json({ error: 'fcmToken is required' }, { status: 400 });
  }

  await prisma.deviceToken.deleteMany({
    where: { token: fcmToken, userId: Number(session.id) },
  });

  return NextResponse.json({ success: true });
}
```

---

### B8 · Create `src/app/api/mobile/matches/route.ts`

Returns matches for the current week with the authenticated user's prediction embedded. Mirrors the logic in `src/app/api/matches/route.ts` but authenticates via Bearer token.

**Query params:** `week` (ISO date string), `leagueId` (number), `status` (MatchStatus)  
If no `week` param, returns matches where `status` is `scheduled`, `live`, or `finished`.

**Response 200:** array of serialized matches, each including a `prediction` field (or `null`):
```json
[
  {
    "id": "42",
    "homeTeamName": "...",
    "awayTeamName": "...",
    "kickoffTime": "...",
    "status": "scheduled",
    "prediction": { "homeScore": 2, "awayScore": 1, "predictedWinner": "home", "pointsAwarded": 7 }
  }
]
```

Read `src/app/api/matches/route.ts` for the exact Prisma query and serialization logic, then replicate it substituting `const session = await getMobileSession(req)` for `const session = await auth()`. The `serializeMatch()` call from `@/models/Match` must still be used. Admin check (`isAdmin`) should remain — use `session.role === 'admin'`.

---

### B9 · Create `src/app/api/mobile/predictions/route.ts`

**GET** — returns the authenticated user's prediction history.  
**POST** — submits or updates a prediction.

Read `src/app/api/predictions/route.ts` for the exact implementation, then replicate substituting `getMobileSession(req)` for `auth()`. The `isMatchLocked` check from `@/lib/utils` must be retained on POST — this is a hard invariant.

**POST request body:**
```json
{ "matchId": "42", "homeScore": 2, "awayScore": 1 }
```

**POST response 200:**
```json
{ "success": true, "prediction": { "_id": "99", ... } }
```

**POST response 400:** `{ "error": "Match has already started" }` when locked.

---

### B10 · Create `src/app/api/mobile/leaderboard/route.ts`

Returns all-time leaderboard (total points per user across all scored predictions).

**Query params:** `groupId` (optional number) — filter to a specific group.

**Response 200:**
```json
[
  { "userId": "1", "name": "Ahmed", "totalPoints": 42, "rank": 1 }
]
```

Read `src/lib/leaderboard.ts` — use `getUserGroupLeaderboards` or the raw Prisma aggregate already used by the web leaderboard route (`src/app/api/leaderboard/route.ts`). Authenticate with `getMobileSession(req)`.

---

### B11 · Create `src/app/api/mobile/profile/route.ts`

Returns the authenticated user's name, email, and role. No DB query needed — data is in the JWT.

**Response 200:**
```json
{ "id": "1", "name": "Ahmed", "email": "ahmed@example.com", "role": "user" }
```

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getMobileSession } from '@/lib/mobile-auth';

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({
    id: session.id,
    name: session.name,
    email: session.email,
    role: session.role,
  });
}
```

---

### B12 · Wire FCM push into `src/lib/matches-processor.ts`

**Where:** inside the `if (inserted > 0)` block, after the `for (const user of recipients)` email loop finishes (approximately line 153). The email loop iterates per user; the push call sends to all users at once.

**What to add** (immediately after the email loop closes, still inside the outer `try`):
```ts
// Push notification — mirror of the email above
const allUserIds = recipients.map(u => u.userId ?? 0).filter(Boolean);
// NOTE: recipients here is the list of users with notificationEmail — but push
// should go to ALL users with device tokens, not just those with email set.
// Re-query for users with device tokens:
const mobileUserIds = await prisma.deviceToken.findMany({
  select: { userId: true },
  distinct: ['userId'],
});
const pushUserIds = mobileUserIds.map(d => d.userId);
try {
  await sendPushToUsers(pushUserIds, {
    title: 'New matches this week',
    body: `${inserted} match${inserted > 1 ? 'es' : ''} added — place your predictions!`,
    data: { type: 'new_matches' },
  });
} catch (e) {
  console.error(`[${logPrefix}] FCM push failed:`, e);
}
```

**Import to add at the top of the file:**
```ts
import { sendPushToUsers } from './fcm';
```

**Important:** push targets ALL users with registered device tokens, not just those with `notificationEmail` set. The email and push recipient sets are independent.

---

### B13 · Wire FCM push into `src/lib/results-processor.ts`

**Where:** inside the `if (userMatchMap.size > 0)` block, after the `for (const user of users)` email loop (approximately line 182). `userMatchMap` keys are the user IDs who had predictions scored.

**What to add** (immediately after the email loop, still inside the outer `try`):
```ts
// FCM push — send results notification to all users who had predictions scored
const scoredUserIds = [...userMatchMap.keys()];
try {
  // We can't know individual points here without mapping — use a generic body
  await sendPushToUsers(scoredUserIds, {
    title: 'Results are in!',
    body: 'Your predictions have been scored — tap to see how you did.',
    data: { type: 'results' },
  });
} catch (e) {
  console.error(`[${logPrefix}] FCM push failed:`, e);
}
```

**Import to add at the top of the file:**
```ts
import { sendPushToUsers } from './fcm';
```

---

### B14 · Wire FCM push into `src/app/api/cron/prediction-reminder/route.ts`

**Where:** after the `for (const user of users)` loop that sends reminder emails. At this point `remindedUsers` count has been accumulated but user IDs are not collected — add collection.

**Change 1:** Inside the `for (const user of users)` loop, after incrementing `remindedUsers++`, collect the user ID:
```ts
remindedUserIds.push(user.id);
```

**Change 2:** Declare `remindedUserIds` before the loop:
```ts
const remindedUserIds: number[] = [];
```

**Change 3:** After the loop ends (before the `summary` object):
```ts
// FCM push — send to all users with device tokens who have missing predictions
// (independent of whether they have an email set)
const allMobileUsers = await prisma.deviceToken.findMany({
  select: { userId: true },
  distinct: ['userId'],
});
// Filter to users who actually have missing predictions (same logic as above but for mobile-only users)
// For simplicity: push to all mobile users — the app will show current state when opened
try {
  await sendPushToUsers(allMobileUsers.map(d => d.userId), {
    title: "Don't forget to predict!",
    body: 'You still have matches without a prediction this week.',
    data: { type: 'prediction_reminder' },
  });
} catch (e) {
  console.error('[cron/prediction-reminder] FCM push failed:', e);
}
```

**Import to add at the top of the file:**
```ts
import { sendPushToUsers } from '@/lib/fcm';
```

---

### B15 · Wire FCM push into `src/app/api/cron/daily-reminder/route.ts`

**Where:** after the `for (const user of users)` email loop, before the `summary` object.

**What to add:**
```ts
// FCM push — send to all mobile users (app shows current state when opened)
const allMobileUsers = await prisma.deviceToken.findMany({
  select: { userId: true },
  distinct: ['userId'],
});
try {
  await sendPushToUsers(allMobileUsers.map(d => d.userId), {
    title: 'Matches today!',
    body: `${todayMatches.length} match${todayMatches.length > 1 ? 'es kick' : ' kicks'} off today — predict before the whistle!`,
    data: { type: 'daily_reminder' },
  });
} catch (e) {
  console.error('[cron/daily-reminder] FCM push failed:', e);
}
```

**Import to add at the top of the file:**
```ts
import { sendPushToUsers } from '@/lib/fcm';
```

---

### B16 · Build verification

```bash
npm run build
```

Must exit with code 0. Fix any TypeScript errors before proceeding to Phase 2.

---

### B17 · Smoke-test API routes with curl

Replace `<BASE_URL>` with the Vercel preview URL or `http://localhost:3000`.
Replace `<EMAIL>` and `<PASSWORD>` with the seeded admin credentials (`admin@predictions.app` / `changeme123`).

```bash
# 1. Login — capture the token
TOKEN=$(curl -s -X POST <BASE_URL>/api/mobile/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"<EMAIL>","password":"<PASSWORD>"}' | jq -r '.token')

echo "Token: $TOKEN"

# 2. Profile
curl -s <BASE_URL>/api/mobile/profile \
  -H "Authorization: Bearer $TOKEN" | jq .

# 3. Matches
curl -s "<BASE_URL>/api/mobile/matches" \
  -H "Authorization: Bearer $TOKEN" | jq 'length'

# 4. Leaderboard
curl -s <BASE_URL>/api/mobile/leaderboard \
  -H "Authorization: Bearer $TOKEN" | jq .

# 5. Predictions list
curl -s <BASE_URL>/api/mobile/predictions \
  -H "Authorization: Bearer $TOKEN" | jq 'length'

# 6. Register a dummy device token
curl -s -X POST <BASE_URL>/api/mobile/devices \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fcmToken":"test-token-smoke-test"}' | jq .

# 7. Unregister it
curl -s -X DELETE <BASE_URL>/api/mobile/devices \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fcmToken":"test-token-smoke-test"}' | jq .
```

All responses should be 200 with valid JSON and no `error` fields.

---

## Phase 2 — Android App Tasks

**Project location:** `d:/Antigravity/Matches Prediction/football-predictions-android/`  
**Create this project via Android Studio:** File → New → New Project → Empty Activity → configure as below.

### Android project settings
| Setting | Value |
|---|---|
| Name | Football Predictions |
| Package name | `com.maamoun.footballpredictions` |
| Save location | `d:/Antigravity/Matches Prediction/football-predictions-android/` |
| Language | Kotlin |
| Minimum SDK | API 26 (Android 8.0) |
| Build configuration language | Kotlin DSL (`build.gradle.kts`) |

---

### A1 · Create Android Studio project

Use Android Studio wizard with the settings above. Android Studio generates the scaffolding; subsequent tasks fill in the actual code.

---

### A2 · Configure project-level `build.gradle.kts`

Replace the `plugins` block with:
```kotlin
plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.kotlin.android) apply false
    alias(libs.plugins.kotlin.compose) apply false
    id("com.google.gms.google-services") version "4.4.2" apply false
    id("com.google.dagger.hilt.android") version "2.51" apply false
    kotlin("plugin.serialization") version "2.0.21" apply false
}
```

---

### A3 · Configure `app/build.gradle.kts`

Full file content (replaces Android Studio's generated version):

```kotlin
plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    id("com.google.gms.google-services")
    id("com.google.dagger.hilt.android")
    kotlin("plugin.serialization")
    kotlin("kapt")
}

android {
    namespace = "com.maamoun.footballpredictions"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.maamoun.footballpredictions"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }

    kotlinOptions { jvmTarget = "11" }

    buildFeatures { compose = true }
}

dependencies {
    // Compose BOM
    implementation(platform("androidx.compose:compose-bom:2024.09.00"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.activity:activity-compose:1.9.2")
    debugImplementation("androidx.compose.ui:ui-tooling")

    // Navigation
    implementation("androidx.navigation:navigation-compose:2.8.0")

    // Hilt
    implementation("com.google.dagger:hilt-android:2.51")
    kapt("com.google.dagger:hilt-android-compiler:2.51")
    implementation("androidx.hilt:hilt-navigation-compose:1.2.0")

    // Networking
    implementation("com.squareup.retrofit2:retrofit:2.11.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")
    implementation("com.jakewharton.retrofit:retrofit2-kotlinx-serialization-converter:1.0.0")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.1")

    // Image loading
    implementation("io.coil-kt.coil3:coil-compose:3.0.4")
    implementation("io.coil-kt.coil3:coil-network-okhttp:3.0.4")

    // Security (EncryptedSharedPreferences)
    implementation("androidx.security:security-crypto:1.1.0-alpha06")

    // Firebase
    implementation(platform("com.google.firebase:firebase-bom:33.4.0"))
    implementation("com.google.firebase:firebase-messaging-ktx")

    // Coroutines + ViewModel
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.5")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.5")

    // Core
    implementation("androidx.core:core-ktx:1.13.1")
}
```

---

### A4 · Place `google-services.json`

Copy the `google-services.json` downloaded in P0-B into `app/google-services.json` (same directory as `app/build.gradle.kts`).

**Verify:** Android Studio shows a green indicator next to `google-services.json` in the project view and no sync errors.

---

### A5 · `AndroidManifest.xml`

File: `app/src/main/AndroidManifest.xml`

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

    <application
        android:name=".FootballPredictionsApp"
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/Theme.FootballPredictions">

        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:theme="@style/Theme.FootballPredictions">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <service
            android:name=".notification.FcmService"
            android:exported="false">
            <intent-filter>
                <action android:name="com.google.firebase.MESSAGING_EVENT" />
            </intent-filter>
        </service>

    </application>
</manifest>
```

---

### A6 · `FootballPredictionsApp.kt`

File: `app/src/main/java/com/antigravity/footballpredictions/FootballPredictionsApp.kt`

Application class — Hilt entry point and notification channel creator.

```kotlin
package com.maamoun.footballpredictions

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import com.maamoun.footballpredictions.notification.FcmService
import dagger.hilt.android.HiltAndroidApp

@HiltAndroidApp
class FootballPredictionsApp : Application() {

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            FcmService.CHANNEL_ID,
            "Match Predictions",
            NotificationManager.IMPORTANCE_DEFAULT
        ).apply {
            description = "Match reminders and results"
        }
        getSystemService(NotificationManager::class.java)
            .createNotificationChannel(channel)
    }
}
```

---

### A7 · Data models

All models use `@Serializable` from `kotlinx.serialization`. Place each in `app/src/main/java/com/antigravity/footballpredictions/data/model/`.

**`Match.kt`**
```kotlin
package com.maamoun.footballpredictions.data.model

import kotlinx.serialization.Serializable

@Serializable
data class Match(
    val id: String,
    val homeTeamName: String,
    val awayTeamName: String,
    val homeTeamLogo: String? = null,
    val awayTeamLogo: String? = null,
    val kickoffTime: String,          // ISO-8601 UTC string from API
    val status: String,               // "scheduled" | "live" | "finished" | "postponed" | "cancelled"
    val leagueId: String? = null,
    val resultHomeScore: Int? = null,
    val resultAwayScore: Int? = null,
    val prediction: PredictionSummary? = null,
)

@Serializable
data class PredictionSummary(
    val homeScore: Int,
    val awayScore: Int,
    val predictedWinner: String,
    val pointsAwarded: Int,
)
```

**`Prediction.kt`**
```kotlin
package com.maamoun.footballpredictions.data.model

import kotlinx.serialization.Serializable

@Serializable
data class Prediction(
    val id: String? = null,
    val matchId: String,
    val homeScore: Int,
    val awayScore: Int,
    val predictedWinner: String,
    val pointsAwarded: Int = 0,
    val match: Match? = null,
)
```

**`LeaderboardEntry.kt`**
```kotlin
package com.maamoun.footballpredictions.data.model

import kotlinx.serialization.Serializable

@Serializable
data class LeaderboardEntry(
    val userId: String,
    val name: String,
    val totalPoints: Int,
    val rank: Int,
)
```

**`User.kt`**
```kotlin
package com.maamoun.footballpredictions.data.model

import kotlinx.serialization.Serializable

@Serializable
data class User(
    val id: String,
    val name: String,
    val email: String,
    val role: String,
)

@Serializable
data class LoginRequest(val email: String, val password: String)

@Serializable
data class LoginResponse(val token: String, val user: User)

@Serializable
data class DeviceTokenRequest(val fcmToken: String)

@Serializable
data class PredictionRequest(val matchId: String, val homeScore: Int, val awayScore: Int)

@Serializable
data class GenericSuccess(val success: Boolean)
```

---

### A8 · `MobileApi.kt`

File: `app/src/main/java/com/antigravity/footballpredictions/data/api/MobileApi.kt`

```kotlin
package com.maamoun.footballpredictions.data.api

import com.maamoun.footballpredictions.data.model.*
import retrofit2.http.*

interface MobileApi {

    @POST("api/mobile/auth/login")
    suspend fun login(@Body request: LoginRequest): LoginResponse

    @POST("api/mobile/devices")
    suspend fun registerDevice(@Body request: DeviceTokenRequest): GenericSuccess

    @DELETE("api/mobile/devices")
    suspend fun unregisterDevice(@Body request: DeviceTokenRequest): GenericSuccess

    @GET("api/mobile/matches")
    suspend fun getMatches(
        @Query("week") week: String? = null,
        @Query("leagueId") leagueId: Int? = null,
        @Query("status") status: String? = null,
    ): List<Match>

    @POST("api/mobile/predictions")
    suspend fun submitPrediction(@Body request: PredictionRequest): GenericSuccess

    @GET("api/mobile/predictions")
    suspend fun getPredictions(): List<Prediction>

    @GET("api/mobile/leaderboard")
    suspend fun getLeaderboard(@Query("groupId") groupId: Int? = null): List<LeaderboardEntry>

    @GET("api/mobile/profile")
    suspend fun getProfile(): User
}
```

---

### A9 · `AuthInterceptor.kt`

File: `app/src/main/java/com/antigravity/footballpredictions/data/api/AuthInterceptor.kt`

Attaches the stored JWT as a Bearer token to every request.

```kotlin
package com.maamoun.footballpredictions.data.api

import com.maamoun.footballpredictions.data.local.EncryptedPrefs
import okhttp3.Interceptor
import okhttp3.Response
import javax.inject.Inject

class AuthInterceptor @Inject constructor(
    private val encryptedPrefs: EncryptedPrefs,
) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val token = encryptedPrefs.getToken()
        val request = if (token != null) {
            chain.request().newBuilder()
                .addHeader("Authorization", "Bearer $token")
                .build()
        } else {
            chain.request()
        }
        return chain.proceed(request)
    }
}
```

---

### A10 · `AppModule.kt`

File: `app/src/main/java/com/antigravity/footballpredictions/di/AppModule.kt`

Replace `<YOUR_VERCEL_URL>` with the actual production URL (e.g. `https://football-predictions.vercel.app/`).

```kotlin
package com.maamoun.footballpredictions.di

import android.content.Context
import com.maamoun.footballpredictions.data.api.AuthInterceptor
import com.maamoun.footballpredictions.data.api.MobileApi
import com.maamoun.footballpredictions.data.local.EncryptedPrefs
import com.jakewharton.retrofit2.converter.kotlinx.serialization.asConverterFactory
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object AppModule {

    private const val BASE_URL = "<YOUR_VERCEL_URL>"

    @Provides @Singleton
    fun provideEncryptedPrefs(@ApplicationContext ctx: Context) = EncryptedPrefs(ctx)

    @Provides @Singleton
    fun provideOkHttpClient(authInterceptor: AuthInterceptor): OkHttpClient =
        OkHttpClient.Builder()
            .addInterceptor(authInterceptor)
            .addInterceptor(HttpLoggingInterceptor().apply {
                level = HttpLoggingInterceptor.Level.BODY
            })
            .build()

    @Provides @Singleton
    fun provideRetrofit(client: OkHttpClient): Retrofit {
        val json = Json { ignoreUnknownKeys = true; coerceInputValues = true }
        return Retrofit.Builder()
            .baseUrl(BASE_URL)
            .client(client)
            .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
            .build()
    }

    @Provides @Singleton
    fun provideMobileApi(retrofit: Retrofit): MobileApi =
        retrofit.create(MobileApi::class.java)
}
```

---

### A11 · `RepositoryModule.kt`

File: `app/src/main/java/com/antigravity/footballpredictions/di/RepositoryModule.kt`

```kotlin
package com.maamoun.footballpredictions.di

import com.maamoun.footballpredictions.data.repository.*
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
abstract class RepositoryModule {
    @Binds @Singleton abstract fun bindAuthRepo(impl: AuthRepositoryImpl): AuthRepository
    @Binds @Singleton abstract fun bindMatchRepo(impl: MatchRepositoryImpl): MatchRepository
    @Binds @Singleton abstract fun bindPredictionRepo(impl: PredictionRepositoryImpl): PredictionRepository
    @Binds @Singleton abstract fun bindLeaderboardRepo(impl: LeaderboardRepositoryImpl): LeaderboardRepository
}
```

---

### A12 · `EncryptedPrefs.kt`

File: `app/src/main/java/com/antigravity/footballpredictions/data/local/EncryptedPrefs.kt`

```kotlin
package com.maamoun.footballpredictions.data.local

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class EncryptedPrefs @Inject constructor(@ApplicationContext context: Context) {

    private val prefs = EncryptedSharedPreferences.create(
        context,
        "football_predictions_prefs",
        MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
    )

    fun getToken(): String? = prefs.getString(KEY_TOKEN, null)

    fun saveToken(token: String) = prefs.edit().putString(KEY_TOKEN, token).apply()

    fun clearToken() = prefs.edit().remove(KEY_TOKEN).apply()

    companion object {
        private const val KEY_TOKEN = "auth_token"
    }
}
```

---

### A13–A16 · Repositories

Place all repositories in `app/src/main/java/com/antigravity/footballpredictions/data/repository/`.

Each repository follows this pattern — an interface plus an `Impl` class injected with `MobileApi`. They wrap API calls in `Result<T>` so ViewModels can handle success and failure uniformly.

**`AuthRepository.kt`**
```kotlin
interface AuthRepository {
    suspend fun login(email: String, password: String): Result<LoginResponse>
    suspend fun registerDevice(fcmToken: String): Result<Unit>
    suspend fun unregisterDevice(fcmToken: String): Result<Unit>
    suspend fun getProfile(): Result<User>
}
```

**`MatchRepository.kt`**
```kotlin
interface MatchRepository {
    suspend fun getMatches(week: String? = null): Result<List<Match>>
}
```

**`PredictionRepository.kt`**
```kotlin
interface PredictionRepository {
    suspend fun getPredictions(): Result<List<Prediction>>
    suspend fun submitPrediction(matchId: String, homeScore: Int, awayScore: Int): Result<Unit>
}
```

**`LeaderboardRepository.kt`**
```kotlin
interface LeaderboardRepository {
    suspend fun getLeaderboard(groupId: Int? = null): Result<List<LeaderboardEntry>>
}
```

Each `Impl` class wraps calls in `runCatching { api.xxx() }.map { ... }`.

---

### A17 · Login screen

Files:
- `app/src/main/java/com/antigravity/footballpredictions/ui/auth/LoginViewModel.kt`
- `app/src/main/java/com/antigravity/footballpredictions/ui/auth/LoginScreen.kt`

**`LoginViewModel`** — `UiState`:
```kotlin
sealed class LoginUiState {
    object Idle : LoginUiState()
    object Loading : LoginUiState()
    data class Success(val user: User) : LoginUiState()
    data class Error(val message: String) : LoginUiState()
}
```

On successful login: call `authRepository.login()`, save token with `encryptedPrefs.saveToken()`, call `authRepository.registerDevice(fcmToken)`, emit `Success`.

**`LoginScreen`** — composable with:
- `OutlinedTextField` for email (keyboard type: email)
- `OutlinedTextField` for password (keyboard type: password, visual transformation)
- `Button("Sign In")` — triggers `viewModel.login(email, password)`
- Circular progress indicator while `Loading`
- Snackbar on `Error`

---

### A18 · Matches screen

Files:
- `app/src/main/java/com/antigravity/footballpredictions/ui/matches/MatchesViewModel.kt`
- `app/src/main/java/com/antigravity/footballpredictions/ui/matches/MatchesScreen.kt`
- `app/src/main/java/com/antigravity/footballpredictions/ui/matches/MatchCard.kt`

**`MatchesViewModel`** — loads matches on init, exposes `StateFlow<MatchesUiState>`. Provides `submitPrediction(matchId, home, away)` which calls `predictionRepository.submitPrediction()` then re-fetches matches.

**`MatchesScreen`** — `LazyColumn` of `MatchCard` items. Groups matches by league name with sticky headers. Pull-to-refresh via `SwipeRefresh` or `PullRefreshIndicator`.

**`MatchCard`** — displays:
- Home team logo (Coil `AsyncImage`) + name | score picker | Away team name + logo
- Kickoff time formatted as CLT (UTC+2): parse ISO string → add 2h → format as `"EEE dd MMM HH:mm"`
- If `kickoffTime <= now` OR `status != "scheduled"`: show a red "Locked" chip instead of the prediction form
- If user already has a prediction: pre-fill the score pickers and show a green "Submitted" badge
- Two `NumberPicker`-style `Row`s with `IconButton(+/-)` and a `Text` displaying the score (0–20 range)
- `Button("Submit")` — calls `viewModel.submitPrediction()`

**Lock check (client-side, mirrors server):**
```kotlin
fun isMatchLocked(kickoffTimeIso: String): Boolean {
    val kickoff = Instant.parse(kickoffTimeIso)
    return Instant.now() >= kickoff
}
```

---

### A19 · Predictions screen

Files:
- `app/src/main/java/com/antigravity/footballpredictions/ui/predictions/PredictionsViewModel.kt`
- `app/src/main/java/com/antigravity/footballpredictions/ui/predictions/PredictionsScreen.kt`

`LazyColumn` of prediction cards. Each card shows:
- Match name (Home vs Away)
- Result (if `resultHomeScore` not null): `"2 – 1"`
- User prediction: `"My pick: 2 – 1"`
- Points badge: green if `pointsAwarded > 0`, grey if 0
- Scoring chips: parse `scoringBreakdown` JSON if present

---

### A20 · Leaderboard screen

Files:
- `app/src/main/java/com/antigravity/footballpredictions/ui/leaderboard/LeaderboardViewModel.kt`
- `app/src/main/java/com/antigravity/footballpredictions/ui/leaderboard/LeaderboardScreen.kt`

`LazyColumn` of ranked rows. Row layout: rank number | name | total points (right-aligned). Top 3 rows use medal colours (gold/silver/bronze backgrounds). Pull-to-refresh.

---

### A21 · Profile screen

Files:
- `app/src/main/java/com/antigravity/footballpredictions/ui/profile/ProfileViewModel.kt`
- `app/src/main/java/com/antigravity/footballpredictions/ui/profile/ProfileScreen.kt`

Shows name and email (from JWT via `encryptedPrefs`, no API call needed). Single `Button("Sign Out")` — calls `viewModel.logout()`.

**`logout()` in ViewModel:**
1. Get current FCM token: `FirebaseMessaging.getInstance().token.await()`
2. Call `authRepository.unregisterDevice(fcmToken)` (best-effort, ignore failure)
3. `encryptedPrefs.clearToken()`
4. Navigate to Login

---

### A22 · `AppNavigation.kt`

File: `app/src/main/java/com/antigravity/footballpredictions/navigation/AppNavigation.kt`

```kotlin
// Top-level destinations
sealed class Screen(val route: String) {
    object Login : Screen("login")
    object Main  : Screen("main/{startTab}") {
        fun withTab(tab: String = "matches") = "main/$tab"
    }
}

// Bottom nav tabs
enum class Tab(val route: String, val label: String, val icon: ImageVector) {
    Matches("matches", "Matches", Icons.Default.SportsSoccer),
    Predictions("predictions", "Predictions", Icons.Default.List),
    Leaderboard("leaderboard", "Leaderboard", Icons.Default.EmojiEvents),
    Profile("profile", "Profile", Icons.Default.Person),
}
```

Startup logic: if `encryptedPrefs.getToken() != null` and token not expired → start at `Main`, else start at `Login`.

Handle the `"screen"` extra from FCM tap intents:
- `"predictions"` → open Main with Predictions tab selected
- anything else → open Main with Matches tab selected

---

### A23 · `MainActivity.kt`

File: `app/src/main/java/com/antigravity/footballpredictions/MainActivity.kt`

```kotlin
@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Request POST_NOTIFICATIONS permission on Android 13+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ActivityCompat.requestPermissions(
                this,
                arrayOf(Manifest.permission.POST_NOTIFICATIONS),
                0,
            )
        }

        // Determine start destination from FCM tap intent or stored token
        val startTab = intent.getStringExtra("screen") ?: "matches"

        setContent {
            FootballPredictionsTheme {
                AppNavigation(startTab = startTab)
            }
        }
    }
}
```

---

### A24 · `FcmService.kt`

File: `app/src/main/java/com/antigravity/footballpredictions/notification/FcmService.kt`

```kotlin
package com.maamoun.footballpredictions.notification

import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import androidx.core.app.NotificationCompat
import com.maamoun.footballpredictions.MainActivity
import com.maamoun.footballpredictions.R
import com.maamoun.footballpredictions.data.api.MobileApi
import com.maamoun.footballpredictions.data.local.EncryptedPrefs
import com.maamoun.footballpredictions.data.model.DeviceTokenRequest
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import javax.inject.Inject

@AndroidEntryPoint
class FcmService : FirebaseMessagingService() {

    @Inject lateinit var api: MobileApi
    @Inject lateinit var encryptedPrefs: EncryptedPrefs

    /**
     * Called when FCM rotates the device registration token.
     * Re-register immediately so push notifications keep working.
     */
    override fun onNewToken(token: String) {
        val jwt = encryptedPrefs.getToken() ?: return
        CoroutineScope(Dispatchers.IO).launch {
            runCatching { api.registerDevice(DeviceTokenRequest(token)) }
        }
    }

    /**
     * Called when a push notification arrives while the app is in the foreground,
     * or when a data-only message arrives in the background.
     */
    override fun onMessageReceived(message: RemoteMessage) {
        val type  = message.data["type"] ?: "matches"
        val title = message.notification?.title ?: "Football Predictions"
        val body  = message.notification?.body  ?: ""

        val targetScreen = if (type == "results") "predictions" else "matches"

        val intent = Intent(this, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
            putExtra("screen", targetScreen)
        }
        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE,
        )

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)   // add a 24dp vector drawable at this path
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()

        getSystemService(NotificationManager::class.java)
            .notify(System.currentTimeMillis().toInt(), notification)
    }

    companion object {
        const val CHANNEL_ID = "predictions"
    }
}
```

**Note:** create a 24dp vector drawable at `app/src/main/res/drawable/ic_notification.xml` (a simple football icon or generic notification bell). Android Studio has built-in vector assets: right-click `drawable` → New → Vector Asset.

---

### A25 · `theme/Theme.kt`

File: `app/src/main/java/com/antigravity/footballpredictions/ui/theme/Theme.kt`

Use Material 3 dynamic color (Android 12+) with green as the seed color to match the web app's colour scheme:

```kotlin
package com.maamoun.footballpredictions.ui.theme

import android.os.Build
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext

private val Green = Color(0xFF22C55E)   // matches Tailwind green-500 used in web app

@Composable
fun FootballPredictionsTheme(content: @Composable () -> Unit) {
    val colorScheme = when {
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            dynamicLightColorScheme(LocalContext.current)
        }
        else -> lightColorScheme(primary = Green)
    }
    MaterialTheme(colorScheme = colorScheme, content = content)
}
```

---

### A26 · Build verification

In Android Studio: **Build → Make Project** (or `./gradlew assembleDebug` in terminal).

Must complete with `BUILD SUCCESSFUL` and zero errors. Fix any missing imports or unresolved references before proceeding to Phase 3.

---

## Phase 3 — Distribution

### D1 · Create keystore

In Android Studio: **Build → Generate Signed App Bundle / APK** → APK → **Create new keystore**

| Field | Value |
|---|---|
| Key store path | `~/keystores/football-predictions.jks` (outside the project directory) |
| Password | choose a strong password |
| Key alias | `football-predictions` |
| Key password | same or different strong password |
| Validity | 25 years |
| First and last name | your name |

**Back up the keystore file and both passwords immediately** — losing them means you cannot update the app with the same signature, requiring users to uninstall and reinstall.

### D2 · Generate signed APK

Continue the wizard: select **release** build variant → **Finish**.

Output: `app/release/app-release.apk`

### D3 · End-to-end verification checklist

Before sharing with the group, verify on a physical device:

- [ ] Login with seeded credentials works
- [ ] Matches screen loads and shows current week's matches
- [ ] Prediction form submits and the badge updates
- [ ] Locked matches show "Locked" badge and no form
- [ ] Predictions screen shows prediction history
- [ ] Leaderboard loads with correct rankings
- [ ] Profile screen shows correct name/email
- [ ] Logout clears session and returns to Login
- [ ] Push notification arrives when a cron is manually triggered (`curl` the cron endpoint with `CRON_SECRET`)
- [ ] Tapping a "results" notification opens Predictions screen
- [ ] Tapping any other notification opens Matches screen
- [ ] FCM token rotation is handled (test by clearing app data and re-logging in)

### D4 · Share APK

Share `app/release/app-release.apk` via WhatsApp, Telegram, or Google Drive.

Recipients enable unknown sources on Android 8+:
> Settings → Apps → Special app access → Install unknown apps → (your file manager) → Allow

---

## Key Constraints Summary

These must be verified as passing for every file an agent creates or edits:

| Constraint | Where enforced |
|---|---|
| Web routes (`/api/matches`, etc.) not modified | No changes to any file outside `/api/mobile/` |
| `isMatchLocked()` called on every prediction POST | `src/app/api/mobile/predictions/route.ts` |
| `serializeMatch()` called on every match before response | `src/app/api/mobile/matches/route.ts` |
| Prisma integer `id` fields `.toString()`-ed before client | All `/api/mobile/` routes |
| Bearer JWT signed with `NEXTAUTH_SECRET` (no new secret) | `src/lib/mobile-auth.ts` |
| FCM push and email are independent (one failure ≠ blocks other) | B12–B15 |
| Stale FCM tokens cleaned on `UNREGISTERED` error | `src/lib/fcm.ts` |
| `FIREBASE_SERVICE_ACCOUNT_JSON` is base64 with no newlines | P0-C encoding step |
| FCM token re-registered in `onNewToken()` | `FcmService.kt` |
| Notification channel created before first notification | `FootballPredictionsApp.kt` |
