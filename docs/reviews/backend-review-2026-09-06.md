# Backend code review — 6 September 2026

Reviewed working tree at commit `466a1cc`. No application code or database data was changed. This review covers the web/mobile API boundary, authentication, shared services and repositories, scoring, fixture ingestion, live jobs, seasons, Champion Bonus, notifications, export code, Prisma schema/migrations, and test infrastructure. It is a static review with targeted isolated reproductions, not a production penetration test or an exhaustive guarantee of correctness.

18 actionable findings: 7 P1 (high priority), 11 P2 (normal priority). Findings below describe concrete triggers, consequences, and fixes. Infrastructure controls outside this repository were not verified.

## High-priority findings

### 1. [P1] A caller-controlled header bypasses cron authentication

**Location:** [cron-auth.ts:15](../../src/lib/cron-auth.ts#L15).

`verifyCronRequest` returns true whenever `x-vercel-cron-schedule` is nonempty, before checking either bearer secret or a QStash signature. The proxy explicitly excludes cron routes. An unauthenticated request reaching this handler with that header can therefore invoke fixture/result processing, mass reminders, and the database export job. Export recipients remain server-configured; this is unauthorized job execution, not evidence that an attacker can select an export recipient.

**Validation:** Executed the actual function with a mocked request containing only this header; it returned true.

**Fix:** Remove header-presence authentication. Require a verified bearer secret or QStash signature for every cron request.

### 2. [P1] Demoting an administrator or resetting a password does not revoke existing sessions

**Locations:** [auth.ts:35](../../src/lib/auth.ts#L35), [mobile-auth.ts:23](../../src/lib/mobile-auth.ts#L23), [admin/users/route.ts:45](../../src/app/api/admin/users/route.ts#L45).

Web JWTs copy the role only at sign-in. Mobile verification checks the signature/expiry and returns embedded claims without checking the user record. The admin update endpoint changes role/password without invalidating either token type. A demoted administrator can continue passing admin guards with an old token; a password reset does not terminate a compromised session. Mobile tokens explicitly last 30 days.

**Fix:** Check current authorization state for privileged operations and introduce a session/token version or revocation timestamp that changes on role/password updates. Enforce it in both auth paths.

### 3. [P1] Web credential login bypasses the application's login rate limiter

**Location:** [auth.ts:15](../../src/lib/auth.ts#L15); compare [mobile/auth/login/route.ts:14](../../src/app/api/mobile/auth/login/route.ts#L14).

Only the mobile login route invokes `rateLimit`. The public NextAuth credentials flow goes directly to the user lookup and bcrypt comparison. An attacker can target the web credentials endpoint repeatedly even after the mobile endpoint starts returning 429. CSRF token acquisition does not limit credential attempts. No repository-level shared limit protects this path; external WAF policies were not assessed.

**Fix:** Apply a shared account/IP attempt policy to both credential entry points, preferably backed by a store shared across application instances.

### 4. [P1] Full recalculation changes shootout scoring and leaves stored score fields inconsistent

**Location:** [prediction-service.ts:304](../../src/lib/services/prediction-service.ts#L304).

Normal result processing and single-match recalculation derive the scoring winner from the match score, excluding penalties. `recalculateAllScores` instead passes `resultWinner`, which deliberately records the shootout winner. It also updates only `pointsAwarded` and `scoringBreakdown`, leaving `baseScore`, `finalScore`, and `outcomeOdds` unchanged. If odds are re-enabled, this path also discards the multiplier. The global odds flag is currently false, so the multiplier issue is conditional; the shootout and stale-field issues are current.

**Validation:** With winner=3 and exact-score=5 rules, an exact 1–1 prediction receives 8 normally but 5 after full recalculation when the stored shootout winner is home. Captured updates omit `baseScore` and `finalScore`.

**Fix:** Consolidate all rescoring entry points around one scoring-and-persistence operation. Derive the scoring winner consistently, persist every score field together, and refresh affected streaks after a full recalculation.

### 5. [P1] Failed scoring is marked complete, and result jobs cannot reliably recover

**Locations:** [results-processor.ts:327](../../src/lib/results-processor.ts#L327), [results-processor.ts:344](../../src/lib/results-processor.ts#L344), [live-goal-service.ts:215](../../src/lib/live-goal-service.ts#L215).

`batchScorePredictions` catches individual write failures and returns an error count, but `applyMatchResult` still sets `scoresProcessed=true`. Failed predictions remain unscored indefinitely. If an earlier operation throws after saving `status=finished`, the safety-net fetch also skips the match because its query excludes finished rows. The realtime wrapper catches processing errors and its caller returns `terminal_finished`, acknowledging the delivery and stopping the chain.

**Validation:** Injected a prediction-write failure into the actual processing function. It returned one scoring error and still wrote `scoresProcessed=true`.

**Fix:** Mark completion only after every required write succeeds, include finished/unprocessed matches in recovery, and propagate retryable failures to the webhook. Use a transaction or durable per-match processing state and an outbox for notification delivery.

### 6. [P1] Fixture rescheduling never updates the prediction deadline

**Location:** [matches-processor.ts:135](../../src/lib/matches-processor.ts#L135).

Existing external fixture IDs are only reported as skipped; their kickoff time/status is never synchronized. When a provider moves kickoff earlier, prediction submission continues accepting entries until the old time because `upsertPrediction` checks only the stored kickoff. Moving a match later prematurely locks predictions. Live/reminder chains are registered only for new rows, so rescheduled games can also retain obsolete wake-up times or a stopped chain.

**Fix:** Reconcile mutable fixture metadata on subsequent fetches. When kickoff/status changes, update locking data and reschedule jobs with a fixture schedule version. Submission should also reject matches already live or finished.

### 7. [P1] Test setup runs migrations before validating the database target

**Locations:** [global-setup.ts:6](../../tests/helpers/global-setup.ts#L6), [db.ts:10](../../tests/helpers/db.ts#L10).

The suite executes `prisma migrate deploy` immediately after loading `.env.test`, before any target validation. The later truncation guard merely checks whether the entire URL contains `test`, which can match a username, password, host, or query string. Dotenv loading also does not explicitly override inherited database variables. These checks do not establish an isolated test database.

**Observed:** The local `.env.test` currently resolves to a remote Supabase database whose database name is not test-specific. No migration, query, or truncation was executed during this review.

**Fix:** Validate parsed host/database names for both `DATABASE_URL` and `DIRECT_URL` before creating a client or executing migrations. Require an explicit disposable test target, fail on missing configuration, and ensure inherited variables cannot silently select another database.

## Other actionable findings

### 8. [P2] Already-finished fixtures are imported without results and never processed

**Location:** [matches-processor.ts:160](../../src/lib/matches-processor.ts#L160).

Fetching today's fixtures after a game ends inserts `status=finished` but does not copy its result scores or call result processing. The result-fetch query excludes finished matches, and chain registration excludes past kickoffs. This leaves a finished match with null results and no normal recovery path; Champion Bonus awards for it are also absent.

**Fix:** Immediately process finished imports, or enqueue them explicitly as unfinished result work and include them in the recovery query.

### 9. [P2] Thirty stale matches can permanently starve result fetching

**Location:** [results-processor.ts:340](../../src/lib/results-processor.ts#L340).

The fetch selects the oldest 30 unfinished rows before excluding custom matches, inactive leagues, missing provider fixtures, or games that remain postponed. Those rows stay eligible. Once 30 such rows accumulate, every run selects the same set and newer completed matches are never visited.

**Fix:** Exclude known ineligible rows in SQL and paginate the remaining candidates. Track retry scheduling/terminal provider states so permanently unresolved rows cannot occupy the entire batch.

### 10. [P2] Custom matches created during an active season have no season

**Location:** [matches-processor.ts:308](../../src/lib/matches-processor.ts#L308).

`createCustomMatch` omits `seasonId`, while imported matches set the active season. Predictions on custom matches can be scored, but the active-season leaderboard and season standings filter them out. Users see points on the match without receiving them in the season competition until an administrator manually retro-assigns.

**Fix:** Apply the same season-assignment policy to custom and imported matches at creation.

### 11. [P2] Leaderboard truncation discards real points before bonus ranking

**Location:** [prediction-repository.ts:43](../../src/lib/repositories/prediction-repository.ts#L43).

Prediction totals are limited to 100 users before Champion Bonus totals are merged. A user below the prediction-only cutoff can become a final leader through bonus points, but is reintroduced as a bonus-only entry with their prediction points/count set to zero. In groups larger than 100, omitted group members likewise appear with zero prediction points. Email group tables also reuse this limited query.

**Fix:** Aggregate all eligible users and combine bonus totals before applying any display limit. Preserve complete totals for explicitly requested group members.

### 12. [P2] Final group standings use different eligibility rules from the live leaderboard

**Location:** [season-service.ts:249](../../src/lib/services/season-service.ts#L249); compare [leaderboard-service.ts:52](../../src/lib/services/leaderboard-service.ts#L52).

The live leaderboard counts only matches after a non-default group's creation. Season finalization computes each user's entire season total once and filters that total by group membership, ignoring group creation time. A group created mid-season can announce a different winner at season end because earlier prediction and bonus points suddenly count.

**Fix:** Share the same group/date/season eligibility logic between live leaderboards and recorded standings, including Champion Bonus filters.

### 13. [P2] Concurrent activation can create multiple active seasons

**Location:** [season-service.ts:109](../../src/lib/services/season-service.ts#L109).

Activation checks for an active season and updates the draft in separate operations. Two requests activating different drafts can both observe no active season and both succeed. There is no schema constraint limiting ACTIVE rows. Subsequent `findFirst` calls can choose different seasons for ingestion, picks, and leaderboards.

**Fix:** Enforce the single-active-season invariant in PostgreSQL, and make activation plus relevant assignment work transactional with appropriate conflict handling.

### 14. [P2] A Champion Bonus pick can be written after picks lock

**Location:** [champion-bonus-service.ts:271](../../src/lib/services/champion-bonus-service.ts#L271).

`setPick` reads OPEN status and the allowed teams, then writes the pick separately. An admin lock can commit between those operations, after which the pending user request still inserts or changes a pick. Team removal has the same stale-validation window: a pick can be inserted after the removal transaction deletes existing picks for that team.

**Fix:** Serialize pick writes with lock/team changes on the same configuration row, or use an equivalent transactional conditional-write design. An ordinary transaction without a shared locking/conflict strategy is insufficient.

### 15. [P2] Lifecycle notifications run outside the request lifetime

**Location:** [champion-bonus-service.ts:489](../../src/lib/services/champion-bonus-service.ts#L489); also [matches-processor.ts:336](../../src/lib/matches-processor.ts#L336).

Champion Bonus enable/lock/cancel starts an unawaited async function; custom-match creation similarly ignores its notification promise. On the documented serverless deployment, returning a response does not ensure those promises complete. Successful admin actions can therefore deliver only some notifications, or none, with no durable retry record.

**Fix:** Use a durable notification job/outbox. For bounded best-effort work, the installed Next.js version documents `after` as the supported post-response lifetime mechanism.

### 16. [P2] One email failure suppresses other users' emails and all push delivery

**Locations:** [results-processor.ts:536](../../src/lib/results-processor.ts#L536), [matches-processor.ts:228](../../src/lib/matches-processor.ts#L228).

The recipient loop and subsequent FCM dispatch share one outer try/catch. If one SMTP send rejects, the loop exits before later recipients and before any push sends, including users with no email notification preference. Results have already been marked processed, so the normal result workflow will not retry their notifications.

**Fix:** Isolate failures per recipient and dispatch push independently. Persist delivery state if notifications must survive retries and process termination.

### 17. [P2] Push notifications fail for every recipient above 500 device tokens

**Location:** [fcm.ts:42](../../src/lib/fcm.ts#L42).

The helper passes every selected device token into one `sendEachForMulticast` request. The installed Firebase Admin SDK explicitly rejects arrays longer than 500. At 501 tokens, a broadcast fails before delivering to any recipient. Multiple devices per user count separately.

**Fix:** Chunk tokens into batches of at most 500, combine per-token results, and retain stale-token cleanup across batches. This threshold was verified in the installed SDK implementation.

### 18. [P2] Retro-assignment can attach new matches to an ended season

**Location:** [season-service.ts:143](../../src/lib/services/season-service.ts#L143).

`retroAssign` rejects only DRAFT seasons. For an ENDED season, the assignment query uses `kickoffTime >= startDate` with no end bound. Calling it after the season ends can claim unassigned matches from the following off-season or future dates. Recorded season standings are not rebuilt, so historical match membership and the final snapshot diverge.

**Fix:** Reject retro-assignment for ended seasons or strictly bound it to the season's defined interval and explicitly reconcile the frozen records.

## Validation and limitations

- Isolated execution of actual source functions confirmed findings 1, 4, and 5 with mocked repositories/external dependencies. No upstream services or databases were contacted.
- `npx tsc --noEmit --incremental false` failed on two stale `.next/dev/types/validator.ts` imports for removed web/mobile `h2h` routes. A separate TypeScript compiler-API check excluding generated `.next` root files passed with zero diagnostics across 236 source root files. The generated-file failure is not presented as a current source defect.
- Backend ESLint covered 147 files: 30 errors across 22 files, all `@typescript-eslint/no-explicit-any`; zero warnings. These are maintenance/check failures, separate from the behavioral findings above.
- The existing integration suite contains 19 Champion Bonus tests. It was not run because its configured target and migration-before-validation behavior did not establish safe database isolation. The production build was also not run because the build script executes migrations.
- Installed Next.js `after` documentation and Firebase Admin's multicast implementation were consulted locally. No dependency-vulnerability scan or deployed infrastructure audit was performed.
- The global odds switch is currently disabled. Findings that mention future odds behavior are explicitly conditional; the main recalculation defect reproduces with odds disabled.

## Suggested repair order

1. Close the cron bypass, enforce session revocation/current admin roles, protect both login entry points, and isolate the test database.
2. Consolidate scoring and make result processing recoverable; then reconcile existing fixtures and finished imports.
3. Make season/pick transitions atomic and align ranking/season eligibility rules.
4. Move notifications onto durable jobs, isolate delivery failures, and batch FCM requests.
5. Add focused regression coverage for the reported triggers, then clean up the 30 lint errors.
