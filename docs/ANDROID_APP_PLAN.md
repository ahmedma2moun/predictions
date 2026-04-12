# Android App — Implementation Plan

Native Android client for the Football Predictions app. The Android app talks exclusively to a dedicated `/api/mobile/` wrapper added to the existing Next.js project, authenticates via Bearer JWT (not cookies), and receives push notifications via Firebase Cloud Messaging (FCM) mirroring every email notification already sent.

---

## System Overview

```
[Android App]  ──Bearer JWT──►  [/api/mobile/* (new route group)]
                                       │
                                       ├── shared: prisma, scoring-engine, utils
                                       ├── new:    mobile-auth.ts, fcm.ts
                                       └── DB: DeviceToken (new table)

[Vercel Crons — unchanged schedule]
   fetch-matches       ──► email + FCM push (new)
   fetch-results       ──► email + FCM push (new)
   prediction-reminder ──► email + FCM push (new)
   daily-reminder      ──► email + FCM push (new)

[Firebase Cloud Messaging] ──► [Android device]
```

The web app (Next.js) and its routes are **not modified**. All mobile-specific logic lives under `/api/mobile/`.

---

## Part 1 — Firebase Setup

### 1.1 Create the Firebase Project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project** → name it `football-predictions`
3. Disable Google Analytics (not needed) → **Create project**

### 1.2 Add the Android App to the Project

1. In the Firebase project overview, click the **Android icon** (Add app)
2. Fill in:
   - **Android package name:** `com.antigravity.footballpredictions`
   - **App nickname:** Football Predictions (optional)
   - **Debug signing certificate SHA-1:** leave blank for now (add later for Play Store)
3. Click **Register app**
4. Download `google-services.json`
5. Place it in `android/app/google-services.json` (the `app/` module folder, not the project root)
6. Skip the remaining wizard steps — the SDK will be added manually

### 1.3 Get the Server-Side Service Account Key (for Vercel)

The backend needs this to send push notifications via Firebase Admin SDK.

1. In the Firebase console → **Project Settings** (gear icon, top-left)
2. Go to the **Service accounts** tab
3. Click **Generate new private key** → confirm → a JSON file downloads
4. **Do not commit this file.** It is a secret credential.
5. Base64-encode it for storage as an env var:

   On Mac/Linux:
   ```bash
   base64 -i firebase-service-account.json | tr -d '\n'
   ```

   On Windows (PowerShell):
   ```powershell
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("firebase-service-account.json")) 
   ```

6. Copy the output string
7. In **Vercel → Project → Settings → Environment Variables**, add:
   - **Name:** `FIREBASE_SERVICE_ACCOUNT_JSON`
   - **Value:** the base64 string from step 6
   - **Environments:** Production, Preview, Development
8. Delete the local `firebase-service-account.json` file after copying the value — it must not sit on disk unprotected

### 1.4 Verify FCM is Enabled

1. Firebase console → **Build → Cloud Messaging**
2. Confirm the tab loads without an "Enable" prompt — FCM is enabled by default for all new projects
3. Note the **Server key** shown here (legacy) — you will **not** use this. The service account JSON is the correct credential for Firebase Admin SDK v12+

---

## Part 2 — Backend Changes (Next.js Project)

### 2.1 Install Dependencies

```bash
npm install firebase-admin jose
```

- `firebase-admin` — Firebase Admin SDK (sends push notifications server-side)
- `jose` — JWT sign/verify (used for mobile Bearer tokens, same secret as NextAuth)

### 2.2 Prisma Schema: Add DeviceToken

**File:** `prisma/schema.prisma`

Add the relation to `User`:
```prisma
model User {
  // ... existing fields unchanged ...
  deviceTokens DeviceToken[]
}
```

Add the new model:
```prisma
model DeviceToken {
  id        Int      @id @default(autoincrement())
  userId    Int
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  token     String   @unique   // FCM registration token (rotates periodically)
  platform  String   @default("android")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId])
}
```

Run the migration:
```bash
npx prisma migrate dev --name add_device_tokens
```

### 2.3 New Library: `src/lib/fcm.ts`

Initialises Firebase Admin SDK once (singleton) and exposes a single function used by all notification paths.

```ts
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { prisma } from './prisma';

function initFirebase() {
  if (getApps().length > 0) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not set');
  const serviceAccount = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
  initializeApp({ credential: cert(serviceAccount) });
}

/**
 * Sends a push notification to all registered devices for the given user IDs.
 * Silently removes stale tokens returned as UNREGISTERED by FCM.
 */
export async function sendPushToUsers(
  userIds: number[],
  notification: { title: string; body: string; data?: Record<string, string> }
): Promise<void> {
  initFirebase();
  if (userIds.length === 0) return;

  const tokens = await prisma.deviceToken.findMany({
    where: { userId: { in: userIds } },
    select: { id: true, token: true },
  });
  if (tokens.length === 0) return;

  const response = await getMessaging().sendEachForMulticast({
    tokens: tokens.map(t => t.token),
    notification: { title: notification.title, body: notification.body },
    data: notification.data ?? {},
    android: {
      priority: 'high',
      notification: { channelId: 'predictions' },
    },
  });

  // Remove tokens FCM reports as no longer valid
  const staleTokenIds: number[] = [];
  response.responses.forEach((r, i) => {
    if (!r.success && r.error?.code === 'messaging/registration-token-not-registered') {
      staleTokenIds.push(tokens[i].id);
    }
  });
  if (staleTokenIds.length > 0) {
    await prisma.deviceToken.deleteMany({ where: { id: { in: staleTokenIds } } });
  }
}
```

### 2.4 New Library: `src/lib/mobile-auth.ts`

Signs and verifies mobile JWTs using the existing `NEXTAUTH_SECRET`. No new secrets.

```ts
import { SignJWT, jwtVerify } from 'jose';
import { NextRequest } from 'next/server';

const secret = () => new TextEncoder().encode(process.env.NEXTAUTH_SECRET!);
const EXPIRY = '30d';

export interface MobileSession {
  id: string;
  email: string;
  name: string;
  role: string;
}

export async function signMobileJwt(user: MobileSession): Promise<string> {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(await secret());
}

export async function verifyMobileJwt(token: string): Promise<MobileSession | null> {
  try {
    const { payload } = await jwtVerify(token, await secret());
    return payload as unknown as MobileSession;
  } catch {
    return null;
  }
}

export async function getMobileSession(req: NextRequest): Promise<MobileSession | null> {
  const header = req.headers.get('authorization') ?? '';
  if (!header.startsWith('Bearer ')) return null;
  return verifyMobileJwt(header.slice(7));
}
```

### 2.5 New API Routes: `/api/mobile/`

#### `POST /api/mobile/auth/login`
Validates credentials and returns a signed JWT.

Request body:
```json
{ "email": "user@example.com", "password": "secret" }
```

Response:
```json
{
  "token": "<jwt>",
  "user": { "id": "1", "name": "Ahmed", "email": "user@example.com", "role": "user" }
}
```

#### `POST /api/mobile/devices`
Registers a FCM token for the authenticated user. Called right after login and whenever FCM rotates the token.

Request body:
```json
{ "fcmToken": "<firebase-registration-token>" }
```

#### `DELETE /api/mobile/devices`
Unregisters the FCM token. Called on logout.

Request body:
```json
{ "fcmToken": "<firebase-registration-token>" }
```

#### `GET /api/mobile/matches`
Returns the current week's matches with the user's prediction attached. Accepts the same query params as the web route (`week`, `leagueId`, `status`).

#### `POST /api/mobile/predictions`
Submits or updates a prediction. Same validation as the web route — checks `isMatchLocked` server-side.

Request body:
```json
{ "matchId": "42", "homeScore": 2, "awayScore": 1 }
```

#### `GET /api/mobile/predictions`
Returns the user's prediction history (most recent first, max 100).

#### `GET /api/mobile/leaderboard`
Returns the group leaderboard. Accepts optional `groupId` query param.

#### `GET /api/mobile/profile`
Returns the authenticated user's name, email, and role.

### 2.6 Push Notifications Wired into Notification Paths

Four files gain an additional `sendPushToUsers` call alongside the existing email. The pattern in each:

```ts
// After collecting userIds that need this notification:
try {
  await sendPushToUsers(userIds, {
    title: '...',
    body:  '...',
    data:  { type: 'results' },   // controls which screen the app opens
  });
} catch (e) {
  console.error('[cron/...] FCM push failed:', e);
}
```

| File | `data.type` | Title | Body |
|---|---|---|---|
| `src/lib/matches-processor.ts` | `new_matches` | New matches this week | N matches added — place your predictions! |
| `src/lib/results-processor.ts` | `results` | Results are in! | You earned X pts — tap to see your breakdown |
| `src/app/api/cron/prediction-reminder/route.ts` | `prediction_reminder` | Don't forget to predict! | You still have N matches without a prediction |
| `src/app/api/cron/daily-reminder/route.ts` | `daily_reminder` | Matches today! | N match(es) kick off today — predict before the whistle! |

Email and push are independent — if one fails it does not affect the other.

---

## Part 3 — Android App

**Project location:** `d:/Antigravity/Matches Prediction/football-predictions-android/`  
**Language:** Kotlin 2.0  
**UI:** Jetpack Compose + Material Design 3  
**Min SDK:** 26 (Android 8.0 — covers ~95% of active devices)

### 3.1 Tech Stack

| Concern | Library |
|---|---|
| UI | Jetpack Compose + Material 3 |
| Navigation | Navigation Compose (type-safe) |
| Dependency Injection | Hilt |
| Networking | Retrofit 2 + OkHttp + `kotlinx.serialization` |
| Auth token storage | `EncryptedSharedPreferences` (Android Keystore) |
| Image loading | Coil 3 (team logos) |
| Push notifications | Firebase Cloud Messaging |
| Concurrency | Kotlin Coroutines + StateFlow |
| Architecture | MVVM + Repository + `UiState` sealed class |

### 3.2 Project Structure

```
app/src/main/java/com/antigravity/footballpredictions/
├── MainActivity.kt
├── di/
│   ├── AppModule.kt              (Retrofit, OkHttp, EncryptedSharedPreferences)
│   └── RepositoryModule.kt
├── data/
│   ├── api/
│   │   ├── MobileApi.kt          (all Retrofit interface declarations)
│   │   └── AuthInterceptor.kt    (attaches "Authorization: Bearer <token>" to every request)
│   ├── model/
│   │   ├── Match.kt
│   │   ├── Prediction.kt
│   │   ├── LeaderboardEntry.kt
│   │   └── User.kt
│   └── repository/
│       ├── AuthRepository.kt
│       ├── MatchRepository.kt
│       ├── PredictionRepository.kt
│       └── LeaderboardRepository.kt
├── ui/
│   ├── theme/Theme.kt
│   ├── auth/
│   │   ├── LoginScreen.kt
│   │   └── LoginViewModel.kt
│   ├── matches/
│   │   ├── MatchesScreen.kt      (current week, grouped by league)
│   │   ├── MatchCard.kt          (match card + inline prediction form)
│   │   └── MatchesViewModel.kt
│   ├── predictions/
│   │   ├── PredictionsScreen.kt
│   │   └── PredictionsViewModel.kt
│   ├── leaderboard/
│   │   ├── LeaderboardScreen.kt
│   │   └── LeaderboardViewModel.kt
│   └── profile/
│       ├── ProfileScreen.kt
│       └── ProfileViewModel.kt
├── navigation/
│   └── AppNavigation.kt          (login gate + bottom nav with 4 tabs)
└── notification/
    └── FcmService.kt             (FirebaseMessagingService subclass)
```

### 3.3 Screens

**Login**
- Email + password fields
- On success: store JWT in `EncryptedSharedPreferences`, register FCM token, navigate to main tabs

**Matches (bottom nav tab 1)**
- Current week's matches grouped by league
- Each match card: team names + logos (Coil), kickoff time in CLT, status badge
- Inline prediction form: two number pickers (home score | away score) + submit button
- If `kickoffTime <= now`: form is hidden, "Locked" badge shown instead
- Pull-to-refresh

**Predictions (bottom nav tab 2)**
- User's prediction history, most recent first
- Each row: match, result, user prediction, points badge
- Points breakdown chips (e.g. "Correct winner +2", "Exact score +5")

**Leaderboard (bottom nav tab 3)**
- Ranked list: position, name, total points
- Pull-to-refresh

**Profile (bottom nav tab 4)**
- User name and email
- Logout: unregisters FCM token, clears JWT, navigates to Login

### 3.4 Auth Flow

```
App launch
  ↓
Read JWT from EncryptedSharedPreferences
  ├── null       → LoginScreen
  └── found      → decode JWT locally, check expiry
        ├── expired  → LoginScreen
        └── valid    → MainScreen (tabs)

Login
  POST /api/mobile/auth/login  { email, password }
  ← { token, user }
  store token → EncryptedSharedPreferences
  POST /api/mobile/devices { fcmToken }
  navigate → MainScreen

Logout
  DELETE /api/mobile/devices { fcmToken }
  clear EncryptedSharedPreferences
  navigate → LoginScreen
```

### 3.5 FCM Token Lifecycle (`FcmService.kt`)

```kotlin
class FcmService : FirebaseMessagingService() {

    // Called when FCM rotates the device token (happens automatically, periodically)
    override fun onNewToken(token: String) {
        // Re-register if user is logged in — prevents push silently breaking after token rotation
        val jwt = EncryptedPrefs.getToken(this) ?: return
        CoroutineScope(Dispatchers.IO).launch {
            apiClient.registerDevice(fcmToken = token)
        }
    }

    // Called when a push notification arrives
    override fun onMessageReceived(message: RemoteMessage) {
        val type = message.data["type"] ?: return
        val (title, body) = message.notification?.title to message.notification?.body

        // Build a notification with a tap intent that deep-links to the correct screen
        val intent = when (type) {
            "results", -> Intent(this, MainActivity::class.java)
                .putExtra("screen", "predictions")
            else       -> Intent(this, MainActivity::class.java)
                .putExtra("screen", "matches")
        }

        NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setContentIntent(PendingIntent.getActivity(...))
            .build()
            .let { NotificationManagerCompat.from(this).notify(notifId, it) }
    }

    companion object {
        const val CHANNEL_ID = "predictions"
    }
}
```

The notification channel `"predictions"` must be created at app startup (Android 8+ requirement):

```kotlin
// In MainActivity.onCreate or Application.onCreate
val channel = NotificationChannel(
    FcmService.CHANNEL_ID,
    "Match Predictions",
    NotificationManager.IMPORTANCE_DEFAULT
).apply { description = "Reminders and match results" }
getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
```

### 3.6 Gradle Dependencies

**Project-level `build.gradle.kts`:**
```kotlin
plugins {
    id("com.google.gms.google-services") version "4.4.2" apply false
    id("com.google.dagger.hilt.android") version "2.51" apply false
}
```

**App-level `app/build.gradle.kts`:**
```kotlin
plugins {
    id("com.google.gms.google-services")
    id("com.google.dagger.hilt.android")
    kotlin("plugin.serialization")
}

dependencies {
    // Compose BOM
    implementation(platform("androidx.compose:compose-bom:2024.09.00"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.activity:activity-compose:1.9.2")

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

    // Security
    implementation("androidx.security:security-crypto:1.1.0-alpha06")

    // Firebase
    implementation(platform("com.google.firebase:firebase-bom:33.4.0"))
    implementation("com.google.firebase:firebase-messaging")

    // Coroutines
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.5")
}
```

---

## Part 4 — Distribution

For a private friend group, direct APK sharing is the simplest path — no Play Store account needed.

### Generating a Signed APK

1. In Android Studio: **Build → Generate Signed App Bundle / APK**
2. Choose **APK**
3. Create a new keystore (first time):
   - Store it somewhere safe outside the project directory (e.g. `~/keystores/football-predictions.jks`)
   - **Back up the keystore file and remember the passwords** — losing it means you cannot update the app with the same signature
4. Fill in key alias, passwords, validity (25+ years)
5. Select **release** build variant → **Finish**
6. The APK is output to `app/release/app-release.apk`

### Distributing the APK

1. Share `app-release.apk` via WhatsApp, Telegram, or Google Drive
2. Recipients must enable **Install from unknown sources**:
   - Android 8+: Settings → Apps → Special app access → Install unknown apps → (browser or Files app) → Allow
3. Tap the APK to install

### Future: Play Store (optional)

- Requires a Google Play Developer account ($25 one-time)
- Change build output from APK to AAB: **Build → Generate Signed App Bundle / APK → Android App Bundle**
- Upload via Google Play Console → Internal testing track first, then production

---

## Implementation Order

| # | Task | Location |
|---|---|---|
| 1 | Create Firebase project, add Android app, download `google-services.json` | Firebase console |
| 2 | Generate service account key, base64-encode, add `FIREBASE_SERVICE_ACCOUNT_JSON` to Vercel | Firebase console + Vercel |
| 3 | Add `DeviceToken` model to Prisma schema, run migration | `prisma/schema.prisma` |
| 4 | Install `firebase-admin` + `jose`, write `src/lib/fcm.ts` | Next.js project |
| 5 | Write `src/lib/mobile-auth.ts` | Next.js project |
| 6 | Implement all `/api/mobile/` routes | Next.js project |
| 7 | Wire `sendPushToUsers` into 4 notification paths alongside existing emails | Next.js project |
| 8 | Deploy to Vercel, smoke-test with `curl` | Vercel |
| 9 | Create Android Studio project, add Gradle dependencies, place `google-services.json` | Android project |
| 10 | Implement `AppModule.kt` (Hilt), `AuthInterceptor.kt`, `MobileApi.kt` | Android project |
| 11 | Implement Login screen + `EncryptedSharedPreferences` token storage | Android project |
| 12 | Implement Matches screen (main feature) | Android project |
| 13 | Implement Predictions + Leaderboard screens | Android project |
| 14 | Implement Profile + Logout | Android project |
| 15 | Implement `FcmService.kt` + notification channel | Android project |
| 16 | Generate signed APK, distribute to group | Android Studio |

---

## Key Constraints to Carry Forward

- All existing web routes (`/api/matches`, `/api/predictions`, etc.) are **not modified** — the web app continues to work exactly as before
- Mobile auth uses Bearer JWTs signed with `NEXTAUTH_SECRET` (30-day expiry) — no new secrets
- `isMatchLocked` is enforced server-side in every `POST /api/mobile/predictions` call — the Android UI also disables the form client-side, but the server is the source of truth
- FCM tokens rotate automatically — `FcmService.onNewToken` re-registers immediately to avoid silent push failures
- Stale FCM tokens (returned as `UNREGISTERED` by FCM) are cleaned up automatically by `sendPushToUsers`
- The `FIREBASE_SERVICE_ACCOUNT_JSON` env var is base64-encoded JSON — do not add newlines when encoding
