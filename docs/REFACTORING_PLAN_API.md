# Refactoring Plan — Backend / API Layer
## Audit Findings + Phased Execution Checklist

> **Scope**: API layer only — `football-predictions/src/`
> **Companion doc**: See [`REFACTORING_PLAN.md`](./REFACTORING_PLAN.md) for all React Native mobile categories.
> **Audit date**: 2026-04-17
> **Status**: Phase 3 not yet started

---

## How to use this document

- Categories execute **one at a time**, in order. Do not start a category until the previous one is fully checked.
- Each item has a checkbox — check it off as soon as the change is merged.
- Items marked `⚠️ CONFIRM BEFORE CHANGE` require explicit approval before touching the file (auth, scoring, push notifications).
- Items marked `🔒 ADMIN ROUTE` touch admin-only endpoints — verify the `isSessionAdmin` guard is preserved after every refactor.
- Items marked `📏 FILE SPLIT` require the split plan to be confirmed before any code is written (files > 150 lines for controllers/services).

---

# PHASE 1 — AUDIT (READ-ONLY)

> Completed 2026-04-17.

- [x] Full API layer scan (B1 Architecture · B2 DRY · B3 Clean Code · B4 API Design · B5 Performance · B6 Security · B7 Error Handling · B8 Observability)
- [x] Prioritized plan produced (Phase 2)

---

# PHASE 2 — PRIORITIZED PLAN

> Written plan only — no code changes.

- [x] Security fixes identified and ordered
- [x] Architecture & SOLID violations identified
- [x] DRY violations identified
- [x] Clean Code violations identified
- [x] API performance wins identified
- [x] Error handling & observability gaps identified

---

# PHASE 3 — EXECUTION

Execute in order: **Security → Architecture → DRY → Clean Code → API Performance → Error Handling & Observability → Dependencies → Prisma Query Optimizations**

---

## Category 1 — Security Fixes

> Fix these before anything else. None should change behavior — they only add guards.

### 1.1 — Safe JSON body parsing utility

**Problem**: `req.json()` throws an unhandled exception on a malformed request body (e.g., truncated JSON from a crashed mobile client). The result is an unhandled 500 with a Node.js stack trace in the response body — both a security leak and a bad API contract.

**Files affected**:
- `src/app/api/mobile/auth/login/route.ts`
- `src/app/api/admin/matches/route.ts` (POST + DELETE)
- `src/app/api/mobile/devices/route.ts` (POST + DELETE)
- `src/app/api/mobile/predictions/route.ts` (POST)
- `src/app/api/predictions/route.ts` (POST)

**Plan**:
1. Create `src/lib/request.ts`:
   ```ts
   export async function safeParseBody<T>(req: NextRequest): Promise<T | null> {
     try { return await req.json() as T; }
     catch { return null; }
   }
   ```
2. Replace all bare `await req.json()` calls with `safeParseBody`
3. Return `400 { error: 'Invalid request body' }` when the result is `null`

- [ ] Create `src/lib/request.ts` — `safeParseBody` utility
- [ ] `src/app/api/mobile/auth/login/route.ts` — use `safeParseBody` ⚠️ CONFIRM BEFORE CHANGE
- [ ] `src/app/api/admin/matches/route.ts` — use `safeParseBody` (POST + DELETE) 🔒 ADMIN ROUTE
- [ ] `src/app/api/mobile/devices/route.ts` — use `safeParseBody` (POST + DELETE)
- [ ] `src/app/api/mobile/predictions/route.ts` — use `safeParseBody` (POST)
- [ ] `src/app/api/predictions/route.ts` — use `safeParseBody` (POST)

---

### 1.2 — Rate limiting on mobile login endpoint

**Problem**: `/api/mobile/auth/login` has no rate limiting. An attacker can make unlimited login attempts against the small user base with no friction.

**Plan**:
- 5 attempts per IP per 60 seconds
- Return `429 Too Many Requests` with `Retry-After: 60` header on excess
- Implementation choice: Upstash Redis (`@upstash/ratelimit` — Vercel Edge compatible) or `lru-cache` in-memory (simpler, resets on cold start)

> **⚠️ CONFIRM BEFORE CHANGE** — touches authentication. Confirm the rate-limit backend (Upstash Redis vs. in-memory) and install any package before implementing.

- [ ] Confirm rate-limit implementation approach
- [ ] Install approved package (if external)
- [ ] `src/app/api/mobile/auth/login/route.ts` — add rate limiting ⚠️ CONFIRM BEFORE CHANGE

---

### 1.3 — Separate `MOBILE_JWT_SECRET` from `NEXTAUTH_SECRET`

**Problem**: `src/lib/mobile-auth.ts` signs and verifies mobile JWTs using `NEXTAUTH_SECRET`. Rotating the NextAuth secret (e.g., after a session breach) simultaneously invalidates every mobile session with no way to decouple them.

**Plan**:
- Read `process.env.MOBILE_JWT_SECRET ?? process.env.NEXTAUTH_SECRET` in `mobile-auth.ts`
- Fall back preserves all existing tokens — zero downtime migration
- Document `MOBILE_JWT_SECRET` as a new env var in deployment docs

- [ ] `src/lib/mobile-auth.ts` — `getSecret()` reads `MOBILE_JWT_SECRET ?? NEXTAUTH_SECRET` ⚠️ CONFIRM BEFORE CHANGE
- [ ] Add `MOBILE_JWT_SECRET` to `.env.local` example comments
- [ ] Update `docs/architecture/DEPLOYMENT_GUIDE.md` — add env var entry
- [ ] Update `docs/architecture/SECURITY_ARCHITECTURE.md` — document the JWT split

---

### 1.4 — Validate integer `id` in admin users PATCH

**Problem**: `src/app/api/admin/users/route.ts` PATCH passes `id` directly to `Number(id)` without checking for `NaN`. A non-numeric `id` from a buggy client produces a cryptic Prisma runtime error instead of a clean 400.

- [ ] `src/app/api/admin/users/route.ts` PATCH — add guard:
  ```ts
  if (!id || !Number.isInteger(Number(id))) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }
  ```
  🔒 ADMIN ROUTE

---

### ✅ Category 1 done when all boxes above are checked.

---

## Category 2 — Architecture & SOLID Refactors

> 📏 File splits require the plan to be confirmed before any code is written.

### 2.1 — Extract cron authorization helper

**Problem**: The following 9-line block is copy-pasted verbatim in all 4 cron route handlers:
```ts
const authHeader    = req.headers.get('authorization');
const cronSecret    = process.env.CRON_SECRET;
const triggerSecret = process.env.TRIGGER_SECRET;
const isVercelCron  = !!req.headers.get('x-vercel-cron-schedule');
const authorized    = isVercelCron
  || (cronSecret    && authHeader === `Bearer ${cronSecret}`)
  || (triggerSecret && authHeader === `Bearer ${triggerSecret}`);
if (!authorized) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
```
Any change to cron auth logic must be applied in 4 places.

**Plan**:
```ts
// src/lib/cron-auth.ts
export function verifyCronRequest(req: NextRequest): boolean { ... }
```
Each cron handler becomes a one-liner: `if (!verifyCronRequest(req)) return NextResponse.json(...)`.

- [ ] Create `src/lib/cron-auth.ts` — `verifyCronRequest(req: NextRequest): boolean`
- [ ] `src/app/api/cron/fetch-matches/route.ts` — replace inline auth block
- [ ] `src/app/api/cron/fetch-results/route.ts` — replace inline auth block
- [ ] `src/app/api/cron/daily-reminder/route.ts` — replace inline auth block
- [ ] `src/app/api/cron/prediction-reminder/route.ts` — replace inline auth block

---

### 2.2 — Decompose `results-processor.ts` (342 lines → SRP) 📏

**Problem**: `processMatchResults` is a 192-line single function that mixes 6 responsibilities: external API fetching, DB match updates, prediction scoring, scoring persistence, email dispatch, and FCM push. A failure in push notification silently masks a scoring error because both run in the same try/catch scope.

**Proposed split** (confirm before executing):

| Function | Responsibility | Location |
|---|---|---|
| `batchScorePredictions(matchId, preds, result, rules, logPrefix)` | Score predictions + `$transaction` update | same file |
| `sendResultNotifications(userMatchMap, logPrefix)` | Email dispatch + FCM push + leaderboard query | same file (or `src/lib/services/notification-service.ts`) |
| `processMatchResults(logPrefix)` | Orchestrator — fetches, calls the two above | same file (~80 lines) |
| `correctMatchResult(...)` | Unchanged — already focused | same file |

- [ ] Confirm split plan above
- [ ] `src/lib/results-processor.ts` — extract `batchScorePredictions` ⚠️ CONFIRM BEFORE CHANGE
- [ ] `src/lib/results-processor.ts` — extract `sendResultNotifications` ⚠️ CONFIRM BEFORE CHANGE
- [ ] Verify `src/app/api/cron/fetch-results/route.ts` still works after refactor
- [ ] Verify `src/app/api/admin/matches/route.ts` `fetch-results` action still works after refactor
- [ ] Verify `src/app/api/mobile/matches/[matchId]/route.ts` PATCH still works after refactor

---

### 2.3 — Decompose `matches-processor.ts` — separate notifications 📏

**Problem**: `fetchAndInsertMatches` handles fixture fetching + DB insertion + email notifications + FCM push in a single function. The notification logic at the end of the function (lines 132–173) can be extracted without changing the insertion logic.

**Plan**:
```ts
// Extract at the end of fetchAndInsertMatches:
async function sendNewMatchNotifications(
  weekStart: Date,
  insertedCount: number,
  logPrefix: string,
): Promise<void>
```

- [ ] Confirm split plan above
- [ ] `src/lib/matches-processor.ts` — extract `sendNewMatchNotifications` ⚠️ CONFIRM BEFORE CHANGE
- [ ] Verify `src/app/api/cron/fetch-matches/route.ts` still works
- [ ] Verify `src/app/api/admin/matches/route.ts` `fetch` action still works

---

### ✅ Category 2 done when all boxes above are checked.

---

## Category 3 — DRY Refactors

### 3.1 — Shared `RuleRow` type + `serializeBreakdown` helper

**Problem**: The following type declaration and mapper are copy-pasted in two route handlers:

```ts
// In BOTH mobile/predictions/route.ts AND mobile/matches/[matchId]/route.ts
type RuleRow = { key?: string; ruleId?: number; ruleName: string; pointsAwarded: number; matched: boolean };

// ...and the mapper:
((p.rawBreakdown as { rules?: RuleRow[] } | null)?.rules ?? null)
  ?.map(r => ({ key: r.key ?? String(r.ruleId ?? ''), name: r.ruleName, points: r.pointsAwarded, awarded: r.matched }))
  ?? null
```

Any change to the scoring breakdown shape requires edits in 2 places.

**Plan**:
- Add to `src/models/Prediction.ts`:
  ```ts
  export type RuleRow = { key?: string; ruleId?: number; ruleName: string; pointsAwarded: number; matched: boolean };
  export type BreakdownItem = { key: string; name: string; points: number; awarded: boolean };
  export function serializeBreakdown(raw: unknown): BreakdownItem[] | null { ... }
  ```

- [ ] `src/models/Prediction.ts` — add `RuleRow`, `BreakdownItem` types + `serializeBreakdown` helper
- [ ] `src/app/api/mobile/predictions/route.ts` — replace inline type + mapper with `serializeBreakdown`
- [ ] `src/app/api/mobile/matches/[matchId]/route.ts` — replace inline type + mapper with `serializeBreakdown`

---

### ✅ Category 3 done when all boxes above are checked.

---

## Category 4 — Clean Code Improvements

### 4.1 — Type Prisma `where` clauses properly

**Problem**: Two service methods use `const where: any = {}` to build their Prisma filter objects, losing all type-safety on the where clause. A typo in a field name compiles silently.

- [ ] `src/lib/services/match-service.ts:60` — type as `Prisma.MatchWhereInput`
- [ ] `src/lib/services/prediction-service.ts:71` — type as `Prisma.MatchWhereInput`

---

### 4.2 — Typed `NotFoundError` class — replace string matching

**Problem**: `src/app/api/mobile/matches/[matchId]/route.ts:75` detects a not-found condition by checking `e.message?.includes('not found')`. This is fragile — if `correctMatchResult` ever changes its error message wording, the 404 branch silently falls through to 500.

**Plan**:
```ts
// src/lib/errors.ts
export class NotFoundError extends Error {
  constructor(message: string) { super(message); this.name = 'NotFoundError'; }
}
```

- [ ] Create `src/lib/errors.ts` — export `NotFoundError`
- [ ] `src/lib/results-processor.ts` — `throw new NotFoundError(...)` in `correctMatchResult` instead of generic `Error`
- [ ] `src/app/api/mobile/matches/[matchId]/route.ts` — `catch (e) { if (e instanceof NotFoundError) return ...404...; throw e; }`

---

### ✅ Category 4 done when all boxes above are checked.

---

## Category 5 — API Performance Wins

### 5.1 — Fix N+1 per-user prediction queries in cron reminder handlers

**Problem**: Both `daily-reminder` and `prediction-reminder` call `prisma.prediction.findMany` once **per user** inside the loop. For 20 users and 5 match IDs, this is 20 individual DB round-trips that could be 1.

**Before** (in both handlers):
```ts
for (const user of users) {
  const existingPredictions = await prisma.prediction.findMany({
    where: { userId: user.id, matchId: { in: matchIds } },
    select: { matchId: true },
  });
  const predictedMatchIds = new Set(existingPredictions.map(p => p.matchId));
  // ...
}
```

**After**:
```ts
// --- Before the loop ---
const userIds = users.map(u => u.id);
const allPredictions = await prisma.prediction.findMany({
  where: { userId: { in: userIds }, matchId: { in: matchIds } },
  select: { userId: true, matchId: true },
});
const predsByUser = new Map<number, Set<number>>();
for (const p of allPredictions) {
  if (!predsByUser.has(p.userId)) predsByUser.set(p.userId, new Set());
  predsByUser.get(p.userId)!.add(p.matchId);
}

// --- Inside the loop ---
for (const user of users) {
  const predictedMatchIds = predsByUser.get(user.id) ?? new Set();
  // rest unchanged
}
```

- [ ] `src/app/api/cron/daily-reminder/route.ts` — pre-fetch all predictions, group by `userId` in memory
- [ ] `src/app/api/cron/prediction-reminder/route.ts` — same fix

---

### 5.2 — Batch prediction scoring in `processMatchResults`

**Problem**: `src/lib/results-processor.ts` (lines 258–266) calls `prisma.prediction.update` individually in a `for` loop — one DB round-trip per prediction. `correctMatchResult` already batches with `prisma.$transaction(preds.map(...))` — the cron path should do the same.

> **⚠️ CONFIRM BEFORE CHANGE** — touches the scoring write path. Confirm the `$transaction` approach matches `correctMatchResult` semantics before applying.

- [ ] `src/lib/results-processor.ts` — replace per-prediction `update` loop with a single `prisma.$transaction(preds.map(...))` ⚠️ CONFIRM BEFORE CHANGE
- [ ] Verify `scored` counter is still incremented correctly after the change

---

### 5.3 — Batch `assignKnockoutLegs` writes

**Problem**: `src/lib/matches-processor.ts` line 25 calls `prisma.match.update` inside a `for` loop over all knockout matches. For a UCL fixture set (8 QF/SF matches), this is 8 sequential write round-trips.

**Fix**:
```ts
await prisma.$transaction(
  knockoutMatches.map(m => prisma.match.update({ where: { id: m.id }, data: { leg: ... } }))
);
```

- [ ] `src/lib/matches-processor.ts` `assignKnockoutLegs` — replace `for` loop with `prisma.$transaction`

---

### 5.4 — Pre-compute leaderboards in `correctMatchResult`

**Problem**: `src/lib/results-processor.ts:105` — `getUserGroupLeaderboards(pred.userId)` is called inside the correction email loop, one call per user. For a match with 10 predictions this is 10 leaderboard queries.

**Fix**: Collect all affected `userIds` first, call `getUserGroupLeaderboards` once per unique user before the loop, store results in a `Map<userId, leaderboards>`.

- [ ] `src/lib/results-processor.ts` `correctMatchResult` — pre-fetch leaderboards for all affected users before the email loop ⚠️ CONFIRM BEFORE CHANGE

---

### 5.5 — Add timeout on external football API calls

**Problem**: `fetchFixtures` in `src/lib/football/providers/football-data.ts` makes `fetch` calls with no timeout. A slow or hung football API response stalls the entire serverless cron function until Vercel's 60-second hard limit, burning execution time and potentially blocking subsequent invocations.

**Fix**: Pass `AbortSignal.timeout(15_000)` to the internal `fetch` call.

- [ ] `src/lib/football/providers/football-data.ts` — add `signal: AbortSignal.timeout(15_000)` to `fetch` options
- [ ] Verify existing `try/catch` blocks in `processMatchResults` and `fetchAndInsertMatches` handle `DOMException (AbortError)` gracefully (log + continue, don't re-throw as unhandled)

---

### ✅ Category 5 done when all boxes above are checked.

---

## Category 6 — Error Handling & Observability

### 6.1 — Isolate individual scoring failures

**Problem**: `src/lib/results-processor.ts` scoring loop (lines 258–266) — if one `prisma.prediction.update` throws, the remaining predictions for the match are silently skipped. The outer `try/catch` is at the league level; per-match prediction failures are not caught individually.

**Fix**: Wrap each prediction update in a try/catch; increment the `errors` counter; log and continue to the next prediction.

> **⚠️ CONFIRM BEFORE CHANGE** — touches the scoring write path.

- [ ] `src/lib/results-processor.ts` — wrap per-prediction update in try/catch; continue on failure ⚠️ CONFIRM BEFORE CHANGE

---

### 6.2 — Health check endpoint

**Problem**: No `/api/health` endpoint. Uptime monitors and deployment smoke-tests cannot probe the service without hitting a real data endpoint. The proxy matcher already excludes `/api/...` paths so no auth change needed.

- [ ] Create `src/app/api/health/route.ts`:
  ```ts
  export async function GET() {
    return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() });
  }
  ```
- [ ] Verify the path is reachable without authentication (check `src/proxy.ts` matcher)

---

### 6.3 — Structured logger wrapper

**Problem**: All log output uses plain `console.log/warn/error`. On Vercel, these appear as unstructured text with no searchable fields. Filtering by severity, prefix, or context requires string-grepping raw log lines.

**Plan**:
```ts
// src/lib/logger.ts
export const logger = {
  info:  (msg: string, ctx?: object) => console.log(JSON.stringify({ level: 'info',  msg, ts: new Date().toISOString(), ...ctx })),
  warn:  (msg: string, ctx?: object) => console.warn(JSON.stringify({ level: 'warn', msg, ts: new Date().toISOString(), ...ctx })),
  error: (msg: string, ctx?: object) => console.error(JSON.stringify({ level: 'error', msg, ts: new Date().toISOString(), ...ctx })),
};
```

**Files to update** (replace all `console.log/warn/error`):

- [ ] Create `src/lib/logger.ts`
- [ ] `src/lib/results-processor.ts` — replace `console.*` with `logger.*`
- [ ] `src/lib/matches-processor.ts` — replace `console.*` with `logger.*`
- [ ] `src/app/api/cron/fetch-matches/route.ts` — replace `console.*` with `logger.*`
- [ ] `src/app/api/cron/fetch-results/route.ts` — replace `console.*` with `logger.*`
- [ ] `src/app/api/cron/daily-reminder/route.ts` — replace `console.*` with `logger.*`
- [ ] `src/app/api/cron/prediction-reminder/route.ts` — replace `console.*` with `logger.*`

---

### ✅ Category 6 done when all boxes above are checked.

---

## Category 7 — Dependencies & Tooling

### 7.1 — ESLint rules for the API layer

**Problem**: No ESLint enforcement of backend-specific patterns — `any` usage, `console` calls, and missing async error handling go unchecked.

- [ ] Add `@typescript-eslint/no-explicit-any` at `error` level (targets `match-service.ts`, `prediction-service.ts` `where: any`)
- [ ] Add `no-console` rule at `warn` level (catches any new `console.*` added after the logger migration)
- [ ] Fix any new lint errors introduced

---

### ✅ Category 7 done when all boxes above are checked.

---

## Category 8 — Prisma Query Optimizations

> These are targeted query-level fixes: remove over-fetching, eliminate redundant round-trips, and cap unbounded queries. None change business logic — only `select` clauses, query structure, and safety limits.

---

### 8.1 — Add `select` to existence-check queries

**Problem**: Four queries load full records from the DB when only a subset of fields (or just existence) is actually used by the caller.

| File | Line | Current | Used by caller |
|---|---|---|---|
| `src/app/api/admin/users/route.ts` | 24 | `findUnique({ where: { email } })` — full User | `if (existing)` — existence only |
| `src/app/api/admin/users/route.ts` | 33 | `findFirst({ where: { isDefault: true } })` — full Group | `defaultGroup.id` only |
| `src/app/api/admin/groups/[id]/route.ts` | 48 | `findUnique({ where: { id: groupId } })` — full Group | existence + `group.isDefault` |
| `src/app/api/admin/groups/[id]/route.ts` | 81 | `findUnique({ where: { id: groupId } })` — full Group | existence + `group.isDefault` |

**Fix**:
```ts
// admin/users/route.ts:24
const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() }, select: { id: true } });

// admin/users/route.ts:33
const defaultGroup = await prisma.group.findFirst({ where: { isDefault: true }, select: { id: true } });

// admin/groups/[id]/route.ts:48 and :81
const group = await prisma.group.findUnique({ where: { id: groupId }, select: { id: true, isDefault: true } });
```

- [ ] `src/app/api/admin/users/route.ts:24` — add `select: { id: true }` 🔒 ADMIN ROUTE
- [ ] `src/app/api/admin/users/route.ts:33` — add `select: { id: true }` 🔒 ADMIN ROUTE
- [ ] `src/app/api/admin/groups/[id]/route.ts:48` — add `select: { id: true, isDefault: true }` 🔒 ADMIN ROUTE
- [ ] `src/app/api/admin/groups/[id]/route.ts:81` — add `select: { id: true, isDefault: true }` 🔒 ADMIN ROUTE

---

### 8.2 — Add `select` to prediction queries in `match-service.ts`

**Problem**: Two prediction fetches in `match-service.ts` load the full `Prediction` row (all columns, including the potentially large `scoringBreakdown` JSON) when the caller only reads a small subset.

| Location | Current | Fields actually used |
|---|---|---|
| `src/lib/services/match-service.ts:86` (`getMatches`) | `findMany` — full Prediction | `p.matchId` only (to build the predMap key) |
| `src/lib/services/match-service.ts:124` (`getMatchById`) | `findFirst` — full Prediction | `homeScore`, `awayScore`, `predictedWinner`, `pointsAwarded` |

**Fix**:
```ts
// getMatches — line 86
const predictions = await prisma.prediction.findMany({
  where: { userId: opts.userId, matchId: { in: matchIds } },
  select: { matchId: true, homeScore: true, awayScore: true, predictedWinner: true, pointsAwarded: true },
});

// getMatchById — line 124
prisma.prediction.findFirst({
  where: { userId: opts.userId, matchId: match.id },
  select: { homeScore: true, awayScore: true, predictedWinner: true, pointsAwarded: true },
})
```

> Note: `getMatches` stores the full prediction in `predMap` (line 84) but then only reads `homeScore`, `awayScore`, `predictedWinner`, `pointsAwarded` at line 104. The `select` should include those four fields — not just `matchId`.

- [ ] `src/lib/services/match-service.ts:86` — add `select` with only the 5 fields consumed by the map at line 104
- [ ] `src/lib/services/match-service.ts:124` — add `select: { homeScore, awayScore, predictedWinner, pointsAwarded }`

---

### 8.3 — Add `select` to match fetch in `upsertPrediction`

**Problem**: `prediction-service.ts:35` loads the full `Match` row to perform two checks: existence (`if (!match)`) and `match.kickoffTime` (for the lock guard). The remaining 20+ match columns are unused.

**Fix**:
```ts
const match = await prisma.match.findUnique({
  where: { id: matchId },
  select: { id: true, kickoffTime: true },
});
```

- [ ] `src/lib/services/prediction-service.ts:35` — add `select: { id: true, kickoffTime: true }`

---

### 8.4 — Eliminate redundant prediction re-fetch in `correctMatchResult`

**Problem**: `src/lib/results-processor.ts` fetches all predictions for a match twice:
- **Line 66-69**: fetch to score them (includes user data needed for emails)
- **Line 91-95**: fetch again after the `$transaction` to get updated `pointsAwarded` / `scoringBreakdown`

The second fetch is a full DB round-trip that can be eliminated by reconstructing updated values in memory — the scoring transaction map already computes `totalPoints` and `breakdown` per prediction.

**Fix** — lift the score computation out of the transaction map, store results, then merge onto the original `preds` array:
```ts
const scoredPreds = preds.map(pred => {
  const { totalPoints, breakdown } = calculateScore(...);
  return { pred, totalPoints, breakdown };
});

await prisma.$transaction(
  scoredPreds.map(({ pred, totalPoints, breakdown }) =>
    prisma.prediction.update({
      where: { id: pred.id },
      data: { pointsAwarded: totalPoints, scoringBreakdown: { rules: breakdown } },
    })
  )
);

// Use scoredPreds directly — no second findMany needed
const updated = scoredPreds
  .map(({ pred, totalPoints, breakdown }) => ({ ...pred, pointsAwarded: totalPoints, scoringBreakdown: { rules: breakdown } }))
  .sort((a, b) => (b.pointsAwarded ?? 0) - (a.pointsAwarded ?? 0));
```

> **⚠️ CONFIRM BEFORE CHANGE** — touches the correction email path. Verify the in-memory `updated` array produces identical serialized output to the current re-fetched array before removing the second query.

- [ ] `src/lib/results-processor.ts` — lift score computation out of `$transaction` map; eliminate second `findMany` at line 91 ⚠️ CONFIRM BEFORE CHANGE
- [ ] Verify correction emails receive identical `pointsAwarded` / `scoringBreakdown` values after the change

---

### 8.5 — Cap unbounded `pendingMatches` query in `processMatchResults`

**Problem**: `src/lib/results-processor.ts:153` fetches all past unfinished matches with no `take` limit:
```ts
const pendingMatches = await prisma.match.findMany({
  where: { kickoffTime: { lt: now }, status: { notIn: ['finished', 'cancelled'] } },
  include: { league: { select: { name: true } } },
});
```
If the cron job fails to run for several days (e.g., deployment downtime), the backlog could be dozens of matches. Adding a bounded batch and processing oldest-first prevents the single invocation from timing out on Vercel's 60-second limit.

**Fix**:
```ts
const pendingMatches = await prisma.match.findMany({
  where: { kickoffTime: { lt: now }, status: { notIn: ['finished', 'cancelled'] } },
  include: { league: { select: { name: true } } },
  orderBy: { kickoffTime: 'asc' },
  take: 30,
});
```
> A batch of 30 is enough for a 2-week backlog of UCL/EPL combined. The cron runs daily so the next invocation drains the remainder.

- [ ] `src/lib/results-processor.ts:153` — add `orderBy: { kickoffTime: 'asc' }` + `take: 30` to `pendingMatches` query

---

### 8.6 — Add `select` to nested prediction include in `admin/results/route.ts`

**Problem**: `src/app/api/admin/results/route.ts:14-18` loads all columns on each `Prediction` row (including the full `scoringBreakdown` JSON blob) via a nested include. The serializer at line 32-41 only reads: `id`, `userId`, `homeScore`, `awayScore`, `pointsAwarded`, `scoringBreakdown`. Fetching `createdAt`, `updatedAt`, `matchId`, `predictedWinner`, etc., is wasted I/O across up to 100 matches × N predictions.

**Fix**:
```ts
include: {
  predictions: {
    select: {
      id: true,
      userId: true,
      homeScore: true,
      awayScore: true,
      pointsAwarded: true,
      scoringBreakdown: true,
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { pointsAwarded: 'desc' },
  },
},
```

- [ ] `src/app/api/admin/results/route.ts:14` — replace `include: { user: ... }` with `select` listing only the 6 serialized fields + user 🔒 ADMIN ROUTE

---

### ✅ Category 8 done when all boxes above are checked.

---

# PHASE 4 — FINAL REPORT

> Fill in after all Phase 3 categories are complete.

## What Was Changed

- [ ] Total API files modified: ___
- [ ] New files created (`lib/`, `models/`): ___
- [ ] Summary by category (fill in post-execution)

## Impact Assessment

- [ ] Security vulnerabilities closed: ___
- [ ] DB queries eliminated by N+1 fixes (estimated per cron run): ___
- [ ] Lines of code removed by DRY refactors: ___
- [ ] Cron execution time improvement (from batch writes): ___

## Remaining Technical Debt

| Issue | Reason deferred |
|---|---|
| No API versioning (`/v1/`) | All clients are internal; versioning adds overhead without benefit at current scale |
| Inconsistent response envelopes across endpoints | Large surface area change; requires mobile + web client updates simultaneously |
| `leaderboard-service.ts` raw SQL | Query is parameterized, correct, and fast enough for current scale; revisit if user count > 200 |
| No request-size limit middleware | Low risk for private authenticated API; add if route is ever made public |
| `getUserPredictions` / `getMatches` hardcoded `take: 100` | Cursor-based pagination is a larger feature; acceptable for current user base |

## Patterns to Document in `CONTRIBUTING.md`

- All cron route handlers must call `verifyCronRequest(req)` from `src/lib/cron-auth.ts` as the **first line** of the handler
- Route handlers do exactly three things: parse request → call service → serialize response. No Prisma in route handlers.
- All `req.json()` calls must go through `safeParseBody` from `src/lib/request.ts`
- Scoring breakdown serialization uses `serializeBreakdown` from `src/models/Prediction.ts`
- Never call `getUserGroupLeaderboards` or `sendResultNotifications` inside a prediction loop — pre-fetch before the loop

## Recommended Tooling

- `autocannon` — HTTP load testing for API endpoints before releases
- `clinic.js` — Node.js CPU/memory profiling if self-hosting ever replaces Vercel
- Vercel Log Drain → Datadog / Axiom — structured log aggregation once `logger.ts` is in place

---

*See [`REFACTORING_PLAN.md`](./REFACTORING_PLAN.md) for all React Native mobile refactoring tasks.*

*Document maintained alongside the codebase. Update checkbox status as each task is merged.*
