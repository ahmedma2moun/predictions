# API Logging Plan (Axiom)

**Status:** PR 1 (prediction APIs) implemented; PR 2 and 3 planned. Optional `AXIOM_URL` env var added for the EU region.
**Goal:** Keep API logs for at least 7 days in a free service outside Vercel. Log the **user**, **API path**, **request body** and **response** for every call, starting with the prediction APIs.

---

## 1. Current state

- `src/lib/logger.ts` already writes JSON lines to `console`. Those lines only go to Vercel's runtime logs, which are kept for a short time.
- `withErrorHandling()` in `src/lib/api-handler.ts` is used by only about 10 admin routes. **None of the prediction routes use it**, so an exception in `POST /api/predictions` is never logged in a structured form.
- No route records its status, duration, user, request body or response.

## 2. Provider choice

Check the provider's pricing page before signing up, because free limits change.

| Provider | Free ingest | Retention | How the app sends logs |
|---|---|---|---|
| **Axiom** (chosen) | ~500 GB/month | **30 days** | One HTTP POST of a JSON array. No SDK needed. |
| Grafana Cloud (Loki) | 50 GB/month | 14 days | HTTP push. Querying with LogQL takes more learning. |
| New Relic | 100 GB/month | 8 days | HTTP Log API |
| ~~Better Stack~~ | 3 GB | 3 days | Doesn't meet the 7-day requirement |
| Own Postgres table | free | any | Fills a free-tier database quickly |

Why Axiom:
- It keeps logs for 30 days.
- It has a query UI and dashboards.
- Sending logs is one `fetch` call, so there's no new dependency and switching providers later means changing one file.

---

## 3. Axiom registration

1. Go to **https://app.axiom.co** and click **Sign up**. GitHub, Google or email all work.
2. Create an **organization**, for example `predictions`, and choose the free **Personal** plan. No card is needed.
3. Choose a **region**. Use **US** unless your data must be stored in the EU. The region changes the ingest URL, so write down which one you picked.
4. Create a dataset: **Datasets**, then **New dataset**, named `predictions-api`.
5. Create a token: **Settings**, then **API tokens**, then **New API token**.
   - Name it `vercel-ingest`.
   - Give it **Ingest only** permission, on the `predictions-api` dataset only. If the token leaks, it can only write logs.
   - **Copy it right away.** Axiom shows it only once. It starts with `xaat-`.
6. Check that it works:
   ```bash
   curl -X POST "https://api.axiom.co/v1/datasets/predictions-api/ingest" \
     -H "Authorization: Bearer xaat-YOUR-TOKEN" \
     -H "Content-Type: application/json" \
     -d '[{"event":"test","msg":"hello from predictions"}]'
   ```
   Then open **Stream** for `predictions-api` in Axiom. The event should appear within a few seconds. For the EU region, use the EU ingest host that Axiom shows.
7. Add the environment variables in Vercel (**Project**, then **Settings**, then **Environment Variables**, for Production and Preview). Add them to `.env.local` too if you want logs from local development.

   | Name | Value |
   |---|---|
   | `AXIOM_TOKEN` | `xaat-…` |
   | `AXIOM_DATASET` | `predictions-api` |

**Warnings**
- Do **not** install Axiom's "Vercel integration". It forwards Vercel's logs through a log drain, which needs a paid Vercel plan and keeps you tied to Vercel. This plan sends logs straight from the app instead.
- Never commit the token or paste it in chat.

---

## 4. Design

### 4.1 Transport: `src/lib/logging/transport.ts`

- Add a `LogTransport` interface and an `AxiomTransport` that queues entries and POSTs them in batches to `https://api.axiom.co/v1/datasets/$AXIOM_DATASET/ingest`.
- Keep the `logger.info/warn/error` API in `src/lib/logger.ts` exactly as it is. It keeps writing to `console`, and also queues entries when `AXIOM_TOKEN` is set. Without the token (local dev, tests), nothing is sent.
- **Serverless flush:** a function can be frozen as soon as its response is sent. Send the batch inside `after()` from `next/server`, which runs after the response without slowing it down.
- If the POST to Axiom fails, write that to `console` only, never back into Axiom, so a failure can't cause a loop.

### 4.2 Request wrapper: `withApiLogging(routeName, handler)`

Build it on top of `withErrorHandling`. Route handlers don't need any logging code of their own.

| Field | How it's captured |
|---|---|
| **User** | The wrapper resolves the user itself: `auth()` for web routes, `getMobileSession(req)` for `/api/mobile/*`. Both only decode a JWT. Logs `id`, `name` and `role`, but not email. `null` if there's no user. Failed-auth 401s are still logged. |
| **Path** | `method`, `pathname` and the query string, from `req.nextUrl`. |
| **Request body** | `await req.clone().text()` before calling the handler, for POST, PUT, PATCH and DELETE. The handler still gets an unread body, so `safeParseBody` keeps working. |
| **Response** | `await res.clone().text()` after the handler returns. The original response is returned untouched. |
| Status / duration | `res.status` and `performance.now()` before and after the handler. |
| Error | `error.message` and the first few stack lines, for errors caught by `withErrorHandling`. |
| `requestId` | Taken from the `x-request-id` header, or a new `crypto.randomUUID()`. Also added as a response header, which doesn't change any response body. |
| `platform` | `mobile` if the path starts with `/api/mobile/`, otherwise `web`. |

### 4.3 Event shape

```json
{
  "event": "api.request",
  "ts": "2026-10-14T18:02:11.123Z",
  "requestId": "6f1c…",
  "user": { "id": "17", "name": "ahmed", "role": "user" },
  "platform": "mobile",
  "method": "POST",
  "path": "/api/mobile/predictions",
  "query": "",
  "status": 409,
  "durationMs": 42,
  "requestBody": "{\"matchId\":\"812\",\"homeScore\":2,\"awayScore\":1}",
  "responseBody": "{\"error\":\"Predictions are locked for this match\"}",
  "truncated": false
}
```

**Store the bodies as JSON strings, not nested objects.** If they were nested, every key inside every body would become its own column in Axiom, and the dataset's column limit would fill up. The strings can still be searched:
- `['requestBody'] contains '"matchId":"812"'`
- `parse_json(['requestBody']).homeScore`

### 4.4 Prediction domain event

The wrapper's request log covers every route. On top of it, the prediction POST handlers emit **`prediction.upsert`** with:

- `userId`, `matchId`, `homeScore`, `awayScore`, `platform`
- `outcome`, one of:
  - `ok`, plus `created` or `updated` if `upsertPrediction` can report which
  - `invalid_body`, `invalid_scores`, `not_found` or `locked`
- For `locked`: the `reason` (`disabled`, `not_scheduled` or `kickoff_passed`) and `msToKickoff`

Also emit **`prediction.group_view_denied`** for the 403 cases in `getGroupPredictionsForMatch`.

These events are emitted in the route handler, because the service doesn't know the platform. Prisma queries stay in the service, as CLAUDE.md requires.

### 4.5 Redaction (required)

Before sending, parse each body as JSON and replace the values of these keys with `"[REDACTED]"`, at any depth:

`password`, `currentPassword`, `newPassword`, `token`, `accessToken`, `refreshToken`, `fcmToken`, `secret`, `authorization`

- Never log the `Authorization` or `Cookie` headers.
- Routes that need a test proving redaction: web login, mobile auth, the profile password change, and device registration.
- **Open decision:** should email addresses also be masked? They appear in admin user create and edit.

### 4.6 Size limits

- Each body is cut at **16 KB**, and the event is marked `truncated: true`.
- Truncated array responses also get a `responseItems` count.
- Estimate: 100k requests a month at about 20 KB each is roughly 2 GB, far below the free 500 GB.

---

## 5. Routes

### PR 1: prediction APIs
| Route | Methods |
|---|---|
| `src/app/api/predictions/route.ts` | GET, POST |
| `src/app/api/mobile/predictions/route.ts` | GET, POST |
| `src/app/api/predictions/slip/route.ts` | all |
| `src/app/api/mobile/predictions/slip/route.ts` | all |
| `src/app/api/predictions/stats/route.ts` | GET |
| `src/app/api/mobile/predictions/stats/route.ts` | GET |
| `src/app/api/matches/[matchId]/group-predictions/route.ts` | GET |
| `src/app/api/mobile/matches/[matchId]/group-predictions/route.ts` | GET |
| `src/app/api/mobile/matches/[matchId]/predictions/route.ts` | GET |
| `src/app/api/leaderboard/user-predictions/route.ts` | GET |
| `src/app/api/mobile/leaderboard/user-predictions/route.ts` | GET |

### PR 2: every other API route
Wrap them in this order: auth and login (with redaction checked), then admin, then cron and webhooks. Cron and webhooks already use `logger`, so they get the transport automatically.

### PR 3: Axiom dashboards
Saved queries for:
- error rate by route
- locked-prediction attempts
- slowest routes
- requests per user

---

## 6. Tests (vitest)

- The transport sends nothing when `AXIOM_TOKEN` isn't set.
- The wrapper logs the user, path, request body, response, status and duration.
- The handler can still read the request body after the wrapper reads its clone.
- A thrown error is logged and returns a 500.
- Every key in the denylist is redacted, including nested keys.
- Bodies over 16 KB are truncated and flagged.
- `prediction.upsert` reports the right outcome for the `ok`, `locked`, `invalid_scores` and `not_found` cases.

## 7. Docs to update with PR 1

| Document | Change |
|---|---|
| `docs/architecture/SYSTEM_ARCHITECTURE.md` | Logging section and an ADR for choosing Axiom |
| `docs/architecture/INDEX.md` | Key Decisions row |
| `docs/architecture/DEPLOYMENT_GUIDE.md` | `AXIOM_TOKEN` and `AXIOM_DATASET` |
| `docs/architecture/SECURITY_ARCHITECTURE.md` | New secret, and what is never logged |
| `docs/architecture/API_SPECIFICATIONS.md` | `x-request-id` response header |
| `CLAUDE.md` | Add `AXIOM_TOKEN` to the secrets list |

## 8. Cross-layer note

This is a server-only change. No response body or contract changes, so the web pages, both native apps and `native/contract/fixtures/` stay untouched.

**Optional later change:** have the iOS and Android apps send an `x-request-id` header, so a phone bug report can be matched to its server log. That would have to be done on both platforms in the same PR.

## 9. Checklist before implementation

- [ ] Axiom account, `predictions-api` dataset and an ingest-only token created
- [ ] Region noted (US or EU)
- [ ] `AXIOM_TOKEN` and `AXIOM_DATASET` set in Vercel
- [ ] Decision made on masking email addresses
