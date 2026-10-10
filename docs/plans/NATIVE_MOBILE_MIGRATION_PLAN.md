# Native Mobile Migration Plan — React Native → SwiftUI + Jetpack Compose

**Status:** Implemented on branch `feat/native-mobile-migration` (Phases 0–3 + the Phase 4 code); device QA, cutover (Phase 6) and the Android signing decision still open — see §11
**Written:** 2026-10-10
**Scope:** Replace the Expo / React Native app in `mobile/` with two native apps — iOS (SwiftUI) and Android (Kotlin + Jetpack Compose) — with the same screens, behaviour and look as today.

---

## 1. Goals and non-goals

### Goals
- Two native apps that are **functionally and visually equivalent** to the current app.
- **No backend changes.** Both apps consume the existing `/api/mobile/*` endpoints unchanged.
- **In-place update** for testers: same iOS bundle ID and Android package (`com.maamoun.footballpredictions`).
- Faster CI: the iOS job drops from ~22 min to an expected ~4–7 min (no `npm install`, `expo prebuild`, CocoaPods or React Native C++ compile).
- A **parity system** (rule + shared sources + CI guard) so the two codebases do not drift.

### Non-goals
- No new features during the migration (widgets, Live Activities, etc. come after cutover).
- No redesign. Platform-idiomatic controls are allowed only where listed in §6.3.
- No shared-code framework (Kotlin Multiplatform, etc.). The app is small enough that two plain codebases plus a parity system is simpler.
- No OpenAPI/codegen pipeline. Contract fixtures (§5.2) cover the same risk with far less machinery.

---

## 2. What exists today (inventory to port)

About 7,200 lines of TypeScript: 12 screens, 18 components, 8 hooks, 22 endpoint usages.

### 2.1 Screens

| # | Screen | RN file | Endpoints | Notable behaviour |
|---|---|---|---|---|
| 1 | Login | `app/login.tsx` | `POST auth/login` | Keyboard avoidance, validation alerts |
| 2 | Matches (tab) | `app/(tabs)/matches.tsx` | `GET matches`, `GET matches/{id}/live` | Sections grouped by day, pull-to-refresh, refetch on focus, kickoff countdown refreshed every 30 s, live score poll every 60 s |
| 3 | Match detail | `app/matches/[matchId].tsx` | `GET matches/{id}`, `…/form`, `…/live`, `…/group-predictions`, `POST predictions` | Score entry, lock state, live events, team form, prev/next match stepping (replace, not push) |
| 4 | My Score (tab) | `app/(tabs)/predictions.tsx` | `GET predictions`, `GET predictions/stats` | Period filter, accuracy card, sparkline of last 10 scored predictions |
| 5 | Leaders (tab) | `app/(tabs)/leaderboard.tsx` | `GET leaderboard`, `…/live`, `…/user-predictions`, `GET groups`, `GET leagues` | Group/league/period filters, expandable rows, group comparison |
| 6 | Club (tab) | `app/(tabs)/club.tsx` | `GET game`, `POST game` | Group + season pickers, 5 sub-sections (week / feed / rival / rewards / recap), share sheet |
| 7 | Slip | `app/slip.tsx` | `GET predictions/slip`, `POST predictions/slip` | Bulk prediction entry |
| 8 | Reminders (tab) | `app/(tabs)/reminders.tsx` | `GET reminders`, `PUT reminders` | Per-team switches, "at least two teams per league" validation |
| 9 | Seasons (tab) | `app/(tabs)/seasons.tsx` | `GET seasons`, `GET seasons/{id}`, `GET leaderboard?period=all` | Podium, ended-season cards |
| 10 | Champion (hidden tab) | `app/(tabs)/champion.tsx` | `GET champion-bonus`, `POST champion-bonus/pick` | Confirm modal, locked "reveal" state. Not in the tab bar but routable |
| 11 | Root / splash gate | `app/_layout.tsx`, `app/index.tsx` | — | Auth gate, font loading, error boundary, notification-tap routing |
| 12 | Tab shell | `app/(tabs)/_layout.tsx` | — | 6 visible tabs, translucent blurred tab bar |

Tab order: **Matches · My Score · Leaders · Club · Reminders · Seasons**.

Backend routes that exist but the app never calls (`/api/mobile/admin/*`, `/api/mobile/profile`, `/api/mobile/matches/{id}/predictions`) are **out of scope**.

### 2.2 Cross-cutting pieces

| Concern | Today | Source |
|---|---|---|
| HTTP client | `fetch` wrapper, Bearer token, `{ error }` body → `ApiError(message, status)` | `src/api/client.ts` |
| Base URL | Prod `https://predictions-virid.vercel.app`; dev `10.0.2.2:3000` (Android) / `localhost:3000` (iOS) | `app.json → extra` |
| Auth | JWT + user JSON in secure storage (`fp_token`, `fp_user`); sign-out unregisters the push token first | `src/auth/AuthContext.tsx` |
| Push | FCM token on both platforms, `POST/DELETE /api/mobile/devices` with `{ fcmToken, platform }`; Android channel `default` (HIGH importance, colour `#10b981`) | `src/notifications/push.ts` |
| Notification routing | `data.type` (+ `data.matchId`) → screen | `src/notifications/route-for-notification.ts` |
| Theme | Dark/light "Scoreboard" palettes, preference `light / dark / system` persisted (`fp_theme_mode`), default dark | `src/theme/colors.ts`, `theme.tsx` |
| Typography | System sans + bundled JetBrains Mono (400, 700) | `app/_layout.tsx` |
| Data loading | Generic loader: loading / refreshing / error / cancel-on-unmount / `enabled` gate | `src/hooks/useRemoteData.ts` |
| Types | 355 lines of response types; game types imported from the web's `src/lib/game/types.ts` | `src/types/api.ts`, `src/types/game.ts` |
| Feature flag | `ODDS_FEATURE_ENABLED = false` gates the odds explainer modal | `src/constants/featureFlags.ts` |
| Versioning | `semantic-release` writes `app.json` version; iOS build number = highest uploaded + 1; Android `versionCode` is always 1 | `mobile/package.json`, `.github/scripts/ios-build-number.py` |

### 2.3 Notification routing (behaviour to preserve — taken from the code, not its stale doc comment)

| `data.type` | Opens |
|---|---|
| `results`, `result_correction` | My Score |
| `season_end` | Club |
| `goal`, `match_started`, `match_reminder` | Match detail for `matchId` (Matches if missing) |
| `new_matches`, `prediction_reminder`, `daily_reminder` | Slip |
| anything else | Matches |

---

## 3. Target architecture

### 3.1 Repository layout

```
native/
  PARITY.md                 # feature × platform status matrix (§5.4)
  VERSION                   # single marketing version, read by both builds
  design-tokens/
    tokens.json             # colours, spacing, radius, font sizes — single source of truth
    generate.mjs            # emits Tokens.swift and Tokens.kt
  contract/
    fixtures/*.json         # real responses per endpoint (secrets/PII scrubbed)
    README.md               # how to re-capture
  ios/                      # SwiftUI app (XcodeGen project.yml, like Home Expenses)
  android/                  # Compose app (Gradle Kotlin DSL)
mobile/                     # existing RN app — untouched until cutover, then deleted
```

`mobile/` stays buildable and shippable for the whole migration, so there is always a working fallback.

### 3.2 Technology choices

| | iOS | Android |
|---|---|---|
| Language / UI | Swift 6, SwiftUI | Kotlin 2.x, Jetpack Compose (Material 3) |
| Minimum OS | iOS 17 | API 24 (same as today) |
| Project | XcodeGen `project.yml` (generated `.xcodeproj` not committed) | Gradle Kotlin DSL + version catalog |
| State | `@Observable` view models | `ViewModel` + `StateFlow` |
| Navigation | `TabView` + `NavigationStack` | Navigation Compose + bottom bar |
| Networking | `URLSession` async/await + `Codable` | Retrofit/OkHttp + kotlinx.serialization |
| Secure storage | Keychain | Keystore-encrypted DataStore |
| Preferences | `UserDefaults` | DataStore |
| Images (crests) | `AsyncImage` | Coil |
| Push | FirebaseMessaging (SPM — the only third-party dependency) | Firebase Messaging |
| DI | Plain initialiser injection | Plain constructor injection (no Hilt) |
| Tests | Swift Testing / XCTest | JUnit + kotlinx-serialization fixture tests |

Firebase stays on iOS so the backend keeps sending through FCM for both platforms with no change. Moving iOS to direct APNs would need backend work and is deliberately excluded.

### 3.3 Mirrored structure (the main anti-drift device)

Both apps use **the same folder names, type names and function names**, so a change in one maps mechanically onto the other:

```
App/            root, auth gate, tab shell, notification routing
Core/
  Networking/   ApiClient, ApiError, AppConfig, DTOs/
  Auth/         AuthStore (token + user, signIn, signOut)
  Push/         PushRegistrar, NotificationRouter
  DesignSystem/ Tokens (generated), Theme, shared components
  Util/         formatting, leaderboard dates
Features/
  Login/  Matches/  MatchDetail/  MyScore/  Leaderboard/
  Club/   Slip/     Reminders/    Seasons/  Champion/
```

Each feature folder holds `XScreen`, `XViewModel`, and its private components. DTO names match `mobile/src/types/api.ts` (`MatchListItem`, `MatchDetail`, `LeaderboardEntry`, …).

### 3.4 Behaviours that must be reproduced exactly

- **Request cancellation** when a screen disappears or its inputs change (`AbortController` → Swift `Task` cancellation / coroutine scope).
- **Live polling:** every 60 s, only while the screen is visible **and** the app is foregrounded; stop on 400/401/403/404; keep the last known score on transient errors; stop when status leaves `live`/`scheduled`.
- **Countdown labels:** refresh every 30 s, clear at kickoff.
- **Refetch on focus** for Matches.
- **Prediction locking:** the server is authoritative (`isMatchLocked`); the client only reflects the lock state it is given and surfaces the server's error message.
- **IDs are strings** on the wire. Never decode them as integers.
- **Dates** arrive as UTC ISO strings; display follows the same rules as `src/utils/format.ts`.
- **Error surface:** show the server's `error` string, falling back to `Request failed (<status>)`.
- **Sign-out order:** unregister push token → clear secure storage → return to Login.
- **Match stepping** replaces the current detail screen so Back still returns to the list.

---

## 4. Phases

Estimates assume one developer working with AI assistance. They are rough and should be re-checked after Phase 2.

### Phase 0 — Foundations (2–3 days)
1. Create `native/` with `PARITY.md`, `VERSION`, `design-tokens/`, `contract/`.
2. Move palettes, spacing, radius and font sizes from `mobile/src/theme/colors.ts` into `tokens.json`; write `generate.mjs`.
3. Capture one JSON fixture per endpoint in §2.1 from the real API (test account; scrub tokens and emails).
4. Scaffold both projects (empty app that launches, shows the themed tab shell, bundles JetBrains Mono and the existing icon/splash assets).
5. Add the CI workflows from §7 in **manual-trigger-only** mode.
6. Add the parity rule to `CLAUDE.md` and the parity skill (§5).
7. Decide the Android signing question (§8.1) and create the secrets.

**Exit:** both empty apps build in CI and install on a device.

### Phase 1 — Core layer, both platforms (3–4 days)
`ApiClient`, `ApiError`, `AppConfig`, all DTOs, `AuthStore`, secure storage, theme + preference, the generic loader (the `useRemoteData` equivalent), shared components from `src/components/ui.tsx` and `AppHeader`.

**Exit:** every fixture decodes in unit tests on both platforms; Login works end to end.

### Phase 2 — Vertical slice: Matches → Match detail → predict (4–5 days)
The highest-risk path, done first on both platforms: list, sections, countdown, live polling, detail, team form, events, score entry, save, prev/next stepping.

**Exit:** a prediction can be made from both native apps; side-by-side screenshots against the RN app are signed off. **Re-estimate the remaining phases here.**

### Phase 3 — Remaining screens (8–10 days)
In this order, each one finished on **both** platforms before starting the next:

1. My Score (period filter, accuracy card, sparkline, scoring breakdown)
2. Leaders (filters, expandable rows, group comparison, live standing)
3. Slip
4. Club (5 sub-sections, share sheet)
5. Seasons (podium, ended seasons)
6. Reminders
7. Champion (hidden route)

### Phase 4 — Push and deep routing (2–3 days)
Permission prompt, FCM token registration/unregistration, Android `default` channel, foreground presentation, and tap routing per §2.3 for all three app states (foreground, background, cold start).

**Exit:** every `data.type` in §2.3 is verified on a real device on both platforms.

### Phase 5 — Parity QA (2–3 days)
- Walk `PARITY.md` row by row on both platforms, dark and light.
- Side-by-side comparison with the RN build on the same account and data.
- Edge cases: offline, expired token (401), locked match, empty states, no group, no active season, small and large screens, Android 3-button navigation, Dynamic Type / font scale.

### Phase 6 — Cutover (1 day)
1. Switch the native workflows to auto-trigger on `native/**`; remove the RN workflows.
2. Ship the native builds to TestFlight and Firebase App Distribution.
3. Keep `mobile/` for one release cycle as rollback, then delete it together with `eas.json`, the Expo plugin, `mobile/scripts`, and the RN-only docs.
4. Update the docs in §9.

**Total: roughly 4–6 weeks of focused work.**

---

## 5. Keeping the two codebases the same

Four layers, from cheapest to strictest.

### 5.1 Rule in `CLAUDE.md` (replaces the current mobile row of the Cross-Layer rule)

> ## Native Parity Rule
>
> The mobile app is two native codebases: `native/ios/` (SwiftUI) and `native/android/` (Jetpack Compose). They must stay equivalent in behaviour and appearance.
>
> - Any feature, fix, or UI change made in one native app **must be made in the other in the same PR**.
> - Use the **same folder, type and function names** on both platforms (`Features/Matches/MatchesViewModel` exists in both).
> - Never hard-code a colour, spacing, radius or font size. Change `native/design-tokens/tokens.json` and run the generator.
> - When an `/api/mobile/*` response changes: update the fixture in `native/contract/fixtures/`, then the DTO on **both** platforms, then the web frontend.
> - Update `native/PARITY.md` in the same PR whenever a screen or behaviour is added, changed or removed.
> - A platform-only change is allowed only for genuinely platform-specific code (signing, permissions, OS APIs). State it in the PR body as `Parity: ios-only — <reason>` or `Parity: android-only — <reason>`.
> - When a task names only one platform, flag it and confirm before leaving the other unchanged.

The existing Cross-Layer table becomes four rows: Web · API · iOS (`native/ios/`) · Android (`native/android/`).

### 5.2 Contract fixtures (API parity)
Both test suites decode the **same** files in `native/contract/fixtures/`. A DTO that is wrong on one platform fails that platform's tests; a changed API response forces a fixture update that both platforms must then satisfy. This replaces `mobile/src/types/api.ts` as the shared definition of the wire format once `mobile/` is deleted.

### 5.3 Design tokens (visual parity)
`tokens.json` → `Tokens.swift` + `Tokens.kt`. CI re-runs the generator and fails if the committed output differs, so neither platform can diverge on colour, spacing, radius or type scale.

### 5.4 Parity matrix + CI guard (feature parity)
- `native/PARITY.md` — one row per screen and per cross-cutting behaviour (§2.1, §3.4), with an iOS and an Android status column. It doubles as the QA checklist.
- **CI check `native-parity`** on pull requests: if the diff touches `native/ios/**` but not `native/android/**` (or the reverse), the check fails unless the PR body contains a `Parity: ios-only` / `Parity: android-only` line.

### 5.5 Project skill
Add `.claude/skills/native-parity/` alongside the existing `db`, `deploy`, `review`, `test` skills. It walks a change through: fixture → DTOs on both platforms → view models → screens → `PARITY.md` → tests, and ends by diffing the two feature folders' file lists to catch a missed counterpart.

---

## 6. UI equivalence

### 6.1 Method
1. Tokens come from one file (§5.3).
2. The shared components in `src/components/ui.tsx` (Button variants, Card, Heading, Muted, …) are ported first, with the same names and the same props, so screens are assembled from equivalent parts.
3. Each screen is accepted only after a side-by-side screenshot comparison with the RN app (dark and light) on the same data.

### 6.2 Component mapping

| RN | SwiftUI | Compose |
|---|---|---|
| `FlatList` / `SectionList` | `List` / `LazyVStack` with sections | `LazyColumn` with sticky headers |
| `RefreshControl` | `.refreshable` | `PullToRefreshBox` |
| `Modal` | `.sheet` / custom overlay | `Dialog` |
| `Alert.alert` | `.alert` | `AlertDialog` |
| `Switch` | `Toggle` | `Switch` |
| `Share.share` | `ShareLink` | `Intent.ACTION_SEND` |
| `KeyboardAvoidingView` | automatic | `imePadding()` |
| `expo-image` | `AsyncImage` | Coil `AsyncImage` |
| Safe-area insets | automatic / `safeAreaInset` | `WindowInsets` |
| `BlurView` tab bar | `.ultraThinMaterial` | translucent surface (real blur only on API 31+) |
| Ionicons | SF Symbols | Material Symbols |

### 6.3 Accepted differences (agreed up front so they are not reported as bugs)
- **Icons:** closest SF Symbol / Material Symbol instead of Ionicons. One mapping table is kept in `native/design-tokens/` so both platforms pick the same meaning.
- **Tab bar blur on Android below API 31:** solid translucent colour.
- **Alerts, share sheet, switches, pull-to-refresh indicator:** system look per platform.
- **Screen transitions:** platform default.

Everything else — layout, spacing, colours, typography, copy, ordering, empty and error states — must match.

---

## 7. CI changes

### 7.1 iOS — `.github/workflows/ios-publish.yml` (rewritten)

| Step | Today | After |
|---|---|---|
| Node setup + `npm install` | 52 s | removed |
| `expo prebuild` | 6 s | replaced by `xcodegen generate` (seconds) |
| Podfile patch + `pod install` | 126 s | removed (SPM, cached) |
| Signing setup | 9 s | **unchanged** — reuse `.github/scripts/ios-signing.py` |
| Build number | 2 s | **unchanged** — reuse `.github/scripts/ios-build-number.py` |
| Archive | 1022 s | expected 2–4 min (Swift + FirebaseMessaging only) |
| Export + upload | 118 s | unchanged |

Other changes:
- Trigger paths: `native/ios/**`, `native/design-tokens/**`, `native/VERSION`, the workflow file and `.github/scripts/ios-*.py`.
- Archive from `native/ios/FootballPredictions.xcodeproj` (no workspace). Manual-signing settings move into `project.yml`, so the Ruby `xcodeproj` patch step is removed.
- Cache SPM (`~/Library/Developer/Xcode/DerivedData/**/SourcePackages`) keyed on `Package.resolved`.
- `GoogleService-Info.plist` is already committed; copy it into the target.

Expected total: **about 4–7 minutes** (Home Expenses, with no Firebase, runs in 2–4).

### 7.2 Android — `.github/workflows/android-publish.yml` (rewritten)
- Remove Node, `expo prebuild`, `local.properties` and the JS bundle step.
- `actions/setup-java@v4` (17) + `gradle/actions/setup-gradle@v4` (dependency and build cache).
- Build a **signed release** APK (R8 enabled) instead of a debug APK; keystore from secrets.
- `versionCode` = GitHub run number + offset (today it is always `1`); `versionName` from `native/VERSION`.
- Distribution to Firebase App Distribution is unchanged (same app ID, same `testers` group).
- Trigger paths: `native/android/**`, `native/design-tokens/**`, `native/VERSION`, the workflow file.

Expected total: **about 3–5 minutes**.

### 7.3 New — `.github/workflows/native-checks.yml` (pull requests)
| Job | Runner | Runs when |
|---|---|---|
| `native-parity` (§5.4) | ubuntu | any `native/**` change |
| `tokens-drift` (§5.3) | ubuntu | `native/design-tokens/**` or generated files change |
| `android-test` (unit + fixture tests, lint) | ubuntu | `native/android/**`, `native/contract/**` |
| `ios-test` (unit + fixture tests) | macos-26 | `native/ios/**`, `native/contract/**` |

`ios-test` is path-filtered because macOS runner minutes are the expensive ones.

### 7.4 During the migration
- The existing RN workflows keep triggering on `mobile/**` and keep shipping.
- The new native workflows are `workflow_dispatch` only until Phase 6, so no half-finished native build reaches testers by accident. (Both upload to the same TestFlight app and Firebase app, because the bundle ID / package are shared.)

### 7.5 Versioning
`semantic-release` currently lives in `mobile/package.json` and writes `app.json`. Replace `scripts/update-app-version.js` with a step that writes `native/VERSION`; both builds read it. `CHANGELOG.md` moves to `native/`.

### 7.6 Secrets

| Secret | Status |
|---|---|
| `ASC_API_KEY_ID`, `ASC_API_KEY_ISSUER_ID`, `ASC_API_KEY_CONTENT`, `APPLE_TEAM_ID`, `IOS_CERTIFICATE_P12_BASE64`, `IOS_CERTIFICATE_PASSWORD`, `GH_PAT` | keep |
| `FIREBASE_SERVICE_ACCOUNT` | keep |
| `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` | **new** |

---

## 8. Risks and decisions

### 8.1 Android signing key — decision needed
Current builds are debug APKs signed with the React Native template's `debug.keystore`. Android only installs an update over an existing app if the signing key matches.

- **Option A (recommended):** create a proper release keystore. Testers uninstall the old app once and install the new one. Clean, and required anyway for Play Store later.
- **Option B:** keep signing with the same debug keystore so the update installs in place. No reinstall, but the app stays on a publicly known debug key.

### 8.2 One-time re-login
The native apps will not read the token that `expo-secure-store` saved, so every user signs in once after the update, and the FCM token re-registers at that point. Migrating the stored token is possible but not worth the effort for a small tester group.

### 8.3 Odds UI — decision needed
`ODDS_FEATURE_ENABLED` is `false`, so `OddsExplainerModal` and `OddsFactors` (~380 lines) are invisible today. **Recommendation:** do not port them now; record them as "deferred" in `PARITY.md` and build them natively if the flag is ever turned on.

### 8.4 Other risks

| Risk | Mitigation |
|---|---|
| The two apps drift after cutover | §5 — rule, fixtures, tokens, parity matrix, CI guard |
| DTO mistakes (optional fields, string IDs, nullable scores) | Fixture decoding tests on both platforms before any UI is built |
| Feature work continues on RN during the migration | Freeze `mobile/` to bug fixes; any change made there is added to `PARITY.md` as a to-do |
| Push taps behave differently in cold-start vs background | Phase 4 tests all three app states for every `data.type` |
| Game/Club types are imported from the web source today | Covered by the `game` fixture; the web's `src/lib/game/types.ts` stays the reference |
| Estimate is too optimistic | Re-estimate after the Phase 2 vertical slice, before committing to Phase 3 |
| Double the mobile work forever | Accepted cost of going native; the parity skill and mirrored structure keep each change mechanical |

---

## 9. Documentation to update at cutover

| Document | Change |
|---|---|
| `CLAUDE.md` | Cross-Layer table → four layers; add the Native Parity Rule (§5.1); update the mobile path |
| `docs/architecture/SYSTEM_ARCHITECTURE.md` | Mobile section, component tree, new ADR "Native apps replace React Native" |
| `docs/architecture/INDEX.md` | Key Decisions table |
| `docs/architecture/DEPLOYMENT_GUIDE.md` | New workflows, secrets, versioning |
| `docs/architecture/SECURITY_ARCHITECTURE.md` | Token storage (Keychain / Keystore), Android signing key |
| `docs/architecture/API_SPECIFICATIONS.md` | Point to `native/contract/fixtures/` as the mobile contract examples |
| `docs/REACT_NATIVE_GUIDE.md`, `docs/MOBILE_BUILD_GUIDE.md` | Delete; replace with `docs/NATIVE_MOBILE_GUIDE.md` |
| `docs/IOS_PUBLISH_ACTION_GUIDE.md` | Rewrite for the new workflow |

---

## 10. Definition of done

- Every row in `native/PARITY.md` is ✅ on both platforms (or explicitly "deferred" per §8.3).
- All fixtures decode in both test suites; `native-checks` is green.
- Every notification type in §2.3 opens the right screen on both platforms from foreground, background and cold start.
- Side-by-side screenshot review against the RN app is signed off in dark and light.
- Native builds are live on TestFlight and Firebase App Distribution; iOS CI is under 8 minutes.
- `mobile/` and the Expo workflows are deleted; the docs in §9 are updated.

---

## 11. Implementation notes (branch `feat/native-mobile-migration`)

**Done:** `native/` layout; token generator + icon map; 29 contract fixtures (derived from the RN types and route
handlers — re-capture from a test account when convenient); both apps with all screens in §2.1 except the deferred odds UI;
secure storage, theme, push registration/routing, live polling, countdowns; unit/fixture tests on both platforms (37 iOS,
38 Android); `native-checks.yml`, `native-ios-publish.yml`, `native-android-publish.yml`; `CLAUDE.md` parity rule,
`/native-parity` command, `native/PARITY.md`, docs in §9.

**Decisions taken (defaults from §8):** Android signing = **Option A** (new release keystore — testers reinstall once);
odds UI **deferred**.

**Deviations from the plan:**
- Swift language mode 5 (toolchain Swift 6) — Firebase delegate APIs make strict Swift 6 concurrency noisy; revisit.
- Android uses OkHttp + kotlinx.serialization directly (no Retrofit) and SharedPreferences (not DataStore) behind a
  Keystore AES-GCM wrapper — fewer dependencies for the same behaviour.
- Android navigation is one Navigation-Compose graph (tab bar shown on tab routes + Champion); iOS has one `NavigationStack` per tab.
- iOS 6 tabs collapse into the system "More" tab (platform behaviour); Android shows all 6.
- "OS polish" (requested in addition to the plan) is listed in `native/PARITY.md` → *Platform polish*.
- Native publish workflows are `workflow_dispatch`-only (§7.4); the `push` triggers are commented in the files for cutover.
- Version bump automation (`semantic-release` → `native/VERSION`, §7.5) is **not** done yet; `VERSION` is edited by hand.

**Not verified:** physical devices; real API responses; push taps from all three app states; release (R8) JSON decoding
on a device; the iOS archive/TestFlight path and the Android signed-release/Firebase path in CI (workflows are written, never run);
iOS Release signing config.

**Before first CI publish:** create the Android keystore and the four `ANDROID_*` secrets (§7.6); confirm the existing
iOS App ID/profile already carries Push Notifications (the native build adds the `aps-environment` entitlement).
