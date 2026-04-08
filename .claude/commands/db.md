---
description: "Database migration and schema workflow (Prisma + PostgreSQL)"
allowed-tools: ["Bash"]
---
# Database — Prisma + PostgreSQL

## Schema changes
1. Edit `prisma/schema.prisma`
2. Create migration: `npx prisma migrate dev --name <description>`
3. Review generated SQL in `prisma/migrations/`
4. Commit both `schema.prisma` and the new migration folder together

## Useful commands
```bash
npx prisma migrate dev --name <description>   # Create + apply migration (local dev)
npx prisma migrate deploy                      # Apply pending migrations (production/CI)
npx prisma migrate reset                       # Drop + recreate DB — LOCAL ONLY, destroys all data
npx prisma generate                            # Regenerate Prisma Client (auto-runs on npm install)
npx prisma studio                              # Browse data in the browser
npx prisma db push                             # Push schema without migration — prototyping only
npm run seed                                   # Re-seed admin user, General group, scoring rules
```

## Connection model
- `DATABASE_URL` — pooled connection (used by Prisma for all queries in serverless)
- `DIRECT_URL` — direct connection (used by Prisma for migrations only)
- Singleton defined in `src/lib/prisma.ts` — safe across Next.js hot reloads

## Schema location
`prisma/schema.prisma` — source of truth for all tables:
- `User`, `Group`, `GroupMember` — auth and friend groups
- `League`, `Team` — reference data imported from football-data.org
- `Match` — fixtures with embedded team names/logos (denormalized for perf)
- `Prediction` — user predictions with `pointsAwarded` + `scoringBreakdown` JSON
- `ScoringRule` — configurable scoring rules (seeded, editable via admin UI)

## Migration history
- `20260405153816_init` — initial schema
- `20260408074506_add_groups` — added Group + GroupMember
- `20260408075607_remove_group_leagues_teams` — simplified Group model (no direct league/team relations)
