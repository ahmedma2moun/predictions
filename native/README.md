# Native apps (SwiftUI + Jetpack Compose)

Replaces the Expo / React Native app in `../mobile/` (kept until cutover). See
`docs/plans/NATIVE_MOBILE_MIGRATION_PLAN.md` for the plan and `docs/NATIVE_MOBILE_GUIDE.md` for day-to-day use.

```
PARITY.md        feature × platform matrix + deliberate platform differences
VERSION          marketing version read by both builds
design-tokens/   tokens.json + icons.json → generate.mjs → Tokens/Icons (.swift, .kt)
contract/        fixtures/*.json (shared wire-format tests) + mock-server.mjs
ios/             SwiftUI app, XcodeGen (project.yml), Firebase Messaging via SPM
android/         Compose app, Gradle Kotlin DSL + version catalog
```

## Run locally

```sh
node native/contract/mock-server.mjs 3055           # fixture-backed API (no backend/credentials needed)

# iOS (Xcode 26+, XcodeGen)
native/ios/generate.sh && open native/ios/FootballPredictions.xcodeproj
#   simulator launch args: -fp-mock-session -fp-api http://localhost:3055 -fp-open matches:match=101 -fp-theme light

# Android (JDK 17, Android SDK)
cd native/android && ./gradlew installDebug
adb reverse tcp:3055 tcp:3055
adb shell am start -n com.maamoun.footballpredictions/.app.MainActivity \
  --ez fp_mock_session true --es fp_api http://localhost:3055 --es fp_open matches:match=101
```

Debug builds otherwise talk to `localhost:3000` (iOS) / `10.0.2.2:3000` (Android), like the RN dev build.

## Tests

```sh
cd native/android && ./gradlew testDebugUnitTest
native/ios/generate.sh && xcodebuild test -project native/ios/FootballPredictions.xcodeproj \
  -scheme FootballPredictions -destination 'platform=iOS Simulator,name=iPhone 17' CODE_SIGNING_ALLOWED=NO
node native/design-tokens/generate.mjs --check
```

## Changing the design tokens

Edit `design-tokens/tokens.json` (or `icons.json`), run `node native/design-tokens/generate.mjs`, commit the four
generated files. CI fails if they drift.
