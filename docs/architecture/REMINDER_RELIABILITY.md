# Reminder reliability and rollout

## Business rules

| Policy | Audience | Time |
| --- | --- | --- |
| Prediction pre-kickoff | All users with a notification email or registered device | Kickoff minus 60 minutes |
| Followed match pre-kickoff | Same user selected both teams in the same eligible league | Kickoff minus 60 minutes |
| Followed match kickoff | Same user selected both teams in the same eligible league | Kickoff |
| Missing prediction digest | Users missing a prediction on prediction-enabled matches only | Existing daily/weekly invocation |

Prediction submission does not affect pre-kickoff eligibility. The first two policies overlap: the audience is a union, not two sends. Kickoff alerts remain opt-in even for prediction-enabled fixtures. Clearing followed teams does not disable automatic prediction-game reminders.

## Boundaries and persistence

- `policy.ts` and `prediction-digest.ts`: timing and prediction eligibility rules.
- `subscriptions.ts` / `audience.ts`: read-only subscription and recipient resolution.
- `services/reminder-service.ts`: preference validation and atomic preference/outbox writes.
- `reminder-fixture-refresh.ts`: imports subscribed fixtures and refreshes stored fixture facts without changing prediction eligibility, announcing games or starting live-goal notifications.
- `planner.ts`: creates durable schedules and publishes their IDs.
- `worker.ts`: bounded delivery batches, atomic lease claims, recipient revalidation and per-target outcomes.
- `outbox.ts` / `reconcile.ts`: recovery, coalesced refreshes and periodic fixture synchronization.
- `match-reminder-service.ts`: compatibility with pre-refactor callers/messages only.

`ReminderJob` has a unique `(matchId, kickoffTime, kind)` key. `ReminderDelivery` has a unique `(jobId, userId, channel, targetKey)` key; email targets use the user ID and push targets use the device record ID. No raw email address or device token is stored in these ledger keys.

The refresh outbox has a revision and completed revision per league. Completing revision N cannot discard a newer preference save N+1. Publication failures leave durable work for reconciliation. A changed kickoff invalidates old jobs; reinstating the original future kickoff can re-arm a superseded job without erasing accepted delivery records.

Normal prediction imports can promote reminder-only games and announce that promotion. A reminder refresh cannot demote or promote a prediction game. Live/finished result transitions remain owned by result processing rather than reminder ingestion.

## Delivery semantics and limits

QStash is transport, not the duplicate-delivery ledger. Its time-limited deduplication is only an optimization. Multiple callbacks compete using atomic database claims; an unexpired claim cannot be taken by another worker. Accepted targets are not intentionally resent.

**This is not an exactly-once provider guarantee.** If SMTP/FCM accepts a request and the process dies before recording acceptance, recovery cannot distinguish that from a failed send. An expired lease may therefore retry an already-accepted message. Provider-level idempotency or client deduplication would be needed to eliminate this ambiguity. `accepted` means the provider accepted the request, not that the user saw it.

Workers process 10 targets per request with concurrency 5, a two-minute claim lease and up to five attempts. Remaining work gets a continuation. Transient failures back off; invalid/unregistered devices become terminal failures. Push broadcasts elsewhere in the application are split into batches of at most 500 devices. Reminder email and push are independent delivery targets.

Jobs expire five minutes after their nominal reminder time. This intentionally favors avoiding stale notifications over sending very late reminders. New subscriptions after the nominal time do not replay that reminder. Large audiences, slow providers or prolonged outages can exhaust this window: monitor overdue/expired jobs and capacity-test the expected peak before rollout.

The global `match-reminders` QStash flow-control parallelism is 3. The every-minute recovery route processes pending publication and outbox work. Fixture facts are refreshed approximately hourly and on preference saves; updates are not real-time provider webhooks. Missing date-window fixtures are checked by external ID to detect rescheduling beyond the window.

## Deployment checklist — required

1. Require the `Reminder reliability` workflow to pass on native PostgreSQL before merging. It applies all migrations, runs unit and database integration tests, and checks TypeScript. It uses a disposable localhost database ending in `_test`; it needs no production credentials.
2. Apply additive migration `20260909190000_durable_reminder_delivery` using the existing migration-deploy process before the new server code handles requests. It creates three tables and indexes; it does not delete matches, predictions or preferences.
3. Deploy the server code, then run `npm run setup-qstash-schedules` with the existing deployment's QStash and URL configuration. This adds `predictions-reminder-reconcile` every minute. **The new scheduler depends on this schedule; do not omit this step.** Use a release window away from important kickoffs.
4. Confirm a successful `/api/cron/reminder-reconcile` invocation and inspect `/admin/reminders` (or `/api/admin/reminder-health`). Existing upcoming fixtures, including custom games, should acquire jobs. A new plan deliberately does not replay a nominal time that already passed during deployment.
5. Old external-ID messages remain accepted by the webhook but only resolve already-planned jobs. Do not replay completed historical reminders. Ensure the reconciliation pass completes before the next important 60-minute slot.
6. Test on staging with consenting test recipients: one prediction game, one followed-team-only game, overlapping audiences, a custom fixture, a cancellation, rescheduling, an email failure and a device failure. Verify provider receipts separately from queue HTTP status.
7. Publish the mobile copy update through the normal app-release process; it is explanatory only and old clients remain API-compatible.

No new secrets are required. Do not run the build script against production merely to type-check; it runs migrations. Local safe checks are `npm run test:unit`, `npx tsc --noEmit`, and the targeted integration command in CI.

## Operations and rollback

`/admin/reminders` is read-only and reports aggregate job/delivery states, overdue work, recent job errors, and refresh revisions. Investigate `expired`, `failed`, growing overdue counts, and outbox revisions that stop advancing. Inspect per-target records when troubleshooting partial acceptance; do not label queued/HTTP-200 work as device-delivered.

Pause the new reconciliation schedule and reminder publication before an emergency code rollback. Do not drop the ledger tables or remove their migration. Old application code does not enforce the new ledger and can resend legacy notifications, so avoid rolling back into active reminder windows. Prefer a forward fix. Retain records through the operational audit window; any future retention policy must keep deduplication records longer than the maximum broker replay period.

## Validation scope

Regression coverage includes policy separation, custom games, concurrent planning/callbacks, partial email/device failures, expired leases, outbox publication failure, concurrent preference revisions, rescheduling, repeated callbacks, audience batching and digest exclusions. Native PostgreSQL CI is the release gate. Local SMTP/FCM and production QStash delivery have not been exercised by the automated tests.
