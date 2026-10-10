---
description: "Walk a change through both native apps (iOS + Android) so they stay equivalent"
---
# Native parity

The mobile app is two codebases: `native/ios/` (SwiftUI) and `native/android/` (Compose). A change to one must be made
in the other in the same PR. Follow this order:

1. **Contract** — if an `/api/mobile/*` response changed, update the fixture in `native/contract/fixtures/` first
   (and add it to the `covered` list in both `FixtureDecodingTests.swift` and `FixtureDecodingTest.kt`).
2. **DTOs** — update `Core/Networking/DTOs/*.swift` **and** `core/networking/dto/*.kt` (same type names).
3. **Tokens** — never hard-code colours/spacing/radius/font sizes. Edit `native/design-tokens/tokens.json`, run
   `node native/design-tokens/generate.mjs`.
4. **View models** — `Features/<X>/<X>ViewModel.swift` and `features/<x>/<X>ViewModel.kt` (same names/functions).
5. **Screens/components** — `Features/<X>/…Screen.swift` and `features/<x>/…Screen.kt`.
6. **Notification routing** — `NotificationRouter` on both + both router tests.
7. **PARITY.md** — update the matrix (and the "Platform polish" table if a difference is intentional).
8. **Tests** — extend the unit tests on both platforms; run them (see `native/README.md`).
9. **Web + docs** — update the web frontend if the API changed, then the docs required by CLAUDE.md.
10. **Diff check** — list both feature folders and compare file names:
    `diff <(ls native/ios/FootballPredictions/Features/X) <(ls native/android/app/src/main/java/com/maamoun/footballpredictions/features/x)`.

Platform-only changes (signing, permissions, OS APIs) need `Parity: ios-only — <reason>` or
`Parity: android-only — <reason>` in the PR body, otherwise the `native-parity` check fails.
