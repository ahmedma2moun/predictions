# Security Architecture

## Security Layers

```
Internet
   │
   ▼
Vercel Edge (HTTPS only)
   │
   ▼
src/proxy.ts  (wraps NextAuth auth())
  ├─ No session → redirect /login
  └─ /admin/* + not admin → redirect /dashboard
   │
   ▼
API Route Handlers
  ├─ auth() check → 401 if no session
  └─ role check → 403 if not admin (checked inline in EVERY admin handler)
   │
   ▼
Prisma → PostgreSQL (SSL required, connection string auth)
```

> **Note**: The file is `src/proxy.ts`, **not** `src/middleware.ts`. Next.js 16 requires the middleware entry point to be named `proxy.ts` in this project's configuration.

## Authentication Flow

```
User submits email + password
   │
   ▼
POST /api/auth/callback/credentials (NextAuth v5)
   │
   ▼
authorize() in src/lib/auth.ts
  ├─ prisma.user.findUnique({ where: { email } })
  ├─ bcrypt.compare(password, user.password)
  └─ return { id, email, name, role } or null
   │
   ▼
JWT created (NEXTAUTH_SECRET signed)
  ├─ jwt() callback adds: token.id, token.role
  └─ session() callback exposes: session.user.id, session.user.role
   │
   ▼
HttpOnly cookie set (secure in production)
```

## RBAC Matrix

| Resource | Anonymous | User | Admin |
|---|---|---|---|
| /login | ✓ | ✓ | ✓ |
| /dashboard, /matches, /predictions, /leaderboard | ✗ | ✓ | ✓ |
| /admin/* | ✗ | ✗ | ✓ |
| GET /api/matches, /api/predictions, /api/leaderboard, /api/groups, /api/leagues | ✗ | ✓ | ✓ |
| POST /api/predictions | ✗ | ✓ | ✓ |
| /api/admin/* | ✗ | ✗ | ✓ |
| /api/cron/* | ✗ | ✗ | Bearer `CRON_SECRET` or `TRIGGER_SECRET` |
| /api/health | ✓ | ✓ | ✓ |
| POST /api/mobile/auth/login | ✓ | ✓ | ✓ |
| /api/mobile/* (all other) | ✗ | JWT Bearer | JWT Bearer |

## Secrets Architecture

| Secret | Purpose | Storage |
|---|---|---|
| DATABASE_URL | PostgreSQL pooled connection string | .env.local / Vercel env |
| DIRECT_URL | PostgreSQL direct (non-pooled) — migrations only | .env.local / Vercel env |
| NEXTAUTH_SECRET | Web session JWT signing key | .env.local / Vercel env |
| MOBILE_JWT_SECRET | Mobile API JWT signing key (falls back to NEXTAUTH_SECRET) | .env.local / Vercel env |
| NEXTAUTH_URL | Canonical app URL | .env.local / Vercel env |
| FOOTBALL_API_KEY | football-data.org v4 API key | .env.local / Vercel env |
| CRON_SECRET | Bearer token for cron endpoint auth (Vercel + manual) | .env.local / Vercel env |
| TRIGGER_SECRET | Bearer token for cron-job.org to call `/api/cron/fetch-results` | .env.local / Vercel env |
| GMAIL_USER | Gmail sender address | .env.local / Vercel env |
| GMAIL_APP_PASSWORD | Gmail App Password (not account password) | .env.local / Vercel env |

All secrets injected at build/runtime via environment variables. Never committed to git (`.env.local` is gitignored).

## Input Validation

- **Prediction scores**: `typeof score === 'number' && score >= 0` validated in POST /api/predictions
- **Prediction lock**: `isMatchLocked(match.kickoffTime)` enforced server-side — cannot be bypassed by client
- **Email**: stored as-is, uniqueness enforced by PostgreSQL unique constraint
- **Passwords**: bcrypt cost factor 12, never logged or returned in API responses
- **matchId**: validated as integer; Prisma throws on invalid format
- **Admin role**: `(session.user as any).role === 'admin'` checked inline in **every** admin API handler — layout-level checks alone are not sufficient
- **Cron auth**: all cron handlers verify `Authorization: Bearer ${CRON_SECRET}` before any work

## Known Limitations

- No refresh token rotation — JWT sessions persist until `NEXTAUTH_SECRET` rotation
- No CSRF protection beyond NextAuth's built-in same-site cookies
- No per-user rate limiting on prediction endpoints
- `FOOTBALL_API_KEY` is accessible to all server-side code — rotate if compromised
- `GMAIL_APP_PASSWORD` grants email-send access — revoke at Google account if compromised
