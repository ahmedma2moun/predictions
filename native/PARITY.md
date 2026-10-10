# Native parity matrix

One row per screen and per cross-cutting behaviour. Both apps must stay equivalent in behaviour and appearance
(rule: `CLAUDE.md` → *Native Parity Rule*). This file doubles as the Phase 5 QA checklist.

Legend: ✅ implemented · 🟡 implemented, needs device QA · ⏸ deferred · ➖ not applicable

**Status as of the migration branch:** everything below is implemented and builds + unit-tests on both platforms; UI was
smoke-checked against `contract/mock-server.mjs` on an iPhone 17 simulator and a Pixel 8 emulator. Nothing has been
verified on a physical device or against the real API yet — that is the remaining Phase 4/5 work.

## Screens

| # | Screen | iOS (`native/ios/FootballPredictions/…`) | Android (`native/android/…/footballpredictions/…`) | iOS | Android |
|---|---|---|---|---|---|
| 1 | Login | `Features/Login` | `features/login` | ✅ | ✅ |
| 2 | Matches (tab) | `Features/Matches` | `features/matches` | 🟡 | 🟡 |
| 3 | Match detail | `Features/MatchDetail` | `features/matchdetail` | 🟡 | 🟡 |
| 4 | My Score (tab) | `Features/MyScore` | `features/myscore` | 🟡 | 🟡 |
| 5 | Leaders (tab) | `Features/Leaderboard` | `features/leaderboard` | 🟡 | 🟡 |
| 6 | Club (tab) | `Features/Club` | `features/club` | 🟡 | 🟡 |
| 7 | Slip | `Features/Slip` | `features/slip` | 🟡 | 🟡 |
| 8 | Reminders (tab) | `Features/Reminders` | `features/reminders` | 🟡 | 🟡 |
| 9 | Seasons (tab) | `Features/Seasons` | `features/seasons` | 🟡 | 🟡 |
| 10 | Champion (hidden route) | `Features/Champion` | `features/champion` | 🟡 | 🟡 |
| 11 | Root / auth gate | `App/RootView` | `app/RootScreen` | ✅ | ✅ |
| 12 | Tab shell | `App/MainTabView` | `app/RootScreen` (NavigationBar) | ✅ | ✅ |
| – | Odds explainer modal / odds popovers | – | – | ⏸ | ⏸ |

The odds UI (`OddsExplainerModal`, `OddsFactors`) is **deferred**: `ODDS_FEATURE_ENABLED = false`. The per-match
"Prediction Odds" card on Match detail *is* ported (it renders only when the API returns odds).

## Cross-cutting behaviour

| Behaviour | iOS | Android |
|---|---|---|
| Request cancellation on screen exit / input change (`.task(id:)` / `LaunchedEffect`) | ✅ | ✅ |
| Live polling every 60 s, only while visible **and** foregrounded; stops on 400/401/403/404; keeps last score on transient error; stops when status leaves live/scheduled | ✅ | ✅ |
| Match detail live loop (60 s while `live`, ends on error) | ✅ | ✅ |
| Countdown label refresh every 30 s, cleared at kickoff | ✅ | ✅ |
| Matches refetch on focus | ✅ | ✅ |
| Prediction locking is server-authoritative; server error message surfaced | ✅ | ✅ |
| String ids on the wire (numeric only for Club/Slip/Reminders — see `contract/README.md`) | ✅ | ✅ |
| Error surface: server `error` string → fallback `Request failed (<status>)` | ✅ | ✅ |
| Sign-out order: unregister push token → clear secure storage → Login | ✅ | ✅ |
| Match prev/next stepping replaces the detail screen | ✅ | ✅ |
| Theme light/dark/system, persisted as `fp_theme_mode`, default dark | ✅ | ✅ |
| Secure token storage (`fp_token`, `fp_user`) | ✅ Keychain | ✅ Keystore AES-GCM |
| Push: FCM token register/unregister (`POST/DELETE /api/mobile/devices`) | ✅ | ✅ |
| Push: foreground presentation | ✅ banner+sound | ✅ posted locally on `default` channel |
| Push: tap routing (foreground / background / cold start) per `NotificationRouter` | 🟡 | 🟡 |
| Notification routing table identical (unit-tested on both) | ✅ | ✅ |
| Contract fixtures decode (unit-tested on both, same file list) | ✅ | ✅ |
| Design tokens generated from `design-tokens/tokens.json` | ✅ | ✅ |

## Platform polish (deliberate, per-OS differences)

Anything not listed here must match exactly.

| Area | iOS | Android |
|---|---|---|
| Tab bar | Native `TabView` (Liquid Glass on iOS 26). iOS shows at most 5 tabs, so **Reminders and Seasons live under "More"** — this is the platform's own pattern | Material 3 `NavigationBar` with all 6 destinations |
| Icons | SF Symbols | Material Symbols (same semantic mapping: `design-tokens/icons.json`) |
| Match detail / Slip / Champion chrome | Native navigation bar + interactive swipe-back | Material `TopAppBar` + predictive-back-ready activity |
| Haptics | `sensoryFeedback` on score stepper, period switch, save success | `HapticFeedback` on the same interactions |
| Score changes | `contentTransition(.numericText)` | `AnimatedContent` |
| Pull-to-refresh, switches, alerts, share, scoring popover | System `.refreshable`, `Toggle`, `.alert`, `ShareLink`, `.popover` | `PullToRefreshBox`, `Switch`, `AlertDialog`, `ACTION_SEND` chooser, dialog |
| Keyboard | `scrollDismissesKeyboard`, numeric pad "Done" toolbar on Slip | `imePadding()` |
| Typography scaling | Dynamic Type (capped at accessibility-2) | `sp` + system font scale |
| Splash | `UILaunchScreen` (colour + image) | `core-splashscreen` API |
| Launcher icon | Flat 1024 icon | Adaptive icon + themed (monochrome) layer |
| Sign-out | Confirmation dialog on avatar tap (**both** platforms — RN signed out instantly) | same |
| Signing | Manual (Apple Distribution) | Release keystore from CI secrets |

## Known deviations from the RN app (both platforms)

- Avatar tap asks for confirmation before signing out.
- Leaders keeps the filters visible and dims the list while reloading instead of replacing the whole screen with a spinner.
- Debug builds only: launch arguments / intent extras (`-fp-mock-session`, `fp_mock_session`, …) for running against `contract/mock-server.mjs`.
