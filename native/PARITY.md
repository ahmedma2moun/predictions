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
| 13 | Home-screen widget "Next match" | `FootballPredictionsWidget` (+ `Core/Widget`, `Shared/WidgetSnapshot`) | `widget/NextMatchWidget` (+ `widget/WidgetSnapshot`) | 🟡 | 🟡 |
| – | Odds explainer modal / odds popovers | – | – | ⏸ | ⏸ |

The odds UI (`OddsExplainerModal`, `OddsFactors`) is **deferred**: `ODDS_FEATURE_ENABLED = false`. The per-match
"Prediction Odds" card on Match detail *is* ported (it renders only when the API returns odds).

## Cross-cutting behaviour

| Behaviour | iOS | Android |
|---|---|---|
| Request cancellation on screen exit / input change (`.task(id:)` / `LaunchedEffect`) | ✅ | ✅ |
| Live polling every 60 s, only while visible **and** foregrounded; stops on 400/401/403/404; keeps last score on transient error; stops when status leaves live/scheduled | ✅ | ✅ |
| Match card shows provisional `+N pts` under the live score (`livePoints` from the live poll; hidden without a prediction or score) | 🟡 | 🟡 |
| Venue (pin icon + name) under the kickoff time on the match card footer and the match detail header; hidden when the match has no venue | 🟡 | 🟡 |
| Match detail live loop (60 s while `live`, ends on error) | ✅ | ✅ |
| Countdown label refresh every 30 s, cleared at kickoff | ✅ | ✅ |
| Matches refetch on focus | ✅ | ✅ |
| Prediction locking is server-authoritative; server error message surfaced | ✅ | ✅ |
| String ids on the wire (numeric only for Club/Slip/Reminders — see `contract/README.md`) | ✅ | ✅ |
| Error surface: server `error` string → fallback `Request failed (<status>)` | ✅ | ✅ |
| Sign-out order: unregister push token → clear secure storage → Login | ✅ | ✅ |
| Match prev/next stepping replaces the detail screen | ✅ | ✅ |
| Saving a prediction stays on Match detail and shows a 2 s "Saved" toast (no alert, no auto-advance); button flips to "Update Prediction" | ✅ | ✅ |
| Theme light/dark/system, persisted as `fp_theme_mode`, default dark | ✅ | ✅ |
| Secure token storage (`fp_token`, `fp_user`) | ✅ Keychain | ✅ Keystore AES-GCM |
| Matches tab badge: count of upcoming (scheduled, unlocked) matches with no prediction; hidden at 0; computed from the matches list already fetched (no extra request); cleared on sign-out; refreshes whenever Matches refetches | 🟡 `.badge(_:)` | 🟡 `BadgedBox` + `Badge`, `99+` cap |
| Skeleton loading on first load of Matches, Leaders, My Score, Club, Seasons (card/row shaped placeholders with a moving highlight; static under Reduce Motion; announced as "Loading"). Match detail and Champion keep the spinner | 🟡 `LoadingSkeleton` / `SkeletonBox` | 🟡 `LoadingSkeleton` / `SkeletonBox` |
| Goal haptic: a live poll (card or match detail) whose total goals exceed the previously known score; the first poll without a baseline never fires (`isGoal`) | 🟡 `.sensoryFeedback(.impact(weight: .heavy))` | 🟡 `AppHaptics.goal` (`LONG_PRESS`) |
| Deadline haptic: an unpredicted match crosses into the last 5 minutes while its countdown is on screen (checked on the 30 s tick; opening inside the window does not fire) (`isInDeadlineWindow`) | 🟡 `.sensoryFeedback(.warning)` | 🟡 `AppHaptics.deadlineWarning` (`REJECT` on API 30+, `LONG_PRESS` below) |
| Widget data: the app writes a `WidgetSnapshot` (next open match + prediction, missing-picks count, all-time rank) whenever Matches / the unfiltered all-time Leaderboard load; widgets never call the API. Cleared on sign-out. Tap → match detail (or Matches / Slip / Leaders for the empty state, missing-picks link, rank link) via the same destination routing as push taps | 🟡 App Group `UserDefaults` + `WidgetCenter.reloadAllTimelines` + `footballpredictions://` URLs | 🟡 `SharedPreferences` + Glance `updateAll` + intent extras (`type=match_reminder/new_matches/leaderboard`) |
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
| Widget countdown / lock | `Text(kickoff, style: .relative)` ticks live; timeline entry at kickoff flips to "Locked" | Absolute kickoff time + "Locks at kickoff" (a widget redraws about every 30 min, so a countdown would go stale); flips to "Locked" on the next redraw |
| Widget sizes | `systemSmall`, `systemMedium` (rank + missing picks column) | Responsive: 2×2 shows the match, wide (≥250dp) adds the rank column |
| Typography scaling | Dynamic Type (capped at accessibility-2) | `sp` + system font scale |
| Splash | `UILaunchScreen` (colour + image) | `core-splashscreen` API |
| Launcher icon | Flat 1024 icon | Adaptive icon + themed (monochrome) layer |
| Sign-out | Confirmation dialog on avatar tap (**both** platforms — RN signed out instantly) | same |
| Signing | Manual (Apple Distribution) | Release keystore from CI secrets |

## Known deviations from the RN app (both platforms)

- Avatar tap asks for confirmation before signing out.
- Saving a prediction on Match detail shows a "Saved" toast and stays on the match (RN stepped to the next match; web matches the native behaviour).
- Leaders keeps the filters visible and dims the list while reloading instead of replacing the whole screen with a spinner.
- Debug builds only: launch arguments / intent extras (`-fp-mock-session`, `fp_mock_session`, …) for running against `contract/mock-server.mjs`.
