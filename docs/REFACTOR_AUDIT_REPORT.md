# Code Audit & Refactor Report

**Date:** 2026-04-17  
**Scope:** `football-predictions/` — full codebase audit across 6 dimensions  
**Outcome:** All issues resolved. TypeScript compiles clean (`npx tsc --noEmit` → 0 errors).

---

## Summary

| Category | Issues Found | Fixed |
|---|---|---|
| Dependencies | 1 | ✅ |
| Type Safety (`as any`) | 35+ occurrences | ✅ |
| Duplicate Code (DRY) | 3 | ✅ |
| Debug Code Left in Prod | 1 | ✅ |
| Variable Naming | 2 | ✅ |
| `<img>` vs `next/image` | 5 files | ✅ |
| God Components | 2 | ✅ |
| Client/Server Component boundary | 1 | ✅ |

---

## 1. Dependencies

### Issue — Wrong dependency bucket in `package.json`

**File:** `package.json`  
**Severity:** Low

`shadcn` (a CLI code-generation tool) and `@types/nodemailer` (TypeScript type declarations) were listed under `dependencies`, meaning they would be bundled into the production build unnecessarily.

```json
// Before
"dependencies": {
  "shadcn": "^2.5.0",
  "@types/nodemailer": "^6.4.17",
  ...
}
```

**Fix:** Moved both to `devDependencies`.

```json
// After
"devDependencies": {
  "shadcn": "^2.5.0",
  "@types/nodemailer": "^6.4.17",
  ...
}
```

---

## 2. Type Safety — `session.user as any` Pattern

### Issue — 35+ unsafe session casts across the entire codebase

**Affected files:**
- `src/app/api/admin/*` — 13 route handlers
- `src/app/api/matches/route.ts`
- `src/app/api/matches/[matchId]/route.ts`
- `src/app/api/groups/route.ts`
- `src/app/api/predictions/route.ts`
- `src/app/(app)/matches/page.tsx`

Every admin guard and user ID extraction used raw `as any` casts:

```ts
// Before — everywhere
if (!session || (session.user as any).role !== 'admin') {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
const userId = (session.user as any).id as number;
```

This suppresses TypeScript entirely for the most security-critical check in the app.

**Fix:** Added two typed helpers to `src/lib/auth.ts`:

```ts
// src/lib/auth.ts (additions)
type AppSessionUser = { id: string; role: string };

export function getSessionUser(session: Session): { id: number; role: string } {
  const u = session.user as AppSessionUser;
  return { id: Number(u.id), role: u.role };
}

export function isSessionAdmin(session: Session): boolean {
  return (session.user as AppSessionUser).role === 'admin';
}
```

All 35+ call sites replaced:

```ts
// After — all admin route handlers
import { auth, isSessionAdmin } from '@/lib/auth';
if (!session || !isSessionAdmin(session)) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

// After — pages and non-admin routes
import { auth, getSessionUser } from '@/lib/auth';
const { id: userId, role } = getSessionUser(session);
const isAdmin = role === 'admin';
```

---

## 3. Duplicate Code

### 3a. `ordinal()` defined in two files

**Files:** `src/app/(app)/matches/page.tsx`, `src/app/(app)/matches/[matchId]/page.tsx`  
**Severity:** Medium

Both files had an inline copy of the ordinal suffix function with a cryptic variable name:

```ts
// Duplicated in two files, with opaque variable name
const s = ['th','st','nd','rd'];
const v = n % 100;
return n + (s[(v - 20) % 10] || s[v] || s[0]);
```

**Fix:** Extracted once to `src/lib/utils.ts` with a readable name and both sites import from there:

```ts
// src/lib/utils.ts
export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const remainder = n % 100;
  return n + (s[(remainder - 20) % 10] ?? s[remainder] ?? s[0]);
}
```

### 3b. `RuleBreakdown` type defined in two files

**Files:** `src/components/ScoringBreakdown.tsx` (canonical), `src/app/(app)/admin/results/page.tsx` (duplicate)  
**Severity:** Low

`admin/results/page.tsx` had a local re-declaration of the same type that was already exported from `ScoringBreakdown.tsx`. Any future change to the type would require updating two places.

**Fix:** Removed the local declaration from `results/page.tsx` and added an import:

```ts
// Before
type RuleBreakdown = { ruleName: string; pointsAwarded: number; matched: boolean };

// After
import type { RuleBreakdown } from "@/components/ScoringBreakdown";
```

### 3c. `ScoringRule` typed as `any[]` in admin scoring page

**File:** `src/app/(app)/admin/scoring/page.tsx`  
**Severity:** Low

The scoring rules array was typed as `any[]`, losing all type checking on rule mutations.

**Fix:** Added a local `ScoringRule` type and replaced `any[]`:

```ts
type ScoringRule = {
  _id: string; key: string; name: string; description: string;
  points: number; isActive: boolean;
};
async function updateRule(id: string, update: Partial<Pick<ScoringRule, 'points' | 'isActive'>>) { ... }
```

---

## 4. Debug Code in Production

### Issue — `console.table(data.debug)` left in admin matches page

**File:** `src/app/(app)/admin/matches/page.tsx`  
**Severity:** Medium

A `console.table(data.debug)` call inside `fetchMatches()` logged internal API debug data to every admin's browser console on every fetch.

**Fix:** Removed the statement entirely.

---

## 5. Variable Naming

### 5a. Single-letter variable `s` from `serializeMatch`

**File:** `src/app/(app)/matches/page.tsx`  
**Severity:** Low

```ts
// Before
const s = serializeMatch(match);
// ...used as s._id, s.homeTeam.name, s.stage, etc.
```

**Fix:** Renamed to `serialized` throughout:

```ts
const serialized = serializeMatch(match);
```

### 5b. Cryptic variable `v` in `ordinal()` (also covered in §3a)

Renamed `v` → `remainder` when extracting the function to `utils.ts`.

---

## 6. Raw `<img>` vs `next/image`

### Issue — 5 files using `<img>` instead of `<Image>`

**Severity:** Medium — bypasses Next.js image optimization (lazy loading, WebP conversion, size hints, CLS prevention)

**Affected files and what was replaced:**

| File | Usage |
|---|---|
| `src/app/(app)/admin/leagues/page.tsx` | League logo in table |
| `src/app/(app)/admin/teams/page.tsx` | Team logo in table |
| `src/app/(app)/matches/[matchId]/page.tsx` | Home/away team logos (×2) |
| `src/app/(app)/matches/[matchId]/MatchH2H.tsx` | H2H match team logos |

**Fix pattern applied to all sites:**

```tsx
// Before
<img src={team.logo} alt={team.name} className="w-8 h-8 object-contain" />

// After
import Image from "next/image";
<Image src={team.logo} alt={team.name} width={32} height={32} className="object-contain" />
```

The `next.config.ts` already had `remotePatterns` covering `crests.football-data.org`, so no config change was needed.

---

## 7. God Components — File Splits

### 7a. `matches/[matchId]/page.tsx` — 469 lines → 253 lines

The match detail page mixed interactive state management with three large purely-visual sections (H2H history, league standings, all predictions list). Each section had its own types, helpers, and sub-components defined inline.

**New files created:**

| File | Responsibility | Key exports |
|---|---|---|
| `MatchH2H.tsx` | Head-to-head card with loading skeleton | `MatchH2H`, `H2HMatch` |
| `MatchStandings.tsx` | League standings card with form badges | `MatchStandings`, `Standing` |
| `AllPredictionsList.tsx` | All-predictions card with scoring breakdown | `AllPredictionsList`, `PredictionRow` |

`page.tsx` after the split:
- Owns only: state, effects, `handleSubmit`, `handleSaveResult`, and the main prediction/result card
- Composes the three display components with single-line calls:

```tsx
<MatchH2H h2h={h2h} loading={h2hLoading} />
<MatchStandings homeTeamName={...} awayTeamName={...} standings={standings} />
<AllPredictionsList predictions={allPredictions} hasResult={!!match.result} isKnockout={isKnockout} />
```

### 7b. `leaderboard/page.tsx` — 539 lines → 148 lines

The leaderboard page mixed data fetching, caching, date arithmetic, group/league filtering UI, period navigation UI, and the leaderboard list all in one file.

**New files created:**

| File | Responsibility |
|---|---|
| `useLeaderboard.ts` | Custom hook — all state, all `useEffect`s, client-side caching (`lbCache`, `upCache`), `toggleUser`, computed `weekLabel`/`monthLabel` |
| `LeaderboardFilters.tsx` | Group selector pills + tournament multi-select dropdown |
| `PeriodNav.tsx` | Period tabs (All Time / Month / Week) + prev/next navigation with date label |

`page.tsx` after the split:
- Calls `useLeaderboard()` and destructures everything
- Renders header, `<LeaderboardFilters>`, `<PeriodNav>`, and the leaderboard card
- `UserPredictionList` (35 lines, used only inside the list) kept inline

---

## 8. Client/Server Component Boundary

### Issue — Admin layout used `usePathname` which requires `"use client"`

**File:** `src/app/(app)/admin/layout.tsx`  
**Severity:** Medium

The admin layout had inline nav-link rendering that required `usePathname()` for active-link highlighting, forcing the entire layout to be a Client Component. This meant the auth redirect (`redirect()`) ran client-side instead of server-side.

**Fix:** Extracted `AdminNav.tsx` as a dedicated Client Component:

```tsx
// src/app/(app)/admin/AdminNav.tsx
"use client";
import { usePathname } from "next/navigation";
// ... renders nav links with active highlighting
```

`layout.tsx` became a pure Server Component:

```tsx
// src/app/(app)/admin/layout.tsx — Server Component
export default async function AdminLayout({ children }) {
  const session = await auth();
  if (!session || !isSessionAdmin(session)) redirect("/dashboard"); // server-side
  return (
    <div ...>
      <AdminNav />   {/* client island — only the nav */}
      {children}
    </div>
  );
}
```

---

## Files Changed

| File | Change type |
|---|---|
| `package.json` | Move 2 packages to devDependencies |
| `src/lib/auth.ts` | Add `getSessionUser()`, `isSessionAdmin()` |
| `src/lib/utils.ts` | Add `ordinal()` |
| `src/app/(app)/admin/layout.tsx` | Simplify to Server Component |
| `src/app/(app)/admin/AdminNav.tsx` | **New** — active-link Client Component |
| `src/app/(app)/admin/scoring/page.tsx` | Add `ScoringRule` type, remove `any[]` |
| `src/app/(app)/admin/results/page.tsx` | Remove duplicate `RuleBreakdown` type |
| `src/app/(app)/admin/matches/page.tsx` | Remove `console.table(data.debug)` |
| `src/app/(app)/admin/leagues/page.tsx` | `<img>` → `<Image>` |
| `src/app/(app)/admin/teams/page.tsx` | `<img>` → `<Image>` |
| `src/app/(app)/matches/page.tsx` | Use `getSessionUser`, `ordinal` from utils, rename `s` → `serialized` |
| `src/app/(app)/matches/[matchId]/page.tsx` | Split: 469 → 253 lines; use 3 sub-components |
| `src/app/(app)/matches/[matchId]/MatchH2H.tsx` | **New** — H2H display card |
| `src/app/(app)/matches/[matchId]/MatchStandings.tsx` | **New** — standings display card |
| `src/app/(app)/matches/[matchId]/AllPredictionsList.tsx` | **New** — all-predictions display card |
| `src/app/(app)/leaderboard/page.tsx` | Split: 539 → 148 lines; compose hook + sub-components |
| `src/app/(app)/leaderboard/useLeaderboard.ts` | **New** — all state, caching, data fetching |
| `src/app/(app)/leaderboard/LeaderboardFilters.tsx` | **New** — group selector + tournament dropdown |
| `src/app/(app)/leaderboard/PeriodNav.tsx` | **New** — period tabs + week/month navigation |
| `src/app/api/admin/*` (13 routes) | `isSessionAdmin()` replaces `as any` guards |
| `src/app/api/matches/route.ts` | `getSessionUser()` replaces `as any` casts |
| `src/app/api/matches/[matchId]/route.ts` | `getSessionUser()` replaces `as any` casts |
| `src/app/api/groups/route.ts` | `getSessionUser()` replaces `as any` casts |
| `src/app/api/predictions/route.ts` | `getSessionUser()` replaces `as any` casts |
