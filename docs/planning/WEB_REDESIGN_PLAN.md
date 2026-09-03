# Web Redesign Plan — Pitch Premium

Port the Pitch Premium mobile redesign to the Next.js web frontend (`src/`).
Stack: Next.js 16, Tailwind CSS 4, shadcn/ui, CSS custom properties.

## Ship order

1. `globals.css` — design tokens
2. `src/app/layout.tsx` — JetBrains Mono font
3. `src/components/Navbar.tsx` — blur restyle
4. Matches page + MatchCard component
5. Match detail page
6. Predictions page (AccuracyStatsCard hero + ScoreTile)
7. Leaderboard (segmented filter + Podium + compact rows)
8. Login page

---

## Step 1 · `src/app/globals.css` — design tokens

Replace all CSS custom properties with the new Pitch Premium palette.

### Dark palette
| Token | Value |
|---|---|
| `--background` | `#07090E` |
| `--background-elevated` | `#0E121B` |
| `--card` | `#141925` |
| `--card-elevated` | `#1B2230` |
| `--foreground` | `#F2F5FA` |
| `--muted-foreground` | `#8A95A8` |
| `--border` | `rgba(255,255,255,0.06)` |
| `--primary` | `#10E089` |
| `--primary-foreground` | `#031A11` |
| `--primary-soft` | `rgba(16,224,137,0.12)` |
| `--primary-soft-border` | `rgba(16,224,137,0.30)` |
| `--destructive` / `--live` | `#FF4D6D` |
| `--warning` | `#F2B544` |
| `--gold` | `#F2C744` |

### Light palette
| Token | Value |
|---|---|
| `--background` | `#F4F6FA` |
| `--background-elevated` | `#FFFFFF` |
| `--card` | `#FFFFFF` |
| `--card-elevated` | `#F5F7FA` |
| `--foreground` | `#17202E` |
| `--muted-foreground` | `#5D6B7E` |
| `--border` | `rgba(0,0,0,0.08)` |
| `--primary` | `#0DB87A` |
| `--primary-foreground` | `#FFFFFF` |
| `--primary-soft` | `rgba(13,184,122,0.10)` |
| `--primary-soft-border` | `rgba(13,184,122,0.30)` |
| `--destructive` / `--live` | `#E11D48` |
| `--warning` | `#CA8A04` |
| `--gold` | `#D97706` |

### Radius
```css
--radius-sm:  8px;
--radius-md:  14px;
--radius-lg:  20px;
--radius-xl:  28px;
--radius-pill: 9999px;
```

### Utility classes to add
```css
.font-mono-nums {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

@keyframes live-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.4; transform: scale(1.5); }
}
.animate-live { animation: live-pulse 1.6s ease-out infinite; }
```

---

## Step 2 · `src/app/layout.tsx` — JetBrains Mono font

```tsx
import { JetBrains_Mono } from 'next/font/google';

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '700'],
});
```

Apply `jetbrainsMono.variable` to the `<html>` element alongside the existing Inter variable.

Apply `font-mono tabular-nums` Tailwind classes to **every number** on screen:
scores, points, rankings, percentages, countdowns, dates in tables.

---

## Step 3 · `src/components/Navbar.tsx` — blur restyle

- Change background from solid `bg-card` to `bg-card/85 backdrop-blur-md`
- Add `border-b border-border` hairline
- Height: keep existing; ensure `sticky top-0 z-50`
- Replace `⚽ Predictions` emoji title with bold "preds" wordmark (or keep — optional)

---

## Step 4 · Matches page + new MatchCard

**Files:** `src/app/(app)/matches/page.tsx` (extract card into same file or new component)

### MatchCard layout

```
┌─────────────────────────────────────────────────────┐
│ MATCHDAY 35 · PREMIER LEAGUE          [PICKED badge]│  ← top strip
├─────────────────────────────────────────────────────┤
│  [logo]          [score chip]          [logo]        │  ← body (3-col)
│  Arsenal            2–1              Brighton        │
│  #2 · 64 pts                          #7 · 42 pts   │
├╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌│  ← dashed border
│ Sat 17 May · 20:00              ⏱ 3h 12m to predict │  ← footer
└─────────────────────────────────────────────────────┘
```

**Top strip:**
- Competition label: `text-[10.5px] font-bold uppercase tracking-[0.08em] text-muted-foreground truncate`
- Status badge (right, `shrink-0`):
  - Live → `<span class="animate-live …" />` dot + "LIVE" in red-tinted pill
  - Locked → ghost pill "LOCKED"
  - Picked → brand pill "PICKED" (`bg-primary-soft border-primary-soft-border text-primary`)
  - Live strip background: `bg-[rgba(255,77,109,0.06)]`

**Body (3-col grid `grid-cols-[1fr_auto_1fr]`):**
- Team side: 36×36 logo + `text-sm font-semibold` name + `text-[10.5px] text-muted-foreground font-mono-nums` position
- Score chip (`min-w-[70px] px-[14px] py-1 rounded-md text-center`):
  - Predicted → `bg-primary-soft border border-primary-soft-border text-primary font-mono-nums text-[19px] font-bold`
  - Live → `bg-card-elevated border border-border text-foreground font-mono-nums text-xl font-bold`
  - Default → "VS" `text-xs font-semibold uppercase text-muted-foreground`

**Footer:**
- `border-t border-dashed border-border mt-[14px] pt-3 px-4 pb-[14px]`
- Left: kickoff `text-[11.5px] text-muted-foreground`
- Right: countdown `text-[11px] font-semibold font-mono-nums text-warning` + clock icon

---

## Step 5 · Match detail page — `src/app/(app)/matches/[matchId]/page.tsx`

### Custom page header
```
[ ← ]   MD 35 · PREMIER LEAGUE   [ spacer ]
```
- Back button: 36×36 round, `bg-card-elevated border border-border`
- Title: `text-[11.5px] font-bold uppercase tracking-[0.08em] text-muted-foreground`

### Hero predict card
- `rounded-[20px] border border-border overflow-hidden p-0`
- Radial tint: `before:absolute before:inset-x-[10%] before:top-0 before:h-20 before:rounded-full before:bg-primary/8 before:blur-xl`
- Date row (inside top padding): kickoff UPPERCASED left + open/locked Pill right
- 3-col teams row: existing `TeamColumn`-equivalent restyled with 48px logos + new stepper shell (`bg-card-elevated border border-border rounded-md p-1`)
- "Your call: **Arsenal wins**" summary line below steppers
- Save button: `h-12 w-full rounded-md bg-primary text-primary-foreground shadow-[0_0_20px_theme(colors.primary/25%)]`

### Recent Form card *(supersedes the original H2H card — see `docs/planning/FEATURE_PLAN.md` F7)*
- Two-column grid, one per team, for a compact side-by-side comparison instead of a single vertical head-to-head list
- Each column: team name, a row of 5 small W/D/L badges (`bg-emerald-500/15 text-emerald-500` / `bg-muted text-muted-foreground` / `bg-red-500/15 text-red-500`), then compact opponent/score rows below

### Group comparison card
- Member rows: 28px avatar initials + name + optional `· YOU` tag + mono score or italic "No pick"
- `divide-y divide-border` between rows

---

## Step 6 · Predictions page

**Files:**
- `src/app/(app)/predictions/AccuracyStatsCard.tsx`
- `src/app/(app)/predictions/page.tsx`

### AccuracyStatsCard — hero rebuild
```
┌─────────────────────────────────────────────┐
│ THIS WEEK                                   │
│ 24 pts          [████▒▒░░░░] sparkline      │
├──────────────┬──────────────┬───────────────┤
│   62%        │   18%        │   4           │
│   Outcome    │   Exact      │   Streak      │
└──────────────┴──────────────┴───────────────┘
```
- Top section: `p-4 border-b border-border`
  - "THIS WEEK" `text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground`
  - Big score: `text-[44px] font-bold font-mono-nums text-primary leading-none`
  - Sparkline: 10 bars, `flex items-end gap-[3px] h-9` — bar height proportional, fills:
    - ≥6 pts → `bg-primary`; 1–5 → `bg-primary/33`; 0 → `bg-border`; `rounded-[2px]`
- Bottom strip: `grid grid-cols-3 divide-x divide-border`
  - Each cell: `py-[14px] px-3 flex flex-col items-center gap-0.5`
  - Value: `text-xl font-bold font-mono-nums` (primary for Exact, warning for Streak)
  - Label: `text-[11px] text-muted-foreground`

Pass `weekPoints: number` and `recentPoints: number[]` as props from the parent page.

### ScoreTile — prediction card layout
```
┌──────────────────────────────────┬──────────┐
│ Sat 17 May · 20:00               │   +12    │
│ Arsenal vs Brighton              │  EXACT   │
│ PICK 2–1   FINAL 2–1             │          │
└──────────────────────────────────┴──────────┘
```
- Left col: date caption (muted) → match title (`font-semibold`) → Pick/Final inline cells
- Pick/Final cells: `text-[10.5px] font-bold uppercase text-muted-foreground` label + `font-mono-nums text-[12.5px]` value
- Right chip: `w-[72px] shrink-0 rounded-md border p-2 flex flex-col items-center`
  - Exact → `bg-primary-soft border-primary-soft-border text-primary`
  - pts>0 → `bg-card-elevated border-border text-warning`
  - 0 pts → `bg-card-elevated border-border text-muted-foreground`
  - Value: `text-[22px] font-bold font-mono-nums`; caption: `text-[9.5px] font-bold uppercase`

### Week nav
- `flex items-center justify-between`
- Arrow buttons: 32×32 round, `bg-card-elevated border border-border`
- Label: `text-sm font-semibold font-mono-nums`

---

## Step 7 · Leaderboard

**Files:**
- `src/app/(app)/leaderboard/PeriodNav.tsx`
- `src/app/(app)/leaderboard/LeaderboardFilters.tsx`
- `src/app/(app)/leaderboard/page.tsx`

### PeriodNav — segmented control
```
┌─────────────────────────────────────────────┐
│  Week  │  Month  │  All Time                │
└─────────────────────────────────────────────┘
```
- Shell: `bg-card-elevated border border-border rounded-[14px] p-1 grid grid-cols-3`
- Active: `bg-primary text-primary-foreground rounded-[10px] font-semibold`
- Inactive: `text-muted-foreground font-medium`
- Keep existing week/month offset nav arrows below when active

### Podium (top 3, shown only on current period)
Add above the row list when `entries.length >= 3`:

```
     [2nd]        [1st]        [3rd]
    avatar       avatar       avatar
    name         name         name
    score        score        score
   ┌──────┐   ┌──────────┐  ┌──────┐
   │  2   │   │    1     │  │  3   │
   │      │   │          │  │      │
   └──────┘   └──────────┘  └──────┘
   h-12       h-[86px]      h-12
```

- Container: `grid grid-cols-[1fr_1.2fr_1fr] items-end gap-2 px-2 pb-4`
- Tower: `w-full rounded-t-[14px] border-t border-x flex items-center justify-center`
  - Heights (Tailwind arbitrary): `h-12` / `h-[86px]` / `h-[62px]`
  - Medal colours: `#F2C744` (1st) / `#C5CDD9` (2nd) / `#CB8C5C` (3rd)
  - Tower bg/border: `rgba(medal, 0.33)` / `rgba(medal, 0.55)` via inline style
- Rank number inside tower: `text-xl font-[800]`

### Compact rows (rank 4+)
```
 4   [avatar]  Name · YOU 🔥   1,284
```
- `rounded-[14px] border border-border bg-card px-[14px] py-[11px] flex items-center gap-[10px]`
- isMe → `bg-primary-soft border-primary-soft-border`
- Rank: `w-[26px] text-[13px] font-bold font-mono-nums text-muted-foreground`
- Name: `text-[13px] font-semibold flex-1 truncate`
- YOU tag: `text-[10px] font-bold uppercase text-primary`
- Points: `text-[14px] font-bold font-mono-nums`

---

## Step 8 · Login page — `src/app/login/page.tsx`

Full-bleed layout (remove card wrapper):

```
[logo tile 56×56]

Predict the
beautiful game.

Score your picks against friends
across the Premier League, UCL and more.

            ↕ flex-1 spacer

[Email input]
[Password input]
[Sign In button  h-[54px] rounded-xl]

By continuing, you agree to our Terms and Privacy Policy.
```

- Root: `min-h-screen bg-background flex flex-col px-6 pt-safe`
- Logo tile: `w-14 h-14 rounded-2xl border border-primary-soft-border bg-primary-soft flex items-center justify-center mt-8`
- Hero title: `text-[36px] font-bold tracking-[-0.035em] leading-[1.1] mt-8`
- Subtitle: `text-[14.5px] text-muted-foreground leading-relaxed mt-3`
- Spacer: `flex-1 min-h-8`
- Form: `flex flex-col gap-4`
- Footer: `text-[11.5px] text-muted-foreground text-center mt-6 mb-8`

---

## What is skipped (same as mobile — no new features)
- Day-chip date filter on Matches
- Bookmark button on match detail
- "Season" period option
- "+X vs last week" delta chip
- "N pts career" subtitle on My Score header
- Sticky pinned-me row at leaderboard bottom

---

## Acceptance checklist
- [ ] Every number uses `font-mono-nums` (JetBrains Mono + `tabular-nums`)
- [ ] No `shadow-*` on Card — depth comes from `border` + tinted gradients only
- [ ] Pill/badge used for every status (no plain text "Locked", "Picked" etc.)
- [ ] Live state has pulsing dot (`animate-live`)
- [ ] Navbar blurs content scrolled behind it
- [ ] Theme toggle still works — light palette renders without weirdness
- [ ] All existing data hooks/fetches still work (no broken types)
