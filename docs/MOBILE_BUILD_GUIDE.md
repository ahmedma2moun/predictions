# Mobile Build Guide

## iOS → TestFlight

```bash
# 0. If icon or app.json changed, regenerate the native project first
cd mobile && npx expo prebuild --platform ios --clean

# 1. Install pods
cd mobile/ios && pod install

# 2. Open Xcode
open FootballPredictions.xcworkspace
```

In Xcode:
- Target → **Signing & Capabilities** → set Team + Bundle ID (`com.maamoun.footballpredictions`)
- Set destination to **Any iOS Device (arm64)**
- **Product → Archive**
- Organizer opens → **Distribute App → App Store Connect → Upload**

App appears in TestFlight in ~10–30 min.

---

## Android → Firebase Distribution

```bash
# 1. Generate android/ folder (first time, or after icon/app.json changes use --clean)
cd mobile && npx expo prebuild --platform android --clean

# 2. Build debug APK
cd mobile/android && ./gradlew assembleDebug

# 3. Upload to Firebase
firebase appdistribution:distribute \
  app/build/outputs/apk/debug/app-debug.apk \
  --app 1:324923947200:android:9453983ba1902076c5d525\
  --groups "testers"
```

Get `YOUR_ANDROID_APP_ID` from Firebase Console → Project Settings → Your Apps.

