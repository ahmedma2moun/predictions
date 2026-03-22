# Data Architecture

## Data Store Landscape

```
MongoDB Atlas (single cluster)
├── users           — auth + profile
├── leagues         — football leagues (admin-managed)
├── teams           — teams per league (admin-managed)
├── matches         — fixtures (fetched from API, upserted by externalId)
├── predictions     — user predictions (compound unique: userId+matchId)
└── scoringRules    — configurable scoring rules
```

## Schema Reference

### `users`
| Field | Type | Index | Notes |
|---|---|---|---|
| _id | ObjectId | PK | |
| name | String | | display name |
| email | String | unique | lowercase, used for login |
| password | String | | bcrypt hash, cost 12 |
| role | enum | | 'admin' \| 'user' (default 'user') |
| avatarUrl | String? | | optional profile photo |
| createdAt / updatedAt | Date | | timestamps |

### `leagues`
| Field | Type | Index | Notes |
|---|---|---|---|
| _id | ObjectId | PK | |
| externalId | Number | unique | API-Football league ID |
| name | String | | e.g. "Premier League" |
| country | String | | |
| logo | String? | | URL from API |
| season | Number | | e.g. 2025 |
| isActive | Boolean | | admin toggles inclusion |

### `teams`
| Field | Type | Index | Notes |
|---|---|---|---|
| _id | ObjectId | PK | |
| externalId | Number | unique | API-Football team ID |
| name | String | | |
| logo | String? | | |
| leagueId | ObjectId | ref:leagues | |
| externalLeagueId | Number | | denormalized for query perf |
| isActive | Boolean | | admin toggles |

### `matches`
| Field | Type | Index | Notes |
|---|---|---|---|
| _id | ObjectId | PK | |
| externalId | Number | **unique** | API fixture ID — prevents duplicates |
| leagueId | ObjectId | ref:leagues | |
| externalLeagueId | Number | | denormalized |
| homeTeam | embedded | | {externalId, name, logo?} |
| awayTeam | embedded | | {externalId, name, logo?} |
| kickoffTime | Date | | UTC |
| status | enum | | scheduled/live/finished/postponed/cancelled |
| result | embedded? | | {homeScore, awayScore, winner} — set when finished |
| scoresProcessed | Boolean | | true after predictions scored |
| weekStart | Date | | Friday UTC of fetch week |

### `predictions`
| Field | Type | Index | Notes |
|---|---|---|---|
| _id | ObjectId | PK | |
| userId | ObjectId | compound unique | ref:users |
| matchId | ObjectId | compound unique | ref:matches |
| homeScore | Number | | ≥ 0 |
| awayScore | Number | | ≥ 0 |
| predictedWinner | enum | | home/away/draw (computed from scores) |
| pointsAwarded | Number | | default 0, updated after result |
| scoringBreakdown | embedded | | {rules: [{ruleId, ruleName, pointsAwarded, matched}]} |

**Critical**: compound unique index `{ userId: 1, matchId: 1 }` prevents duplicate predictions.

### `scoringRules`
| Field | Type | Notes |
|---|---|---|
| key | String (unique) | correct_winner / exact_score / score_difference / one_team_score |
| name | String | Display name |
| description | String | |
| points | Number | Configurable by admin |
| priority | Number | Evaluation order (lower = first) |
| isActive | Boolean | Admin can disable rules |

## Default Scoring Rules

| key | points | priority | Logic |
|---|---|---|---|
| correct_winner | 2 | 1 | Predicted winner matches actual (independent) |
| exact_score | 5 | 2 | Both scores match exactly (tiered) |
| score_difference | 3 | 3 | Goal diff matches (tiered) |
| one_team_score | 1 | 4 | Either home or away score matches (tiered) |

## Key Query Patterns

```typescript
// Get upcoming matches with user's predictions
const matches = await Match.find({ status: { $in: ['scheduled', 'live'] } })
  .sort({ kickoffTime: 1 })
  .limit(100)
  .lean();
const preds = await Prediction.find({ userId, matchId: { $in: matchIds } }).lean();

// Leaderboard aggregation
await Prediction.aggregate([
  { $match: { matchId: { $in: finishedMatchIds } } },
  { $group: { _id: '$userId', totalPoints: { $sum: '$pointsAwarded' } } },
  { $sort: { totalPoints: -1 } }
]);

// Upsert match (idempotent)
await Match.bulkWrite(fixtures.map(f => ({
  updateOne: {
    filter: { externalId: f.fixture.id },
    update: { $setOnInsert: { ...matchFields } },
    upsert: true
  }
})));
```

## Connection Pattern

`src/lib/db.ts` uses a module-level global cache to reuse MongoDB connections across serverless function invocations:

```typescript
const cached = global.mongoose ?? { conn: null, promise: null };
global.mongoose = cached;
// Reuses existing connection or creates one — never opens multiple connections
```
