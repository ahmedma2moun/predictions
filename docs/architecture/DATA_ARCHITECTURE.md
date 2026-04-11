# Data Architecture

## Data Store

PostgreSQL — single database accessed exclusively via Prisma 6.19.3.
Schema source of truth: `prisma/schema.prisma`.

```
PostgreSQL database
├── User            — auth + profile + notification preference
├── League          — football competitions (admin-managed)
├── Team            — teams per league (admin-managed)
├── Match           — fixtures (fetched from API, inserted by externalId)
├── Prediction      — user predictions (unique: userId+matchId)
├── ScoringRule     — configurable scoring rules
├── Group           — user groups for sub-leaderboards
├── GroupMember     — many-to-many User ↔ Group
├── TeamStanding    — cached league standings from football-data.org
└── ResultCheckSlot — QStash job tracker, one row per unique kickoff time
```

## Schema Reference

### `User`
| Field | Type | Constraint | Notes |
|---|---|---|---|
| id | Int | PK autoincrement | `.toString()` before sending to frontend |
| name | String | | display name |
| email | String | unique | login credential |
| password | String | | bcrypt hash, cost 12 |
| role | Role enum | default 'user' | 'admin' \| 'user' |
| avatarUrl | String? | | optional profile photo URL |
| notificationEmail | String? | | email address for notifications (may differ from login email) |
| createdAt / updatedAt | DateTime | | auto-managed |

### `League`
| Field | Type | Constraint | Notes |
|---|---|---|---|
| id | Int | PK autoincrement | |
| externalId | Int | unique | football-data.org competition ID |
| name | String | | e.g. "Premier League" |
| country | String | | |
| logo | String? | | emblem URL from API |
| season | Int | | e.g. 2025 |
| isActive | Boolean | default false | admin toggles inclusion |

### `Team`
| Field | Type | Constraint | Notes |
|---|---|---|---|
| id | Int | PK autoincrement | |
| externalId | Int | unique | football-data.org team ID |
| name | String | | |
| logo | String? | | crest URL |
| leagueId | Int | FK → League (cascade delete) | |
| externalLeagueId | Int | | denormalized for query perf |
| isActive | Boolean | default true | admin toggles |

### `Match`
| Field | Type | Constraint | Notes |
|---|---|---|---|
| id | Int | PK autoincrement | |
| externalId | Int | **unique** | API fixture ID — prevents duplicates |
| leagueId | Int? | FK → League (set null on delete) | |
| externalLeagueId | Int | | denormalized |
| homeTeamExtId | Int | | |
| homeTeamName | String | | flat (not embedded object) |
| homeTeamLogo | String? | | |
| awayTeamExtId | Int | | |
| awayTeamName | String | | flat |
| awayTeamLogo | String? | | |
| kickoffTime | DateTime | | UTC |
| status | MatchStatus enum | default 'scheduled' | scheduled/live/finished/postponed/cancelled |
| matchday | Int? | | competition matchday |
| stage | String? | | e.g. "GROUP_STAGE", "QUARTER_FINALS" |
| leg | Int? | | leg number for two-legged ties |
| venue | String? | | stadium name |
| resultHomeScore | Int? | | set when finished |
| resultAwayScore | Int? | | set when finished |
| resultWinner | Winner? | | home/away/draw |
| scoresProcessed | Boolean | default false | true after predictions scored |
| weekStart | DateTime | | Thursday UTC of fetch week |

### `Prediction`
| Field | Type | Constraint | Notes |
|---|---|---|---|
| id | Int | PK autoincrement | |
| userId | Int | FK → User (cascade delete) | |
| matchId | Int | FK → Match (cascade delete) | |
| homeScore | Int | ≥ 0 | |
| awayScore | Int | ≥ 0 | |
| predictedWinner | Winner enum | | computed from scores at save time |
| pointsAwarded | Int | default 0 | updated after result scored |
| scoringBreakdown | Json? | | `{rules: [{ruleId, ruleName, pointsAwarded, matched}]}` |
| | | **@@unique([userId, matchId])** | prevents duplicate predictions |

### `ScoringRule`
| Field | Type | Constraint | Notes |
|---|---|---|---|
| id | Int | PK autoincrement | |
| key | String | unique | correct_winner / exact_score / score_difference / one_team_score |
| name | String | | display name |
| description | String | | |
| points | Int | | configurable by admin |
| priority | Int | | evaluation order (lower = first) |
| isActive | Boolean | default true | admin can disable rules |

### `Group`
| Field | Type | Notes |
|---|---|---|
| id | Int | PK autoincrement |
| name | String | e.g. "General", "Work Friends" |
| isDefault | Boolean | default false — used for leaderboard default view |

### `GroupMember`
| Field | Type | Constraint | Notes |
|---|---|---|---|
| id | Int | PK autoincrement | |
| groupId | Int | FK → Group (cascade delete) | |
| userId | Int | FK → User (cascade delete) | |
| | | **@@unique([groupId, userId])** | prevents duplicate membership |

### `ResultCheckSlot`
| Field | Type | Constraint | Notes |
|---|---|---|---|
| id | String | PK cuid | |
| kickoffTime | DateTime | **unique** | Groups all matches sharing this start time |
| qstashJobId | String? | | Current pending QStash message ID — nulled when done |
| scheduledAt | DateTime | | When the next QStash job is set to fire |
| status | String | default 'pending' | pending / done / abandoned |
| createdAt / updatedAt | DateTime | | auto-managed |
| | | **@@index([status, scheduledAt])** | used by instrumentation recovery query |

**Status lifecycle**: `pending` → `done` (all matches finished) or `abandoned` (6h cap reached without all matches finishing). A slot in `done` state is never rescheduled. On deployment, `instrumentation.ts` re-schedules all `pending` slots whose matches are still unfinished.

### `TeamStanding`
| Field | Type | Constraint | Notes |
|---|---|---|---|
| id | Int | PK autoincrement | |
| externalTeamId | Int | | football-data.org team ID |
| externalLeagueId | Int | | football-data.org competition ID |
| season | Int | | |
| position | Int | | league table position |
| played | Int | | |
| won / drawn / lost | Int | | |
| points | Int | | |
| goalsFor / goalsAgainst / goalDifference | Int | | |
| form | String? | | e.g. "WDWLW" |
| updatedAt | DateTime | auto | used for 2-hour cache TTL check |
| | | **@@unique([externalTeamId, externalLeagueId])** | |

## Default Scoring Rules

| key | points | priority | Logic |
|---|---|---|---|
| correct_winner | 2 | 1 | Predicted winner matches actual (independent) |
| exact_score | 5 | 2 | Both scores match exactly (tiered) |
| score_difference | 3 | 3 | Goal diff matches (tiered) |
| one_team_score | 1 | 4 | Either home or away score matches (tiered) |

## Key Access Patterns

```typescript
// Prisma singleton — always import from @/lib/prisma
import { prisma } from '@/lib/prisma';

// Upcoming matches with user's predictions
const matches = await prisma.match.findMany({
  where: { status: { in: ['scheduled', 'live'] } },
  orderBy: { kickoffTime: 'asc' },
  include: { predictions: { where: { userId } } },
});

// Leaderboard aggregation (raw SQL for performance)
const rows = await prisma.$queryRaw`
  SELECT u.id, u.name, SUM(p."pointsAwarded") AS total
  FROM "Prediction" p
  JOIN "User" u ON u.id = p."userId"
  JOIN "Match" m ON m.id = p."matchId"
  WHERE m.status = 'finished'
  GROUP BY u.id, u.name
  ORDER BY total DESC
`;
// Note: $queryRaw returns BigInt — always wrap with Number() before JSON

// Idempotent match insert (check first, then createMany)
const existing = await prisma.match.findMany({
  where: { externalId: { in: externalIds } },
  select: { externalId: true },
});
const existingSet = new Set(existing.map(m => m.externalId));
const newFixtures = fixtures.filter(f => !existingSet.has(f.fixture.id));
if (newFixtures.length) {
  await prisma.match.createMany({ data: newFixtures.map(toMatchData) });
}

// Upsert prediction (unique: userId+matchId)
await prisma.prediction.upsert({
  where: { userId_matchId: { userId, matchId } },
  update: { homeScore, awayScore, predictedWinner },
  create: { userId, matchId, homeScore, awayScore, predictedWinner },
});

// TeamStanding cache (2-hour TTL, see src/lib/standings.ts)
const standingsMap = await getStandingsMap(leagues);
const standing = standingsMap.get(standingKey(teamExtId, leagueExtId));
```

## Connection Pattern

`src/lib/prisma.ts` uses a module-level global to reuse the PrismaClient across serverless function invocations:

```typescript
const globalForPrisma = global as unknown as { prisma: PrismaClient };
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

`src/lib/db.ts` is a **no-op shim** left from the Mongoose migration. `connectDB()` does nothing. Never import from it.

## Integer ID Serialization Rule

All Prisma integer `id` fields **must be `.toString()`-ed** before returning to the frontend. The `serializeMatch()` function in `src/models/Match.ts` handles this for match objects. Admin and API routes must do it manually for other models.

`$queryRaw` returns `BigInt` values — always wrap with `Number()` before JSON serialization, or JSON.stringify will throw.
