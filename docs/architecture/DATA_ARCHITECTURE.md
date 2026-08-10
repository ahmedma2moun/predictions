# Data Architecture

## Data Store

PostgreSQL — single database accessed exclusively via Prisma 6.19.3.
Schema source of truth: `prisma/schema.prisma`.

```
PostgreSQL database
├── User            — auth + profile + notification preference + streaks
├── UserBadge       — gamification badges awarded to users
├── League          — football competitions (admin-managed)
├── Team            — teams (shared across leagues)
├── TeamLeague      — many-to-many Team ↔ League with activation flag
├── Match           — fixtures (fetched from API, inserted by externalId)
├── MatchOdds       — per-match prediction vote counts + locked odds snapshot
├── Prediction      — user predictions (unique: userId+matchId)
├── ScoringRule     — configurable scoring rules
├── Group           — user groups for sub-leaderboards
├── GroupMember     — many-to-many User ↔ Group
├── TeamStanding    — cached league standings from football-data.org
├── DeviceToken     — FCM push tokens for mobile notifications
├── Season          — season lifecycle (DRAFT → ACTIVE → ENDED), optional odds config
├── SeasonStanding  — frozen final standings (overall + per-group) recorded when a season ends
├── ChampionBonus       — per-season Champion Bonus config (one league per season)
├── ChampionBonusTeam   — admin-selected allowed team subset
├── ChampionBonusPick   — one user pick per config
└── ChampionBonusAward  — per (team, counted match) ledger row, ONE per game (not per user)
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
| currentStreak | Int | default 0 | consecutive scoring predictions (updated by streak-badge-service) |
| longestStreak | Int | default 0 | all-time best scoring streak |
| createdAt / updatedAt | DateTime | | auto-managed |

### `UserBadge`
| Field | Type | Constraint | Notes |
|---|---|---|---|
| id | Int | PK autoincrement | |
| userId | Int | FK → User (cascade delete) | |
| badge | BadgeKey enum | | which badge was earned |
| earnedAt | DateTime | default now() | |
| | | **@@unique([userId, badge])** | a user earns each badge at most once |

### `League`
| Field | Type | Constraint | Notes |
|---|---|---|---|
| id | Int | PK autoincrement | |
| externalId | Int | unique | football-data.org competition ID |
| name | String | | e.g. "Premier League" |
| country | String | | |
| logo | String? | | emblem URL from API |
| season | Int | | e.g. 2025 |
| isActive | Boolean | default false | admin toggles inclusion — soft-delete only: deactivating flips this flag, the row (and its `Match`/`TeamLeague` history) is never deleted, so re-activating updates the existing row by `externalId` instead of re-creating it |

### `Team`
| Field | Type | Constraint | Notes |
|---|---|---|---|
| id | Int | PK autoincrement | |
| externalId | Int | unique | football-data.org team ID |
| name | String | | |
| logo | String? | | crest URL |
| createdAt / updatedAt | DateTime | | auto-managed |

Teams are shared across leagues via the `TeamLeague` join table (a team can play in multiple competitions).

### `TeamLeague`
| Field | Type | Constraint | Notes |
|---|---|---|---|
| id | Int | PK autoincrement | |
| teamId | Int | FK → Team (cascade delete) | |
| leagueId | Int | FK → League (cascade delete) | |
| externalLeagueId | Int | | denormalized for query perf |
| isActive | Boolean | default true | admin toggles team visibility per league — soft-delete only, same as `League.isActive`: the row persists so re-activating updates it in place |
| createdAt / updatedAt | DateTime | | auto-managed |
| | | **@@unique([teamId, leagueId])** | |

### `Match`
| Field | Type | Constraint | Notes |
|---|---|---|---|
| id | Int | PK autoincrement | |
| externalId | Int? | **unique** | API fixture ID — prevents duplicates; null for manually-created matches |
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
| resultHomeScore | Int? | | set when finished (regular time) |
| resultAwayScore | Int? | | set when finished (regular time) |
| resultPenaltyHomeScore | Int? | | set for matches decided by penalties |
| resultPenaltyAwayScore | Int? | | set for matches decided by penalties |
| resultWinner | Winner? | | home/away/draw |
| liveHomeScore | Int? | | last score the live-goal QStash poller has seen/notified on — used to diff for new goals, not a user-facing field. See [Live Goal Notifications](SYSTEM_ARCHITECTURE.md) |
| liveAwayScore | Int? | | same, away team |
| scoresProcessed | Boolean | default false | true after predictions scored |
| weekStart | DateTime | | Thursday UTC of fetch week |
| seasonId | Int? | FK → Season (set null on delete) | assigned on fetch when a season is ACTIVE; backfilled by `retro-assign` |

### `Prediction`
| Field | Type | Constraint | Notes |
|---|---|---|---|
| id | Int | PK autoincrement | |
| userId | Int | FK → User (cascade delete) | |
| matchId | Int | FK → Match (cascade delete) | |
| homeScore | Int | ≥ 0 | |
| awayScore | Int | ≥ 0 | |
| predictedWinner | Winner enum | | computed from scores at save time |
| pointsAwarded | Int | default 0 | `finalScore` — used by leaderboard SUM |
| baseScore | Int | default 0 | raw score before odds multiplier |
| finalScore | Int | default 0 | `round(baseScore × outcomeOdds)` — same as pointsAwarded |
| outcomeOdds | Decimal(4,2) | default 1.0 | locked odds snapshot for this prediction's outcome |
| scoringBreakdown | Json? | | `{rules: [...], odds?: {outcomeOdds, baseScore, finalScore}}` |
| | | **@@unique([userId, matchId])** | prevents duplicate predictions |

### `MatchOdds`
| Field | Type | Constraint | Notes |
|---|---|---|---|
| id | Int | PK autoincrement | |
| matchId | Int | unique FK → Match (cascade) | one row per match |
| homeWinVotes | Int | default 0 | prediction count at lock time |
| drawVotes | Int | default 0 | |
| awayWinVotes | Int | default 0 | |
| homeWinOdds | Decimal(4,2) | default 1.10 | normalised to [Season.oddsMin, Season.oddsMax] |
| drawOdds | Decimal(4,2) | default 3.05 | |
| awayWinOdds | Decimal(4,2) | default 5.00 | |
| lockedAt | DateTime? | | set when odds are frozen at scoring time (idempotent) |

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

### `DeviceToken`
| Field | Type | Constraint | Notes |
|---|---|---|---|
| id | Int | PK autoincrement | |
| userId | Int | FK → User (cascade delete) | |
| token | String | unique | FCM registration token |
| platform | String | default 'android' | device platform |
| createdAt / updatedAt | DateTime | | auto-managed |
| | | **@@index([userId])** | |

### `Season`
| Field | Type | Constraint | Notes |
|---|---|---|---|
| id | Int | PK autoincrement | |
| name | String | | e.g. "2025/26" |
| description | String? | | |
| status | SeasonStatus enum | default 'DRAFT' | DRAFT → ACTIVE → ENDED |
| startDate | DateTime | | matches with `kickoffTime >= startDate` are assigned to this season once ACTIVE |
| startedAt | DateTime? | | set by `activateSeason()` |
| endedAt | DateTime? | | set by `endSeason()` |
| oddsEnabled | Boolean | default false | whether prediction odds apply for this season |
| oddsMin / oddsMax | Decimal(4,2) | default 1.1 / 5.0 | bounds `MatchOdds` are normalised to |
| createdAt / updatedAt | DateTime | | auto-managed |

Only one `Season` may be `ACTIVE` at a time — enforced in `season-service.ts`, not at the schema level.

### `SeasonStanding`
| Field | Type | Constraint | Notes |
|---|---|---|---|
| id | Int | PK autoincrement | |
| seasonId | Int | FK → Season (cascade) | |
| groupId | Int? | FK → Group (set null on delete) | null row = overall (all users), non-null = per-group standing |
| userId | Int | FK → User (cascade) | |
| rank | Int | | 1-based, computed at season end |
| totalPoints | Int | | prediction points + Champion Bonus, folded together before ranking |
| totalPredictions | Int | | |
| exactScores | Int | | count of exact-score predictions |
| recordedAt | DateTime | default now() | |
| | | **@@index([seasonId, groupId])** | |
| | | **@@index([userId])** | |

A season's final standings are computed once, on `endSeason()`, from live `Prediction`/`ChampionBonusAward` data and written here — this table is a frozen snapshot, not a live view. Re-ending a season deletes and recomputes its rows (`deleteMany` + `createMany`), so recomputation is idempotent. Recording standings also awards `season_champion` (overall rank 1), `season_podium` (overall rank ≤ 3), and `group_season_champion` (rank 1 within a group) badges.

### `ChampionBonus`
| Field | Type | Constraint | Notes |
|---|---|---|---|
| id | Int | PK autoincrement | |
| seasonId | Int | **unique** FK → Season (cascade) | one config (one league) per season |
| leagueId | Int | FK → League (cascade) | the single league the admin enabled |
| status | ChampionBonusStatus enum | default 'OPEN' | OPEN (picks editable) → LOCKED (awards accruing) |
| lockedAt | DateTime? | | set on lock; only matches kicking off after this count |
| createdAt / updatedAt | DateTime | | auto-managed |

No CANCELLED status — cancel deletes the row (cascades teams/picks/awards); re-enable is a fresh insert.

### `ChampionBonusTeam`
| Field | Type | Constraint | Notes |
|---|---|---|---|
| id | Int | PK autoincrement | |
| championBonusId | Int | FK → ChampionBonus (cascade) | |
| teamId | Int | FK → Team (cascade) | |
| | | **@@unique([championBonusId, teamId])** | admin-selected allowed subset (from ALL league teams) |

### `ChampionBonusPick`
| Field | Type | Constraint | Notes |
|---|---|---|---|
| id | Int | PK autoincrement | |
| championBonusId | Int | FK → ChampionBonus (cascade) | |
| userId | Int | FK → User (cascade) | |
| teamId | Int | FK → Team (cascade) | |
| createdAt / updatedAt | DateTime | | auto-managed |
| | | **@@unique([championBonusId, userId])** | one pick per user; upsert on change (while OPEN only) |
| | | **@@index([championBonusId, teamId])** | join target for bonus totals |

### `ChampionBonusAward`
| Field | Type | Constraint | Notes |
|---|---|---|---|
| id | Int | PK autoincrement | |
| championBonusId | Int | FK → ChampionBonus (cascade) | |
| teamId | Int | FK → Team (cascade) | |
| matchId | Int | FK → Match (cascade) | |
| gameNumber | Int | | Nth counted game since lock, 1-based |
| isWin | Boolean | | from `Match.resultWinner` (penalty wins count) |
| points | Int | | `isWin ? 2^min(gameNumber, 20) : 0` — exponent capped to avoid Int overflow |
| | | **@@unique([championBonusId, teamId, matchId])** | ONE row per (team, counted match) — not per user; 50 users on the same team share these rows |
| | | **@@index([championBonusId, teamId])** | |

Ledger is rebuilt from scratch per team on every relevant finished/corrected match (`ORDER BY kickoffTime asc, id asc`), so `gameNumber` stays deterministic regardless of result arrival order and re-processing is idempotent.

## Enums

| Enum | Values |
|---|---|
| `Role` | `admin`, `user` |
| `BadgeKey` | `first_exact_score`, `on_a_roll`, `perfect_week`, `group_champion`, `season_champion`, `season_podium`, `group_season_champion` |
| `SeasonStatus` | `DRAFT`, `ACTIVE`, `ENDED` |
| `MatchStatus` | `scheduled`, `live`, `finished`, `postponed`, `cancelled` |
| `Winner` | `home`, `away`, `draw` |
| `ChampionBonusStatus` | `OPEN` (picks editable), `LOCKED` (picks frozen, awards accruing) |

## Repository Layer

`src/lib/repositories/` provides thin Prisma wrappers used by the service layer. Each repository corresponds to one Prisma model and exposes standard CRUD methods (`findMany`, `findUnique`, `create`, `update`, `delete`, `upsert`).

| Repository | Model |
|---|---|
| `match-repository.ts` | Match |
| `prediction-repository.ts` | Prediction |
| `league-repository.ts` | League |
| `team-repository.ts` | Team |
| `team-league-repository.ts` | TeamLeague |
| `group-repository.ts` | Group |
| `group-member-repository.ts` | GroupMember |
| `user-repository.ts` | User |
| `device-repository.ts` | DeviceToken |
| `scoring-rule-repository.ts` | ScoringRule |
| `team-standing-repository.ts` | TeamStanding |
| `system-repository.ts` | Cross-model utilities (e.g. raw SQL helpers) |
| `season-repository.ts` | Season |
| `champion-bonus-repository.ts` | ChampionBonus, ChampionBonusTeam, ChampionBonusPick, ChampionBonusAward |

Route handlers and higher-level lib files should **not** import repositories directly — they use services, which call repositories.

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
