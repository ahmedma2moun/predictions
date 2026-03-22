# Security Architecture

## Security Layers

```
Internet
   │
   ▼
Vercel Edge (HTTPS only)
   │
   ▼
src/middleware.ts
  ├─ No session → redirect /login
  └─ /admin/* + not admin → redirect /dashboard
   │
   ▼
API Route Handlers
  ├─ auth() check → 401 if no session
  └─ role check → 403 if not admin
   │
   ▼
MongoDB Atlas (VPC, auth required)
```

## Authentication Flow

```
User submits email + password
   │
   ▼
POST /api/auth/callback/credentials (NextAuth v5)
   │
   ▼
authorize() in src/lib/auth.ts
  ├─ User.findOne({ email }) via Mongoose
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
| GET /api/matches, /api/predictions, /api/leaderboard | ✗ | ✓ | ✓ |
| POST /api/predictions | ✗ | ✓ | ✓ |
| /api/admin/* | ✗ | ✗ | ✓ |
| /api/cron/* | ✗ | ✗ | Bearer token only |

## Secrets Architecture

| Secret | Purpose | Storage |
|---|---|---|
| MONGODB_URI | Atlas connection string | .env.local / Vercel env |
| NEXTAUTH_SECRET | JWT signing key | .env.local / Vercel env |
| NEXTAUTH_URL | Canonical app URL | .env.local / Vercel env |
| RAPIDAPI_KEY | API-Football access | .env.local / Vercel env |
| CRON_SECRET | Cron endpoint auth token | .env.local / Vercel env |

All secrets injected at build/runtime via environment variables. Never committed to git (`.env.local` is in `.gitignore`).

## Input Validation
- Prediction scores: validated `typeof score === 'number' && score >= 0` in API handler
- Email: stored lowercase, uniqueness enforced by MongoDB index
- Passwords: bcrypt cost factor 12, never logged or returned in API responses
- matchId: MongoDB ObjectId — Mongoose will throw on invalid format
- Kickoff time lock: enforced server-side in prediction POST handler (cannot be bypassed by client)

## Known Limitations
- No refresh token rotation — JWT sessions persist until NEXTAUTH_SECRET rotation
- No CSRF protection beyond NextAuth's built-in same-site cookies
- No per-user rate limiting on prediction endpoints
- API-Football key exposed to all server-side code — rotate if compromised
