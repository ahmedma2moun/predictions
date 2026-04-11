# Architecture Documentation — Football Predictions

## Architecture at a Glance

```
┌─────────────────────────────────────────────────────────────┐
│                        Vercel Edge                           │
│  ┌─────────────┐   ┌──────────────┐   ┌───────────────────┐ │
│  │  Next.js    │   │  API Routes  │   │    Cron Jobs      │ │
│  │  App Router │──▶│  /api/*      │──▶│  /api/cron/*      │ │
│  └─────────────┘   └──────┬───────┘   └──────┬────────────┘ │
└──────────────────────────────────────────────────────────────┘
                             │                  │
              ┌──────────────▼──────────────────▼──────────┐
              │          PostgreSQL (Supabase / Neon)        │
              │  users · leagues · teams · matches           │
              │  predictions · scoringRules                  │
              │  groups · groupMembers · teamStandings       │
              └─────────────────────────────────────────────┘
                                    │
              ┌─────────────────────▼─────────────────────┐
              │        football-data.org v4 API             │
              │   Competitions · Matches · Teams · Standings│
              └───────────────────────────────────────────-┘
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
| Score prediction lock | Server + client side | Prevents race conditions around kickoff |
| Scoring tiers | Exclusive (exact > diff > one_team) | Prevents double-counting overlapping rules |
| Email | Nodemailer + Gmail | Zero-cost transactional emails for a small group |
| DB backup | Daily JSON export via cron | Guards against accidental data loss |

## Reading Order by Role

| Role | Start Here |
|---|---|
| New developer | This file → SYSTEM_ARCHITECTURE.md → DATA_ARCHITECTURE.md |
| Deploying to production | DEPLOYMENT_GUIDE.md → SECURITY_ARCHITECTURE.md |
| Adding new features | SYSTEM_ARCHITECTURE.md → API_SPECIFICATIONS.md |
| Debugging | `CLAUDE.md` → `/debug` command |
