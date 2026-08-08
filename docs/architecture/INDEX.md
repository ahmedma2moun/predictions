# Architecture Documentation — Football Predictions

## Architecture at a Glance

```
┌────────────────────────────────────────────────────────────────────┐
│                          Vercel Edge                                │
│  ┌──────────────┐  ┌─────────────────────┐  ┌───────────────────┐  │
│  │  Next.js     │  │    API Routes        │  │    Cron Jobs      │  │
│  │  App Router  │─▶│  /api/*              │  │  /api/cron/*      │  │
│  │  (web)       │  │  /api/mobile/*       │  │  (5 scheduled)    │  │
│  └──────────────┘  └──────────┬──────────┘  └──────┬────────────┘  │
│                               │                     │               │
│            ┌──────────────────▼─────────────────────▼────────────┐ │
│            │     lib/services/ (13) → lib/repositories/ (14)       │ │
│            │  match · prediction · leaderboard · live-standing    │ │
│            │  group · league · user · team · scoring-rule         │ │
│            │  device · streak-badge · champion-bonus · season     │ │
│            └────────────────────────┬─────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────┘
                                      │
             ┌────────────────────────▼───────────────────────────┐
             │           PostgreSQL (Supabase / Neon)              │
             │  users · leagues · teams · matches                  │
             │  predictions · scoringRules                         │
             │  groups · groupMembers · teamStandings               │
             │  seasons · seasonStandings · championBonus*          │
             └────────────────────────────────────────────────────┘
                                      │
             ┌────────────────────────▼───────────────────────────┐
             │       lib/football/service.ts  (provider layer)     │
             │  factory → IFootballProvider → providers/*          │
             └────────────────────────┬───────────────────────────┘
                                      │
             ┌────────────────────────▼───────────────────────────┐
             │         football-data.org v4 API  (default)         │
             │   Competitions · Matches · Teams · Standings        │
             └────────────────────────────────────────────────────┘

Mobile app (React Native / Expo) → /api/mobile/* → lib/services/* → PostgreSQL
```

## Documents

| Document | Purpose |
|---|---|
| [SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md) | Component design, data flows, ADRs |
| [API_SPECIFICATIONS.md](API_SPECIFICATIONS.md) | All REST route contracts |
| [DATA_ARCHITECTURE.md](DATA_ARCHITECTURE.md) | PostgreSQL schema, indexes, access patterns |
| [SECURITY_ARCHITECTURE.md](SECURITY_ARCHITECTURE.md) | Auth flow, RBAC, secrets |
| [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) | Vercel deploy, env vars, cron setup |

## Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Auth strategy | JWT (NextAuth v5) | Stateless, works with Vercel serverless |
| DB | PostgreSQL via Prisma | Relational integrity, free tiers on Supabase/Neon |
| Football data | football-data.org v4 | Free tier (10 req/min), no RapidAPI middleman |
| Football provider abstraction | `lib/football/` (service → factory → provider) | Swap providers by setting `FOOTBALL_PROVIDER`; `service.ts` and all callers unchanged |
| Score prediction lock | Server + client side | Prevents race conditions around kickoff |
| Scoring tiers | Exclusive (exact > diff > one_team) | Prevents double-counting overlapping rules |
| Email | Nodemailer + Gmail | Zero-cost transactional emails for a small group |
| DB backup | Daily JSON export via cron | Guards against accidental data loss |
| API architecture | Service layer (`lib/services/`) → repository layer (`lib/repositories/`) | Web and mobile routes share one query implementation; only auth and serialization differ |
| Mobile auth | JWT Bearer (separate from NextAuth) | Mobile can't use httpOnly cookies; `getMobileSession()` verifies a signed JWT from `SecureStore` |
| Gamification | Streaks + badges (`streak-badge-service.ts`) | Scoring predictions builds current/longest streak; badges (first_exact_score, on_a_roll, group_champion) awarded automatically |
| Live score fetch caching | 30s shared cache in `fetchFixtureById()` (`service.ts`) | Client-side polling from every open match page would otherwise exceed the 10 req/min free-tier budget; collapses concurrent viewers into one upstream call per cache window |
| Champion Bonus data model | 4 separate tables, never `Prediction.pointsAwarded` | Admin `recalculateAllScores()` overwrites `pointsAwarded`; bonus is a read-time additive term instead. Awards are per (team, match), not per (user, match) — N users on one team share the same award rows |
| Champion Bonus cancel | Cascading delete, no CANCELLED status | Dead configs simply don't exist, so no query path ever needs to filter them out; re-enable is a fresh insert |
| Champion Bonus scoring | Recompute-from-scratch per team, ordered by kickoff | Deterministic `gameNumber` regardless of result arrival order; double-processing and corrections are idempotent by construction |
| Season standings | Frozen snapshot in `SeasonStanding`, written once on `endSeason()` | Keeps a season's final results stable even if later admin actions (recalculation, badge changes) touch the underlying data; re-ending is a delete-all + recreate, so it's idempotent |
| Football provider | TheSportsDB implemented, not yet activated | Ready via `FOOTBALL_PROVIDER=thesportsdb`, but requires a paid `THESPORTSDB_API_KEY` — see `docs/football-providers/thesportsdb.md` |
| Match events (goals/cards) | Embedded in `APIFixture.events`, fetched inside `fetchFixtureById()` | Reuses the existing live-score call/cache instead of a new provider method/route; TheSportsDB populates via `/lookuptimeline.php` for finished/live fixtures, other providers return `[]` |
| Odds feature | Disabled app-wide via `ODDS_FEATURE_ENABLED = false` (`lib/feature-flags.ts`) | Single kill switch ANDed into every `OddsConfig` build, without touching persisted `Season`/`MatchOdds` data — flipping it back to `true` fully restores prior behavior |
| Live goal notifications | Self-chaining Upstash QStash messages per match, not a global cron | Vercel Cron can't register per-resource dynamic schedules at runtime; a per-match chain only polls while that match is actually live instead of continuously — see ADR-16, `SYSTEM_ARCHITECTURE.md` |

## Reading Order by Role

| Role | Start Here |
|---|---|
| New developer | This file → SYSTEM_ARCHITECTURE.md → DATA_ARCHITECTURE.md |
| Deploying to production | DEPLOYMENT_GUIDE.md → SECURITY_ARCHITECTURE.md |
| Adding new features | SYSTEM_ARCHITECTURE.md → API_SPECIFICATIONS.md |
| Debugging | `CLAUDE.md` → `/debug` command |
