# Football Predictions — Mobile (Expo / React Native)

Cross-platform mobile client for the Football Predictions app. Targets Android (APK via EAS Build) and iOS.

- **Backend:** consumes the existing `/api/mobile/*` endpoints on the Next.js deployment
- **Auth:** JWT (stored in `expo-secure-store`)
- **Push:** FCM via `expo-notifications` + Firebase `google-services.json`

## Phase status
See [`../../migration_state.md`](../../migration_state.md). Currently: **Phase 1 complete** (Auth, Matches, Notifications). Phase 2 (My Predictions) and Phase 3 (Leaderboard) are stubs.

## Prerequisites
- Node 20+
- An Expo account (`npx expo login`)
- An EAS project linked (`npx eas init`) — replace `extra.eas.projectId` in `app.json`
- `google-services.json` present at the repo root (already copied)
- API base URL configured in `app.json → expo.extra.apiBaseUrl` (production deployment URL)

## Install & run (dev)
```bash
cd football-predictions/mobile
npm install
npx expo start
```

For Android emulator dev, the client talks to `http://10.0.2.2:3000` (override in `app.json → expo.extra.apiBaseUrlDev`).

> **Note:** Expo Go cannot receive real FCM pushes. For push testing use a dev client build (`npx eas build --profile development --platform android`) or the preview APK.

## Build an APK (Phase 1 deliverable)

Cloud build (recommended):
```bash
cd football-predictions/mobile
npx eas login
npx eas init                                    # only once, to create the EAS project
npx eas build --platform android --profile preview
```

Local build (requires Android SDK, JDK 17, and ~8 GB disk):
```bash
cd football-predictions/mobile
npx eas build --platform android --profile preview --local
```

The preview profile produces a signed APK you can side-load onto a device.
