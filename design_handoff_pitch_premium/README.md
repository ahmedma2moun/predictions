# Handoff: Pitch Premium — Modern UI for the `preds` mobile app

## Overview

This bundle is a complete visual redesign of the **predictions** Expo / React Native mobile app — a football score-prediction tool with tabs for **Matches**, **My Score** and **Leaderboard**, plus **Match Detail** (predict) and **Login** screens. The redesign elevates the existing dark navy + emerald palette into a more confident, premium feel — deeper near-black surfaces, brighter primary emerald, hairline borders, gradient-tinted heroes, monospaced numerals, a live-pulse indicator, a podium row on the leaderboard, segmented period filters, and a richer accuracy/streak hero on My Score.

The existing app structure, navigation, data shapes (`src/types/api.ts`), and hooks all stay the same — this is a **skin-level redesign** plus a handful of component layout refactors. No API or routing changes.

## About the design files

The HTML files in this bundle are **design references** — a clickable web prototype built in React + inline JSX so reviewers can see the intended look and behaviour at high fidelity. They are **not code to copy line-for-line**. Your task is to **recreate these designs inside the existing Expo / React Native codebase at `predictions/mobile/`**, reusing its established patterns:

- `StyleSheet.create` + the `useTheme()` palette switcher in `src/theme/theme.tsx`
- `expo-image` for logos / avatars
- `@expo/vector-icons` (Ionicons) for glyphs — replace inline SVGs in the prototype with `<Ionicons name="…">`
- Existing components in `src/components/*` (refactor them in place)
- Expo Router for navigation (no changes needed)

The mockups use placeholder striped circles for team crests because no real logos were available — `expo-image` already handles real `team.logo` URLs in the live app, keep that.

## Fidelity

**High-fidelity (hifi).** Exact hex values, type scale, spacing, and component layouts are all locked in. Pixel-target everything you see in the prototype. The only flexibility is icon set (use Ionicons consistently, replacing the prototype's inline SVGs).

## Files in this bundle

| File | Purpose |
|---|---|
| `Preds Modern UI.html` | The clickable prototype — open in a browser to view all 5 screens + handoff sheet on a pan/zoom canvas |
| `screens.jsx` | Shared atoms — `tokens`, `StatusBar`, `Logo`, `Avatar`, `Pill`, `Card`, `LiveDot`, `IconBtn`, `TabBar`, `AppHeader`, `SectionTitle` |
| `screens-matches.jsx` | `MatchesScreen`, `MatchCard`, `MatchDetailScreen`, `TeamPicker`, H2H rows, group-comparison rows |
| `screens-rest.jsx` | `MyScoreScreen`, `ScoreTile`, `LeaderboardScreen`, `PodiumCol`, `LbRow`, `LoginScreen` |
| `handoff.jsx` | The on-canvas handoff sheet (renders the spec page in-prototype) |
| `app.jsx` | Boot — composes the design canvas |
| `design-canvas.jsx` | Pan/zoom canvas host (read-only — don't port) |

To view: open `Preds Modern UI.html` in any modern browser. No build step.

---

## Design tokens

Update `predictions/mobile/src/theme/colors.ts`. The `Palette` type is unchanged; only values shift. The light palette mirrors the dark one with proportional lifts — values listed second.

### Surfaces

| Token | Dark | Light |
|---|---|---|
| `background` | `#07090E` | `#F4F6FA` |
| `backgroundElevated` | `#0E121B` | `#FFFFFF` |
| `card` | `#141925` | `#FFFFFF` |
| `cardElevated` | `#1B2230` | `#F5F7FA` |
| `border` | `rgba(255,255,255,0.06)` | `rgba(0,0,0,0.08)` |

### Foreground

| Token | Dark | Light |
|---|---|---|
| `foreground` | `#F2F5FA` | `#17202E` |
| `mutedForeground` | `#8A95A8` | `#5D6B7E` |

### Brand & status

| Token | Dark | Light |
|---|---|---|
| `primary` | `#10E089` | `#0DB87A` |
| `primaryForeground` | `#031A11` | `#FFFFFF` |
| `primarySoft` | `rgba(16,224,137,0.12)` | `rgba(13,184,122,0.10)` |
| `primarySoftBorder` | `rgba(16,224,137,0.30)` | `rgba(13,184,122,0.30)` |
| `warning` (amber) | `#F2B544` | `#CA8A04` |
| `live` (destructive) | `#FF4D6D` | `#E11D48` |
| `gold` | `#F2C744` | `#D97706` |

### Geometry — replace existing values in `radius` & `spacing`

```ts
export const radius = {
  sm: 8, md: 14, lg: 20, xl: 28, pill: 999,
};
export const spacing = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32,
};
```

### Type

Add **JetBrains Mono** (load via `expo-font` from `@expo-google-fonts/jetbrains-mono`) for *every number* — points, scores, rankings, percentages, countdowns, dates within tables. Keep **Inter** (already in the project) for everything else.

Extend the `font` export:

```ts
export const font = {
  size:   { xxs: 10, xs: 11, sm: 13, md: 15, lg: 17, xl: 20, xxl: 28, display: 36 },
  weight: { regular: '400', medium: '500', semibold: '600', bold: '700', heavy: '800' },
  family: { sans: 'Inter', mono: 'JetBrainsMono' },
};
```

Apply `fontVariant: ['tabular-nums']` to every mono usage so columns align.

---

## Screens

### 1 · Login (`mobile/app/login.tsx`)

**Purpose** — Pre-auth landing; sign in with Google or Apple.

**Layout**
- Full bleed, dark background
- Top-left logo tile (56×56, rounded 16, emerald gradient w/ shadow)
- Hero copy 36px / weight 700 / `letter-spacing -0.035em` / 2 lines
  - "Predict the\nbeautiful game."
- Body copy 14.5px / `mutedForeground`
  - "Score your picks against friends across the Premier League, UCL and more."
- Decorative pitch markings in top-right (1px stroke, 6% opacity, `primary` colour)
- Spacer flex
- Two full-width buttons (height 54, radius `lg`):
  1. **Continue with Google** — `primary` background, `primaryForeground` text, soft brand-tinted shadow, Google G logo
  2. **Continue with Apple** — `card` background, `border` outline, Apple logo
- Footer microcopy 11.5px `fgDim`, centered: "By continuing, you agree to our Terms and Privacy Policy."

### 2 · Matches — upcoming (`mobile/app/(tabs)/matches.tsx`)

**Purpose** — Browse fixtures, see which need a pick, jump into the predict screen.

**Layout** (top to bottom)
1. Status bar (system)
2. `AppHeader` — title "Matches" 28px/700/-0.025em, subtitle "N fixtures · M still open" 13px muted, right-side row: filter icon button (36×36 round) + user avatar (36)
3. Day-chip strip — horizontal `Pressable` row: `All`, `Today`, `Tomorrow`, `This week`, `Next week`. Active chip = `primary` bg + `primaryForeground` text; others = transparent + border.
4. Match cards — vertical stack, `gap: 12`, padded 16

**Match card** — `Card` with `padding: 0` so children flush:
- **Top strip** (padding 11/16/9): competition label (10.5px / 700 / `mutedForeground` / `letterSpacing: 0.08em` / UPPER, ellipsis-truncate, `flex: 1`) on left; status pill on right (`flexShrink: 0`):
  - Live → `Pill tone="live"` with pulsing `LiveDot` + "LIVE 67'"
  - Locked → `Pill tone="ghost"` "LOCKED"
  - Picked → `Pill tone="brand"` "PICKED"
- Top strip background: linear gradient `rgba(255,77,109,0.06)` → transparent if live; else none. Bottom border = `border`.
- **Body** (padding 14/16/16):
  - 3-col grid `1fr auto 1fr` `gap: 12`, `align: center`
  - Left/right: 36×36 logo + team name (14/600) + position chip "#2 · 64 pts" (mono 10.5/`mutedForeground`)
  - Center: score chip — `minWidth: 70`, `whiteSpace: nowrap`, padding `4px 14px`, radius `md`
    - Live → `bgElev` bg, `border`, mono 22/700 `foreground` numerals
    - Picked (predicted) → `primarySoft` bg, `primarySoftBorder`, mono 20/700 `primary`
    - Else → "VS" 11px 600 uppercase `fgDim`
- **Footer** (margin-top 14, padding-top 12, `border-top: 1px dashed border`):
  - Left: kickoff time 11.5px `mutedForeground`
  - Right (`whiteSpace: nowrap`): countdown mono 11/600 amber + clock icon + "3h 12m to predict" / live → "Your pick: 2–1" / locked → "No prediction submitted"

### 3 · Match Detail / Predict (`mobile/app/matches/[matchId].tsx`)

**Purpose** — Set a score prediction, see H2H, compare with your group.

**Layout**
1. Custom header row (8/20): 36px round back button (`card` + `border`, chevron-back) — centered title "MD 35 · Premier League" (11.5/700/UPPER/`mutedForeground`, `whiteSpace: nowrap`) — 36px placeholder right
2. Hero predict `Card` (padding 0):
   - Inner padding 20/20/24, radial gradient `rgba(16,224,137,0.10) → transparent 70%` from top-center
   - Date row: "Sat 17 May · 20:00" 11/600/UPPER `mutedForeground` left; `Pill tone="amber"` with clock icon "3h 12m left" right
   - 3-col grid (`1fr auto 1fr`): TeamPicker — Logo 48px → name 13/600 → "#2 · 64 pts" mono 10.5/`mutedForeground` → **Stepper** (44px wide value display flanked by 30×30 +/− buttons, all inside a `bgElev`+`border`+radius `md` group with 4px inner padding)
   - Center: `–` em-dash mono 24/600/`fgDim`
   - Your call summary 12/`mutedForeground` — "Your call: **Arsenal wins**" with team in `foreground` 600
   - Button row: full-width primary "Save prediction" (48 tall, radius `md`, primary bg, primary glow shadow) + 48×48 bookmark icon button
3. **Head to head** `Card`
   - Section title 13/700
   - 3 numbers row: home wins (foreground mono 26/700), draws (`mutedForeground`), away wins (foreground)
   - 6px tall stacked bar — `primary` (home %) + `fgDim` (draws) + `hsl(210 60% 55%)` (away)
   - 3 past meetings as table rows w/ hairline dividers: date (11/`mutedForeground`/w70), team (12.5), score (mono 12.5/700), team
4. **Your group** `Card`
   - Header row: "Your group · Office" 13/700 + "Switch ▾" 11/`mutedForeground` chevron link
   - Member rows: 28px avatar + name (13/500) + optional "· YOU" tag (10/600/UPPER/`primary`) + score (mono 13/700) or "No pick" (11/italic/`fgDim`)
   - Hairline divider between rows

### 4 · My Score (`mobile/app/(tabs)/predictions.tsx`)

**Purpose** — Review past predictions, see weekly score + accuracy + streak.

**Layout**
1. `AppHeader` — "My Score" + subtitle "Season 24/25 · 1,284 pts career" + avatar
2. **Hero stat card** (padding 0):
   - Top section (18/20, gradient `primarySoft` → transparent diagonal, bottom border):
     - "THIS WEEK" caption 11/600/UPPER/0.08em
     - Row: big "24" mono 44/700/`primary`/-0.03em + "pts" 14/`mutedForeground` ON LEFT; "+8 vs last week" chip 12/700/mono/primary with double-up arrows ON RIGHT
     - 10-bar weekly sparkline below (height 36, gap 6, flex). Bar fills `primary` if ≥6 pts, `primary` 33% alpha if 1–5, `borderStrong` if 0. Radius 2.
   - Bottom 3-col stat strip (padded 14/12 each, vertical hairline dividers):
     - "62% Outcome" / "18% Exact" (`primary`) / "4 Streak" (`amber`)
     - Each: mono 20/700 number, 11/`mutedForeground` label
3. Week nav row: 32px round arrow left + "Mon 12 May · Sun 18 May" 13/600 center + arrow right
4. **Score tiles** (one per past match) — `Card`:
   - Left col: day caption 11/`mutedForeground` → "Arsenal vs Brighton" 13.5/600 (vs in `fgDim` 400) → row of `Pick 2-1` (dim) + `Final 2-1` (bold) cells, labels 10.5 UPPER, values mono 12.5
   - Right cell: 72px wide chip, padding 10/8, radius `md`
     - If exact → `primarySoft` bg + `primarySoftBorder`; mono 22/700 `primary` value "+12" + "EXACT" 9.5/UPPER caption
     - Else if pts>0 → translucent bg + `border`; `amber` value
     - Else → `fgDim` value "0" + "pts" caption

### 5 · Leaderboard (`mobile/app/(tabs)/leaderboard.tsx`)

**Purpose** — Rank players in the user's group; show their badges and stats.

**Layout**
1. `AppHeader` — "Leaders" + subtitle "Office · 14 players" + filter icon + avatar
2. **Segmented period filter** — 4-cell grid `Week | Month | Season | All`, inside a `card`+`border`+radius-`md` shell with 4px inner padding. Active segment = `primary` bg + `primaryForeground`; others = transparent + `mutedForeground`.
3. **Podium** — 3-col grid (`1fr 1.2fr 1fr`), bottom-aligned. Each column:
   - Avatar (1st = 48px, others = 40px)
   - First name 11.5–12.5/600
   - Score mono 15–18/700
   - "Tower" tile — gradient `medal33 → medal11` bg, `medal55` border, top-rounded `md`, height 48/86/62 (3rd/1st/2nd), big medal number 20/800 inside. Medal colours: 1=`#F2C744`, 2=`#C5CDD9`, 3=`#CB8C5C`.
4. Compact rows for ranks 4+:
   - Padding 11/14, gap 10, radius `md`, `card` bg + `border` (or `primarySoft` + `primarySoftBorder` if `isMe`)
   - Rank (26px mono 13/700/`mutedForeground`) → 32px avatar → name (13/600) + badges (`🔥{streak}` when ≥3 / `🎯{exact}` when ≥2) → mono 14/700 points
5. **My pinned row** at bottom — same shape as compact rows but always sticky pinned with `primary` rank colour and gradient `primarySoft → transparent` bg. Stats line: "82 picks · 4 streak · 🎯 3 exact".
6. Tab bar (sticky bottom, 86% `card` opacity + 24px `backdrop-blur`, `border-top` hairline, active = `primary`)

---

## Behaviour & interactions

| Surface | Behaviour |
|---|---|
| Day chip strip (matches) | Filters list by date range — implementation: derive from existing `useMatches` hook; client-side filter on `kickoffTime`. Active state is local state. |
| Match card | `Pressable` → `router.push('/matches/[id]')`. Opacity 0.7 on press. |
| `Pill tone="live"` | LiveDot pulses — RN equivalent: `Animated.loop` on a scaled View with brand-shadow opacity ramp 0→1. CSS used `box-shadow` rings; in RN use a wrapping `Animated.View` with `transform: [{scale}]` + opacity 0.6→0 over 1.6s ease-out. |
| Score stepper | +/− buttons clamp 0…15. Existing `<TeamColumn>` component already implements this; reskin only. |
| Save prediction button | Calls existing `POST /api/mobile/predictions`. Show toast / Alert on success → `router.back()`. |
| Segmented period filter | Replaces the existing `LeaderboardFilters` row; wires into existing `useLeaderboard` `period` state. |
| Hero week sparkline (My Score) | Derive 10 bars from `usePredictions` data — last 10 scored predictions. Reuse existing data; no new API. |
| Group comparison switcher | Existing `groups` array + `selectedGroupId` state — re-styled only. |
| Pull to refresh | Existing `RefreshControl` on every list; keep. |

---

## Component map — what to change in `predictions/mobile/src/components/`

| File | Action |
|---|---|
| `ui.tsx` | **Card**: new padding 16, radius `lg` (20), border `border`, no shadow. **Badge → Pill**: rename or add `Pill` atom with `tone: 'brand' \| 'live' \| 'amber' \| 'neutral' \| 'ghost'`; keep `Badge` as a re-export alias for back-compat. Add new atom `LiveDot` (animated pulse). |
| `PredictionCard.tsx` | Refactor into the **ScoreTile** layout: kickoff caption → teams row → Pick/Final inline cells → big points chip on right side (`primarySoft` if exact). |
| `LeaderboardRow.tsx` | Drop the existing card-wrap row in favour of the **compact-row** spec above. Add a separate `Podium` component used only for the first 3 entries in the screen. Keep expansion behaviour for tap-to-expand on rows 4+. |
| `LeaderboardFilters.tsx` | Replace the period selector body with a 4-cell **segmented control**. League/group dropdowns can keep their existing structure but restyled to use new tokens. |
| `AccuracyStatsCard.tsx` | Rebuild as the **hero stat card** with big 44px number, delta chip, 10-bar sparkline, and 3-col stat strip. |
| `TeamColumn.tsx` | Bigger logo (48), name & position spec above; restyled stepper inside a `bgElev`/`border` shell. |
| `H2HRow.tsx` | Tighter row, dotted hairline dividers between rows, mono score column. |
| `StandingsRow.tsx` | Add to the same `Card`-with-section-title pattern used elsewhere. |

## Tab bar — `mobile/app/(tabs)/_layout.tsx`

Replace `tabBarStyle`:

```ts
tabBarStyle: {
  position: 'absolute',          // so blur composites over content
  backgroundColor: 'rgba(10,12,18,0.86)',
  borderTopColor: colors.border,
  borderTopWidth: StyleSheet.hairlineWidth,
  elevation: 0,
  height: 78,
  paddingTop: 8, paddingBottom: 28,
},
tabBarBackground: () => (
  <BlurView intensity={24} tint="dark" style={StyleSheet.absoluteFill} />
),
```

Wire `BlurView` from `expo-blur`. Active tint = `colors.primary`, inactive = `colors.mutedForeground`.

Header (top bar) styling stays largely the same, but replace the "⚽ Predictions" emoji title with a left-aligned bold "preds" wordmark or keep current title — your call.

---

## State management

No new state. Every screen reuses the existing hooks:

- `useMatches()` — matches list
- `usePredictions()` — past predictions, total points
- `useAccuracyStats()` — stats card data
- `useLeaderboard()` — leaderboard rows, filters, expansion
- `useAuth()` — `user`, `token`, `signOut`
- `useTheme()` — palette switcher, already wired

Period filter on Leaderboard adds `'all'` as a 4th option alongside the existing `'week' | 'month' | 'season'` — extend `usePeriodFilter`.

---

## Assets

No new assets. Mockups use:
- Generated initials avatars (replace with real `avatarUrl` from API)
- Striped placeholder logos (replace with real `team.logo` via `expo-image`)
- Inline SVG icons (replace with `<Ionicons />`: filter-outline, calendar-outline, trending-up-outline, trophy-outline, time-outline, chevron-back, chevron-forward, chevron-down, bookmark-outline, log-out-outline, sunny-outline, moon-outline)

Add **JetBrains Mono** font: `npx expo install @expo-google-fonts/jetbrains-mono expo-font` and load alongside Inter in `mobile/app/_layout.tsx`.

---

## Ship order

1. Update `theme/colors.ts` palette values (both dark + light) and extended `font.family`/`font.size`.
2. Load JetBrains Mono via `expo-font` in the root `_layout.tsx`.
3. Replace the `Badge` atom with `Pill` in `components/ui.tsx`; add `LiveDot`. Update `Card` to the new geometry.
4. Restyle the tab bar in `app/(tabs)/_layout.tsx` (BlurView, border, sizing).
5. Refactor `(tabs)/matches.tsx` + `components/MatchCard` (new) — most visible win.
6. Refactor `matches/[matchId].tsx` — hero predict layout + restyle existing sections.
7. Refactor `(tabs)/predictions.tsx` — `AccuracyStatsCard` becomes hero; `PredictionCard` becomes `ScoreTile`.
8. Refactor `(tabs)/leaderboard.tsx` — segmented filter + podium + compact rows + pinned-me row.
9. Restyle `app/login.tsx`.
10. Verify light palette renders correctly in the theme toggle.

## Acceptance checks

- [ ] Every number on screen uses `JetBrainsMono` + `fontVariant: ['tabular-nums']`
- [ ] No `shadowColor` is set on `Card` — depth comes from border + tinted gradients only
- [ ] `Pill` is used for every status (no plain text "Locked", "Picked", etc.)
- [ ] Live state pulses (animated)
- [ ] Theme toggle still works — light palette renders without weirdness
- [ ] Tab bar blurs the content scrolled behind it
- [ ] All existing data hooks still satisfy their consumers (no broken types)
