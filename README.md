# Football Predictions

A private full-stack app for friends to predict football match scores and compete on a leaderboard. Built with Next.js 16 App Router, PostgreSQL/Prisma, and the football-data.org free tier.

## What it does

- Users predict the score of upcoming matches before kickoff
- Results are fetched automatically from football-data.org and scored via a configurable points engine
- A live leaderboard ranks users by total points, filterable by period and group
- Admin manages leagues, teams, matches, users, groups, and scoring rules
- Android mobile app (React Native / Expo) gives users full access on the go
- Push notifications (FCM) and email reminders keep users engaged

## Architecture

See [`docs/architecture/INDEX.md`](docs/architecture/INDEX.md) for the full architecture documentation.

Quick map:

| Layer | Path |
|---|---|
| Web (Next.js App Router) | `src/app/` |
| REST API | `src/app/api/` |
| Mobile API (JWT Bearer) | `src/app/api/mobile/` |
| Service layer | `src/lib/services/` |
| Repository layer | `src/lib/repositories/` |
| Database schema | `prisma/schema.prisma` |
| Mobile app (React Native) | `mobile/` |

## Getting started

```bash
npm install
# fill in .env.local — see docs/architecture/DEPLOYMENT_GUIDE.md for all required vars
npx prisma migrate dev
npm run seed                        # creates admin user + default scoring rules
npm run dev
```

Default admin after seeding: `admin@predictions.app` / `changeme123` — change this immediately.

See [`docs/architecture/DEPLOYMENT_GUIDE.md`](docs/architecture/DEPLOYMENT_GUIDE.md) for production setup (Vercel, Supabase/Neon, football-data.org key, Gmail, Firebase).

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start dev server at http://localhost:3000 |
| `npm run build` | Production build (must pass before deploy) |
| `npm run lint` | Run ESLint |
| `npm run seed` | Seed admin user, General group, and default scoring rules |
| `npx prisma migrate dev` | Apply migrations locally |
| `npx prisma studio` | Browse the database |

## Tech stack

| Component | Technology |
|---|---|
| Framework | Next.js 16.2.1, React 19.2.4 |
| Language | TypeScript 5 |
| Auth | NextAuth.js v5 (JWT, credentials provider) |
| ORM | Prisma 6.19.3 |
| Database | PostgreSQL (Supabase or Neon) |
| Styling | Tailwind CSS 4, shadcn/ui |
| Mobile | React Native 0.76.5, Expo 52 |
| Push notifications | Firebase Cloud Messaging (FCM) |
| Email | Nodemailer + Gmail |
| Deployment | Vercel |
| Football data | football-data.org v4 |
