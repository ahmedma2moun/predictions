# iOS Deployment Guide — EAS + Firebase App Distribution

This guide walks through deploying the Football Predictions iOS app to testers via Expo Application Services (EAS) and Firebase App Distribution, mirroring the existing Android pipeline.

---

## Prerequisites

| Requirement | Detail |
|---|---|
| Apple Developer account | Paid membership required for real-device distribution |
| Expo account | [expo.dev](https://expo.dev) — same account used for Android builds |
| Firebase project | Already exists (`1:324923947200`) — just need an iOS app added |
| EAS CLI | `npm install -g eas-cli` |

---

## Step 1 — Add an iOS App in Firebase

1. Open [Firebase Console](https://console.firebase.google.com) → your project → **Add app** → iOS.
2. Enter bundle ID: `com.maamoun.footballpredictions`
3. Download **GoogleService-Info.plist** and save it to `football-predictions/mobile/GoogleService-Info.plist`.
4. Copy the **iOS App ID** (format: `1:324923947200:ios:XXXXXXXXXXXXXXXX`) — you'll need it later.

---

## Step 2 — Add GoogleService-Info.plist to app.json

Open `football-predictions/mobile/app.json` and add `googleServicesFile` under the `ios` key:

```json
"ios": {
  "bundleIdentifier": "com.maamoun.footballpredictions",
  "supportsTablet": true,
  "googleServicesFile": "./GoogleService-Info.plist"
}
```

> **Note:** Add `GoogleService-Info.plist` to `.gitignore` if the Firebase project is sensitive. For CI, upload it as a GitHub secret and write it to disk in the workflow before building.

---

## Step 3 — Add a preview-ios Profile to eas.json

Open `football-predictions/mobile/eas.json` and add a new build profile:

```json
"preview-ios": {
  "distribution": "internal",
  "ios": {
    "simulator": false
  }
}
```

`distribution: internal` tells EAS to sign the app for ad-hoc / enterprise distribution (not the App Store), which is required for Firebase App Distribution.

---

## Step 4 — Set Up Apple Credentials in EAS

EAS manages your provisioning profile and signing certificate automatically. Run this once locally:

```bash
cd football-predictions/mobile
eas credentials --platform ios
```

Follow the prompts to:
- Log in with your Apple Developer account
- Let EAS create or import a **Distribution Certificate**
- Let EAS create an **Ad Hoc Provisioning Profile** (for internal distribution)

EAS stores these credentials securely on its servers. CI only needs `EXPO_TOKEN` — no Apple credentials in GitHub Secrets.

---

## Step 5 — Add GitHub Secrets

Go to **GitHub → Repository → Settings → Secrets and variables → Actions** and add:

| Secret name | Value |
|---|---|
| `EXPO_TOKEN` | Already exists (used by Android workflow) |
| `FIREBASE_SERVICE_ACCOUNT` | Already exists (used by Android workflow) |
| `FIREBASE_IOS_APP_ID` | The iOS App ID copied in Step 1 |

---

## Step 6 — Create the GitHub Actions Workflow

Create the file `football-predictions/.github/workflows/ios-publish.yml`:

```yaml
name: iOS Auto-Publish

on:
  push:
    branches: [master]
    paths:
      - 'football-predictions/mobile/**'

jobs:
  build-and-distribute:
    name: EAS Build → Firebase Distribution
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: football-predictions/mobile/package-lock.json

      - name: Install mobile dependencies
        working-directory: football-predictions/mobile
        run: npm ci

      - name: Install EAS CLI
        run: npm install -g eas-cli

      - name: Build IPA via EAS
        working-directory: football-predictions/mobile
        env:
          EXPO_TOKEN: ${{ secrets.EXPO_TOKEN }}
        run: |
          eas build \
            --profile preview-ios \
            --platform ios \
            --non-interactive \
            --json \
            --output build-output.json
          IPA_URL=$(jq -r '.[0].artifacts.buildUrl' build-output.json)
          echo "IPA_URL=$IPA_URL" >> $GITHUB_ENV

      - name: Download IPA
        run: curl -L "$IPA_URL" -o app-preview.ipa

      - name: Distribute via Firebase App Distribution
        uses: wzieba/Firebase-Distribution-Github-Action@v1
        with:
          appId: ${{ secrets.FIREBASE_IOS_APP_ID }}
          serviceCredentialsFileContent: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
          groups: testers
          file: app-preview.ipa
          releaseNotes: "Auto-build from commit ${{ github.sha }} — ${{ github.event.head_commit.message }}"
```

---

## Step 7 — Register Tester Devices (Ad Hoc Only)

For `distribution: internal` (ad hoc), each tester's device UDID must be registered in your Apple Developer account:

1. Collect testers' UDIDs (Settings → General → About → scroll to find it, or via [udid.io](https://get.udid.io)).
2. Add each UDID in **Apple Developer → Certificates, Identifiers & Profiles → Devices**.
3. Re-run `eas credentials --platform ios` locally to regenerate the provisioning profile to include the new devices, then push — CI will pick up the updated credentials automatically.

> **Alternative:** Use `distribution: "store"` with an enterprise account to skip per-device registration.

---

## How the Full Pipeline Works

```
Push to master
     │
     ▼
GitHub Actions triggered
     │
     ├── npm ci
     ├── eas build --platform ios --profile preview-ios
     │        └── EAS servers compile on a macOS worker
     │            Signs IPA with stored Apple credentials
     │            Uploads artifact to EAS CDN
     ├── curl downloads the IPA
     └── Firebase Distribution uploads IPA to testers
              └── Testers receive an email / push notification
                  with a link to install the build
```

---

## Differences from the Android Pipeline

| | Android | iOS |
|---|---|---|
| Build profile | `preview` | `preview-ios` |
| Artifact | `.apk` | `.ipa` |
| Signing managed by | EAS (keystore) | EAS (Apple certificate + provisioning profile) |
| Device registration | Not required | Required per device (ad hoc) |
| Firebase App ID secret | `FIREBASE_APP_ID` (hardcoded) | `FIREBASE_IOS_APP_ID` |
| Extra setup | None | Apple Developer account + UDID registration |

---

## Troubleshooting

**`No credentials found` during EAS build**
Run `eas credentials --platform ios` locally and let EAS generate them. Push again.

**`Invalid IPA` in Firebase Distribution**
The provisioning profile doesn't include the tester's device UDID. Register the device and regenerate the profile (Step 7).

**Build succeeds but testers can't install**
Check that the tester's device UDID is in the provisioning profile. On iOS 16+, testers also need to enable Developer Mode on their device.

**`FIREBASE_IOS_APP_ID` format error**
The App ID must be in the format `1:PROJECT_NUMBER:ios:HASH`, not the bundle identifier.
