# Native mobile guide

Day-to-day guide for the SwiftUI + Jetpack Compose apps in `native/`. Plan and rationale:
`docs/plans/NATIVE_MOBILE_MIGRATION_PLAN.md`; architecture: `docs/architecture/SYSTEM_ARCHITECTURE.md` (ADR-18);
CI/secrets: `docs/architecture/DEPLOYMENT_GUIDE.md`.

## Layout and naming

Both apps mirror each other (iOS `Core/Networking/ApiClient.swift` ↔ Android `core/networking/ApiClient.kt`):
`App/`, `Core/{Networking,Auth,Push,DesignSystem,Util}`, `Features/{Login,Matches,MatchDetail,MyScore,Leaderboard,Club,Slip,Reminders,Seasons,Champion}`.
Each feature has a `…Screen`, a `…ViewModel` and private components. DTO names equal `mobile/src/types/api.ts`.

## Running

See `native/README.md` (mock server, launch arguments, tests). Debug builds use `localhost:3000` / `10.0.2.2:3000`.

## Making a change

Use `/native-parity` (`.claude/commands/native-parity.md`): fixture → DTOs (both) → tokens → view models → screens →
router/tests → `native/PARITY.md`. CI fails PRs that touch only one platform unless the body has
`Parity: ios-only — <reason>` / `Parity: android-only — <reason>`.

## Releasing

Manual dispatch of *iOS (native) — Archive → TestFlight* and *Android (native) — Release APK → Firebase* until cutover.
Bump `native/VERSION` by hand. iOS build numbers are auto-incremented from App Store Connect; Android `versionCode` is run number + 1000.

## Cutover checklist (plan §4 Phase 6)

1. Complete device QA against `native/PARITY.md` (all 🟡 → ✅), including push taps from foreground/background/cold start.
2. Verify the iOS profile includes Push Notifications.
3. Replace `ios-publish.yml` / `android-publish.yml` with the native workflows and enable their `push` triggers.
4. Ship; keep `mobile/` one release cycle, then delete it with `eas.json`, `mobile/scripts`, `docs/REACT_NATIVE_GUIDE.md`, `docs/MOBILE_BUILD_GUIDE.md`; rewrite `docs/IOS_PUBLISH_ACTION_GUIDE.md`.
5. Replace `semantic-release` in `mobile/` with a step that writes `native/VERSION` (plan §7.5).
