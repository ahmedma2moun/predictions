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
│            │     lib/services/ (10) → lib/repositories/ (12)       │ │
│            │  match · prediction · leaderboard · group · league   │ │
│            │  user · team · scoring-rule · device · streak-badge  │ │
│            └────────────────────────┬─────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────┘
                                      │
             ┌────────────────────────▼───────────────────────────┐
             │           PostgreSQL (Supabase / Neon)              │
             │  users · leagues · teams · matches                  │
             │  predictions · scoringRules                         │
             │  groups · groupMembers · teamStandings              │
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

## Reading Order by Role

| Role | Start Here |
|---|---|
| New developer | This file → SYSTEM_ARCHITECTURE.md → DATA_ARCHITECTURE.md |
| Deploying to production | DEPLOYMENT_GUIDE.md → SECURITY_ARCHITECTURE.md |
| Adding new features | SYSTEM_ARCHITECTURE.md → API_SPECIFICATIONS.md |
| Debugging | `CLAUDE.md` → `/debug` command |
