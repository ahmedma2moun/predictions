# Architecture Documentation — Football Predictions

## Architecture at a Glance

```
┌─────────────────────────────────────────────────────────┐
│                     Vercel Edge                          │
│  ┌─────────────┐   ┌──────────────┐   ┌─────────────┐  │
│  │  Next.js    │   │  API Routes  │   │  Cron Jobs  │  │
│  │  App Router │──▶│  /api/*      │──▶│  /api/cron/ │  │
│  └─────────────┘   └──────┬───────┘   └──────┬──────┘  │
└─────────────────────────────────────────────────────────┘
                             │                  │
              ┌──────────────▼──────────────────▼──────────┐
              │            MongoDB Atlas                     │
              │  users · leagues · teams · matches          │
              │  predictions · scoringRules                 │
              └─────────────────────────────────────────────┘
                                    │
              ┌─────────────────────▼─────────────────────┐
              │          API-Football (RapidAPI)            │
              │    Fixtures · Results · Leagues · Teams     │
              └───────────────────────────────────────────┘
```

## Documents

| Document | Purpose |
|---|---|
| [SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md) | Component design, data flows, ADRs |
| [API_SPECIFICATIONS.md](API_SPECIFICATIONS.md) | All REST route contracts |
| [DATA_ARCHITECTURE.md](DATA_ARCHITECTURE.md) | MongoDB schema, indexes, patterns |
| [SECURITY_ARCHITECTURE.md](SECURITY_ARCHITECTURE.md) | Auth flow, RBAC, secrets |
| [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) | Vercel deploy, env vars, cron setup |

## Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Auth strategy | JWT (NextAuth v5) | Stateless, works with Vercel serverless |
| DB | MongoDB Atlas | Flexible schema, free tier, Mongoose ODM |
| Football data | API-Football via RapidAPI | Free tier has 100 req/day, good data quality |
| Score prediction lock | Server + client side | Prevents race conditions around kickoff |
| Scoring tiers | Exclusive (exact > diff > one_team) | Prevents double-counting overlapping rules |

## Reading Order by Role

| Role | Start Here |
|---|---|
| New developer | This file → SYSTEM_ARCHITECTURE.md → DATA_ARCHITECTURE.md |
| Deploying to production | DEPLOYMENT_GUIDE.md → SECURITY_ARCHITECTURE.md |
| Adding new features | SYSTEM_ARCHITECTURE.md → API_SPECIFICATIONS.md |
| Debugging | `CLAUDE.md` → `/debug` command |
