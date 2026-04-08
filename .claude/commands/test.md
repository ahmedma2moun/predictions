---
description: "Testing guidance for the football predictions app"
---
# Testing

This project currently has no automated tests. When adding tests:

## Recommended setup
- **Unit tests**: Vitest — compatible with Next.js + TypeScript, fast, no extra config
- **Integration tests**: Separate test PostgreSQL DB (e.g., local Docker or a second Supabase project)
- **E2E**: Playwright

## Install Vitest
```bash
npm install -D vitest @vitest/ui
```

Add to `package.json`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

## Highest-priority functions to test first
These are pure functions with no external deps — ideal for unit tests:

| Function | File | Why it's critical |
|---|---|---|
| `calculateScore()` | `src/lib/scoring-engine.ts` | Tiered + independent rules; points are the core product |
| `isMatchLocked()` | `src/lib/utils.ts` | Prediction gate — wrong behavior means accepting late bets |
| `getWinner()` | `src/lib/utils.ts` | Used when storing `predictedWinner` and `resultWinner` |
| `mapFixtureStatus()` | `src/lib/football-api.ts` | Controls match lifecycle; wrong mapping = wrong state |
| `serializeMatch()` | `src/models/Match.ts` | Shapes all match data sent to frontend |

## Key test cases for `calculateScore()`
- Exact score → 5 pts + 2 pts (winner) = 7 pts max
- Score difference only → 3 pts + 2 pts (if winner correct)
- One team score only → 1 pt + 2 pts (if winner correct)
- No match → 0 pts
- Tiered rules: exact_score takes precedence over score_difference (never both)

## Test data reference
See `scripts/seed.ts` for minimal valid data shapes.
Dev admin: `admin@predictions.app` / `changeme123`
