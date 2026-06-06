# Plan: Odds Multiplier System

## Context

Adding a prediction-odds multiplier to the scoring engine. When more users predict a "popular" outcome (e.g., home win), predicting it correctly yields fewer points; predicting a "surprising" outcome (e.g., away win) that turns out correct is rewarded with a higher multiplier. Odds are locked at scoring time (vote counts are frozen at kickoff by the existing `isMatchLocked()` guard), and all stored odds values are immutable snapshots.

Odds are **opt-in per season** — each `Season` carries `oddsEnabled`, `oddsMin`, and `oddsMax`. When disabled, the multiplier is 1.0 and `finalScore = baseScore`. Final score is always a **rounded integer**, consistent with `pointsAwarded`.

> **Cross-layer rule (from CLAUDE.md):** every change is applied to BOTH web (`src/app/`) and mobile (`mobile/`). Each step below lists web and mobile sub-tasks explicitly.

---

## Discovery Summary

| Question | Answer |
|---|---|
| Scoring logic | `src/lib/scoring-engine.ts` — `calculateScore()` with DB-configurable `ScoringRule[]` |
| Scoring triggered | `batchScorePredictions()` in `src/lib/results-processor.ts` — called by cron (`fetch-results`) and admin (`/calculate`) |
| Points field | `pointsAwarded: Int` stored on `Prediction`; leaderboard does `SUM(p."pointsAwarded")` |
| Prediction model | `homeScore`, `awayScore`, `predictedWinner`, `pointsAwarded`, `scoringBreakdown (Json?)` |
| Match model | `resultHomeScore`, `resultAwayScore`, `resultWinner`, `scoresProcessed` |
| Round/gameweek | None — grouped by `matchday: Int?` on `Match` |
| Mobile predictions screen | `mobile/app/(tabs)/predictions.tsx` → `PredictionCard` in `mobile/src/components/PredictionCard.tsx` |
| Mobile match detail | `mobile/app/matches/[matchId].tsx` |
| Mobile API types | `mobile/src/types/api.ts` |

**Scoring formula unchanged**: `calculateScore()` is kept exactly as-is. Its `totalPoints` output is `baseScore`; odds multiply on top.

**Leaderboard unchanged**: `pointsAwarded = finalScore` (rounded integer), so `SUM(pointsAwarded)` still works with zero SQL changes.

---

## Step 1 — Prisma Schema Changes

File: `prisma/schema.prisma`

### Add to `Prediction` model
```prisma
outcomeOdds  Decimal  @default(1.0) @db.Decimal(4, 2)
baseScore    Int      @default(0)
finalScore   Int      @default(0)   // rounded integer, equals pointsAwarded
```

### Add to `Season` model
```prisma
oddsEnabled  Boolean  @default(false)
oddsMin      Decimal  @default(1.1)  @db.Decimal(4, 2)
oddsMax      Decimal  @default(5.0)  @db.Decimal(4, 2)
```

### New `MatchOdds` model
```prisma
model MatchOdds {
  id             Int      @id @default(autoincrement())
  matchId        Int      @unique
  match          Match    @relation(fields: [matchId], references: [id], onDelete: Cascade)
  homeWinVotes   Int      @default(0)
  drawVotes      Int      @default(0)
  awayWinVotes   Int      @default(0)
  homeWinOdds    Decimal  @default(1.10) @db.Decimal(4, 2)
  drawOdds       Decimal  @default(3.05) @db.Decimal(4, 2)
  awayWinOdds    Decimal  @default(5.00) @db.Decimal(4, 2)
  lockedAt       DateTime?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}
```

### Add relation on `Match`
```prisma
matchOdds  MatchOdds?
```

Run: `npx prisma migrate dev --name add_odds_system`

---

## Step 2 — `src/lib/odds.ts` (new file)

Shared backend logic — used by both web and mobile API routes via `results-processor.ts`.

### Constants & types
```typescript
export const ODDS_MIN_DEFAULT = 1.1;
export const ODDS_MAX_DEFAULT = 5.0;

export type Outcome = 'homeWin' | 'draw' | 'awayWin';
export interface PredictionPool { homeWin: number; draw: number; awayWin: number; }
export interface MatchOddsResult { homeWin: number; draw: number; awayWin: number; }
export interface OddsConfig { oddsEnabled: boolean; oddsMin: number; oddsMax: number; }
```

### `calcMatchOdds(pool, config: OddsConfig): MatchOddsResult`
- If `oddsEnabled = false` → returns `{ homeWin: 1.0, draw: 1.0, awayWin: 1.0 }`
- `raw[o] = total / votes[o]`; zero votes → `total` (maps to `oddsMax`)
- All equal → midpoint `(oddsMin + oddsMax) / 2`
- Normalize to `[oddsMin, oddsMax]`, round to 2 dp

### `calcFinalScore(baseScore: number, odds: number): number`
```typescript
if (baseScore === 0) return 0;
return Math.round(baseScore * odds);
```

### `lockMatchOdds(matchId: number, config: OddsConfig): Promise<MatchOddsResult>`
1. If `MatchOdds` row exists with `lockedAt != null` → return it (idempotent)
2. Count predictions by outcome
3. `calcMatchOdds(pool, config)`
4. Upsert `MatchOdds` with vote counts, odds, `lockedAt = new Date()`
5. Return the locked odds

---

## Step 3 — Update Scoring Engine (shared — affects both web and mobile)

File: `src/lib/results-processor.ts`

### `batchScorePredictions()` — extend in place (keep signature)

```typescript
// Current signature preserved:
export async function batchScorePredictions(matchId, preds, result, rules, logPrefix)
```

Before the per-prediction loop:
1. Load `match.season` → `OddsConfig`
2. Call `lockMatchOdds(matchId, config)` → locked odds snapshot

Per prediction:
1. `calculateScore(pred, result, rules)` → `{ totalPoints, breakdown }` (unchanged)
2. `baseScore = totalPoints`
3. `predictedOutcome = deriveOutcome(pred.homeScore, pred.awayScore)`
4. `odd = lockedOdds[predictedOutcome]`
5. `finalScore = calcFinalScore(baseScore, odd)`
6. `pointsAwarded = finalScore`
7. Save `pointsAwarded`, `baseScore`, `outcomeOdds`, `finalScore`
8. `scoringBreakdown`:
   ```json
   {
     "rules": [...existing unchanged...],
     "odds": { "outcomeOdds": 5.0, "baseScore": 7, "finalScore": 35 }
   }
   ```

Fallback: if `lockMatchOdds` throws, log warning, use `odds = 1.0`.

### `correctMatchResult()` — extend similarly
- Load `match.season` for `OddsConfig`
- `lockMatchOdds()` returns existing locked odds (match already finished)
- Same `calculateScore()` → `calcFinalScore()` flow + updated breakdown format

### Admin calculate route — `src/app/api/admin/results/[matchId]/calculate/route.ts`
- Keep `calculateScore()` call; add odds multiplication after it
- Fetch `match.season` in the initial match query
- Save same new fields (`baseScore`, `outcomeOdds`, `finalScore`)

> This step has no mobile-specific code — `results-processor.ts` is shared backend logic called by both the web cron/admin routes and the mobile admin PATCH endpoint.

---

## Step 4 — API Layer (web + mobile)

### Web: `src/app/api/matches/[matchId]/route.ts`

Update `getMatchById()` in `src/lib/services/match-service.ts` to include `matchOdds`. Add to the GET response:
```typescript
odds: {
  homeWin: number;
  draw: number;
  awayWin: number;
  locked: boolean;
}
```
- `lockedAt` set → return locked values + `locked: true`
- Not locked → compute live via `calcMatchOdds()` + `locked: false`

### Mobile: `src/app/api/mobile/matches/[matchId]/route.ts`

Add the identical `odds` field to the GET response (same logic, same shape).

### Mobile: `src/app/api/mobile/predictions/route.ts`

The GET endpoint that returns `PredictionHistoryItem[]` must include `outcomeOdds`, `baseScore`, and the match's locked odds in each item so `PredictionCard` can display them without a second request.

---

## Step 5 — Scores Page UI (web + mobile)

### Web: `src/app/(app)/predictions/page.tsx`
- Add `matchOdds: { select: { homeWinOdds, drawOdds, awayWinOdds, lockedAt } }` to the match include
- Select `outcomeOdds` and `baseScore` from the `Prediction` record
- Map them into `SerializedPrediction`

### Web: `src/app/(app)/predictions/PredictionTabs.tsx`

**Type update** — `SerializedPrediction`:
```typescript
baseScore: number;
outcomeOdds: number;
matchId: {
  ...existing...;
  odds?: { homeWin: number; draw: number; awayWin: number } | null;
}
```

**`ScoreTile` UI** — under the PICK/FINAL line, add:
```tsx
{isFinished && match.odds && (
  <div className="flex items-center gap-2 text-[10.5px] text-muted-foreground mt-0.5">
    <span className={cn("font-mono-nums", predictedOutcome === 'homeWin' && "text-foreground font-bold")}>
      H {match.odds.homeWin}
    </span>
    <span className={cn("font-mono-nums", predictedOutcome === 'draw' && "text-foreground font-bold")}>
      D {match.odds.draw}
    </span>
    <span className={cn("font-mono-nums", predictedOutcome === 'awayWin' && "text-foreground font-bold")}>
      A {match.odds.awayWin}
    </span>
  </div>
)}
```

In the points chip, add a small multiplier label under the points number:
```tsx
{pred.outcomeOdds !== 1 && pts > 0 && (
  <span className="text-[8px] text-muted-foreground">×{pred.outcomeOdds}</span>
)}
```

---

### Mobile: `mobile/src/types/api.ts`

Add to `PredictionHistoryItem`:
```typescript
baseScore: number;
outcomeOdds: number;
match: {
  ...existing...;
  odds?: { homeWin: number; draw: number; awayWin: number } | null;
}
```

### Mobile: `mobile/src/components/PredictionCard.tsx`

**Odds row** — after the `picksRow` (PICK / FINAL), add a `View` showing `H x.xx  D x.xx  A x.xx` with the predicted outcome bolded/highlighted, same logic as web.

**Points chip** — beneath the `ptsValue` Text, add a small `×x.xx` Text when `pred.outcomeOdds !== 1` and `pts > 0`.

---

## Step 6 — Docs Update

Per CLAUDE.md rules, update after implementation:
- `docs/architecture/DATA_ARCHITECTURE.md` — new `MatchOdds` table, new `Prediction` fields, new `Season` fields
- `docs/architecture/SYSTEM_ARCHITECTURE.md` — scoring engine section, new `src/lib/odds.ts`
- `docs/architecture/API_SPECIFICATIONS.md` — updated match detail response shape (`odds` field), updated predictions list response

---

## Verification

**Pool**: `{ homeWin: 5, draw: 2, awayWin: 3 }`, **Actual**: 0-0 (draw), **Season**: `oddsEnabled = true`, `oddsMin = 1.1`, `oddsMax = 5.0`

1. `calcMatchOdds`: norm_home = **1.10**, norm_draw = **5.00**, norm_away ≈ **2.83**
2. Karim (0-0): `calculateScore` → 7 pts base × 5.00 → **35** ✓
3. Sara (1-1): `calculateScore` → 4 pts base × 5.00 → **20** ✓
4. Youssef (1-0): wrong outcome → **0** ✓

**Breakdown JSON** for Karim:
```json
{
  "rules": [
    { "key": "correct_winner",   "matched": true,  "pointsAwarded": 3 },
    { "key": "exact_score",      "matched": true,  "pointsAwarded": 4 },
    { "key": "score_difference", "matched": false, "pointsAwarded": 0 },
    { "key": "one_team_score",   "matched": false, "pointsAwarded": 0 }
  ],
  "odds": { "outcomeOdds": 5.0, "baseScore": 7, "finalScore": 35 }
}
```

**Web UI check**: `GET /predictions` → each finished ScoreTile shows odds row `H 1.10  D 5.00  A 2.83` with draw bolded, chip shows `+35` with `×5.0` below.

**Mobile UI check**: Same card in `PredictionCard` shows odds row and multiplier label identically.

**API check**: `GET /api/matches/[id]` and `GET /api/mobile/matches/[id]` both return `odds: { homeWin, draw, awayWin, locked }`.
