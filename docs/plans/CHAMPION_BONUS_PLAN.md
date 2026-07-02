# Champion Bonus Feature — Implementation Plan

## Context

Add a "Champion Bonus" mini-game. Per season, the admin enables the feature on **exactly one league**, selects a subset of that league's teams (choosing from ALL league teams), and users pick one allowed team from a new tab (web + mobile). The admin later **locks** selections; from then on every game the picked team **plays** doubles the potential bonus, and the bonus is awarded whenever the team **wins** (penalty-shootout wins count). Formula: for the team's Nth counted game after lock (N = 1, 2, 3…), a win awards `2^N` points; draws/losses award 0 but still advance N. Bonus points are added to the main leaderboard and season standings as a **separate additive term**. The admin can **cancel** at any time, deleting all bonus data and reverting the leaderboard.

Decisions confirmed with the user:
- Bonus counts toward leaderboard + season standings (additive term).
- Bonus doubles per game **played** (awarded only on wins).
- Only matches kicking off **after the lock timestamp** count.
- **Penalty wins count** → use `Match.resultWinner` (which records penalty winners), not the full-time-only `scoringWinner`.

## End-to-end flow (who selects what)

1. **Admin enables** (seasons admin page): chooses the league from a dropdown → a checkbox grid of **ALL** that league's teams appears → admin checks the subset users may choose from → Save (`POST /api/admin/seasons/[id]/champion-bonus`). This stores the allowed teams (`ChampionBonusTeam` rows).
2. **User picks** (new "Champion" tab, web + mobile): while status is OPEN, the tab shows **only the admin-allowed teams** as tappable cards (logo + name). Tapping a card picks that team (`POST /api/champion-bonus/pick` → upserts the user's `ChampionBonusPick`). The current pick is highlighted; tapping another card switches the pick (confirm dialog) — allowed until the admin locks.
3. **Admin locks** → users can no longer pick/change; the tab flips to the reveal view (everyone's picks + expandable per-game bonus breakdown). Games kicking off after the lock start counting toward the bonus.
4. **Admin cancels** (any time) → all picks/awards deleted, leaderboard reverts, tab shows "not enabled".
5. **Notifications**: every Champion Bonus event (enabled, locked, bonus win, cancelled) goes out as BOTH a push notification and an email (see §7a).

## Key design decisions (grounded in the codebase)

- **Separate tables, never `Prediction.pointsAwarded`**: admin `recalculateAllScores()` (`src/lib/services/prediction-service.ts:272`) overwrites `pointsAwarded`, and leaderboard accuracy (`src/lib/services/leaderboard-service.ts:142`) assumes points come only from match scoring.
- **A `ChampionBonus` aggregate, not fields on Season**: `seasonId @unique` enforces one league per season; **cancel = one cascading delete** (no CANCELLED status — dead configs are gone, so no query path ever needs to filter them out); re-enable after cancel is a fresh insert.
- **Awards stored per (config, team, match)** — ONE row per counted game of each allowed team (`gameNumber`, `isWin`, `points`). User totals join `pick.teamId = award.teamId`, so 50 users on the same team share the same award rows (no users × games explosion), the expandable UI reads the breakdown straight from the table, and recompute is a per-team delete+insert.
- **Recompute-from-scratch idempotency**: on every relevant finished/corrected match, rebuild the whole ledger for the affected team(s) ordered by `(kickoffTime asc, id asc)` — deterministic `gameNumber` regardless of result arrival order; double-processing and corrections are harmless.

## 1. Prisma schema (`prisma/schema.prisma`)

```prisma
enum ChampionBonusStatus {
  OPEN     // picks editable
  LOCKED   // picks frozen, awards accruing
}

model ChampionBonus {
  id        Int                 @id @default(autoincrement())
  seasonId  Int                 @unique          // one config (one league) per season
  season    Season              @relation(fields: [seasonId], references: [id], onDelete: Cascade)
  leagueId  Int
  league    League              @relation(fields: [leagueId], references: [id], onDelete: Cascade)
  status    ChampionBonusStatus @default(OPEN)
  lockedAt  DateTime?
  createdAt DateTime            @default(now())
  updatedAt DateTime            @updatedAt
  teams     ChampionBonusTeam[]
  picks     ChampionBonusPick[]
  awards    ChampionBonusAward[]
}

model ChampionBonusTeam {          // admin-selected allowed subset
  id              Int           @id @default(autoincrement())
  championBonusId Int
  championBonus   ChampionBonus @relation(fields: [championBonusId], references: [id], onDelete: Cascade)
  teamId          Int
  team            Team          @relation(fields: [teamId], references: [id], onDelete: Cascade)

  @@unique([championBonusId, teamId])
}

model ChampionBonusPick {
  id              Int           @id @default(autoincrement())
  championBonusId Int
  championBonus   ChampionBonus @relation(fields: [championBonusId], references: [id], onDelete: Cascade)
  userId          Int
  user            User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  teamId          Int
  team            Team          @relation(fields: [teamId], references: [id], onDelete: Cascade)
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  @@unique([championBonusId, userId])   // one pick per user
  @@index([championBonusId, teamId])
}

model ChampionBonusAward {            // ONE row per (team, counted match) — not per user
  id              Int           @id @default(autoincrement())
  championBonusId Int
  championBonus   ChampionBonus @relation(fields: [championBonusId], references: [id], onDelete: Cascade)
  teamId          Int
  team            Team          @relation(fields: [teamId], references: [id], onDelete: Cascade)
  matchId         Int
  match           Match         @relation(fields: [matchId], references: [id], onDelete: Cascade)
  gameNumber      Int           // Nth counted game since lock, 1-based
  isWin           Boolean       // based on resultWinner (penalty wins count)
  points          Int           // isWin ? 2^min(gameNumber, 20) : 0   (cap prevents Int overflow)

  @@unique([championBonusId, teamId, matchId])
  @@index([championBonusId, teamId])
}
```

Back-relations on `Season` (`championBonus ChampionBonus?`), `League`, `Team`, `User`, `Match`.

Migration: `npx prisma migrate dev --name add_champion_bonus` (follow the `/db` skill workflow).

## 2. Repository + service

**New `src/lib/repositories/champion-bonus-repository.ts`** — thin Prisma wrappers in `PredictionRepository` style: `findConfigBySeasonId`, `createConfig`, `updateConfig`, `deleteConfig`, `createTeams`/`deleteTeamsNotIn`, `upsertPick`, `deletePicksForTeams`, `findPicks`, `deleteAwardsForTeam`, `createAwards`, `findAwards`, `getBonusStats` (raw SQL, see §3), `transaction`.

**New `src/lib/services/champion-bonus-service.ts`** — all business logic:

- `enable(seasonId, leagueId, teamIds[])` — guards: season exists && not ENDED; no existing config (unique seasonId → to switch league, cancel first); every teamId has a `TeamLeague` row for leagueId; `teamIds.length >= 2`.
- `updateTeams(seasonId, teamIds[])` — OPEN only. Transaction: replace team set + `deletePicksForTeams` for removed teams (those users must re-pick).
- `lock(seasonId)` — OPEN → `{ status: 'LOCKED', lockedAt: now }`.
- `cancel(seasonId)` — `deleteConfig`; cascade removes teams/picks/awards → leaderboard reverts by construction.
- `getAdminState(seasonId)` — config + league, allowed teams (name/logo via Team relation), pick count, status, lockedAt.
- `getUserState(userId)` — resolves active season → config. Discriminated result: `{ enabled: false }` | OPEN: `{ league, allowedTeams, myPick }` | LOCKED: `{ league, lockedAt, myPick, picks: [{userId, name, avatarUrl, teamId, totalBonus}], teams: { [teamId]: { name, logo, awards: [{opponentName, homeAway, score, kickoffTime, gameNumber, isWin, points}], totalPoints, nextWinPoints /* 2^(lastGameNumber+1) */ } } }`. **One payload — expansion is purely client-side** (awards are per-team, so the payload stays small; no lazy per-row fetch needed).
- `setPick(userId, teamId)` — guards: config exists, `status === OPEN`, season ACTIVE, teamId in allowed set. Upsert on `[championBonusId, userId]`.
- `processFinishedMatch(match)` — no-op unless a LOCKED config matches `seasonId`, `league.externalId === match.externalLeagueId`, and `kickoffTime > lockedAt`. For each allowed team whose `team.externalId ∈ {homeTeamExtId, awayTeamExtId}` (possibly BOTH), run `recomputeTeamAwards`.
- `recomputeSeason(seasonId)` — recompute every allowed team; safety-net for result resets.
- Internal `recomputeTeamAwards(config, teamId)`:
  1. Fetch team → `externalId`.
  2. `Match.findMany({ status: 'finished', resultWinner: { not: null }, seasonId, externalLeagueId, kickoffTime: { gt: lockedAt }, OR: [{homeTeamExtId}, {awayTeamExtId}] }, orderBy: [{kickoffTime:'asc'},{id:'asc'}])`.
  3. Map to rows: `gameNumber = i+1`; `isWin = (resultWinner==='home' && homeTeamExtId===extId) || (resultWinner==='away' && awayTeamExtId===extId)`; `points = isWin ? 2**Math.min(n,20) : 0`.
  4. Transaction: `deleteAwardsForTeam` + `createAwards`.

## 3. Scoring pipeline integration

| File | Change |
|---|---|
| `src/lib/results-processor.ts` — `processMatchResults()` | After the result is saved (~line 333) and **BEFORE** the `if (updatedMatch.scoresProcessed) continue` check (line 336): `await ChampionBonusService.processFinishedMatch(updatedMatch).catch(log)`. Placement matters: bonus must accrue even for matches with zero predictions or already-scored matches. |
| `src/lib/results-processor.ts` — `correctMatchResult()` | Same call after `scoresProcessed: true` (~line 146) — a correction can flip `resultWinner`; recompute rebuilds both teams' ledgers. |
| `src/app/api/admin/recalculate/route.ts` | Also call `recomputeSeason(activeSeasonId)` — catch-all for result resets/edge cases. |
| `src/lib/services/leaderboard-service.ts` — `getLeaderboard()` | Parallel bonus query (below) reusing the same match `whereClause` (lines 61–78, minus the `p."userId"` condition — apply `userIdFilter` on `cbp."userId"` instead). Merge: `totalPoints += bonus`; expose `championBonusPoints` on `LeaderboardEntry`; **accuracy keeps using pre-bonus points**; add bonus-only users (picked, zero predictions) to `allUserIds` like the existing backfill at lines 148–167; **re-sort by final `totalPoints` desc** (the SQL ORDER BY no longer decides). |
| `src/lib/services/season-service.ts` — `buildStandingsData()` (line 177) | After `statMap` is built, add per-user bonus for the season into `totalPoints` before sorting → season-end preview, `recordFinalStandings`, and badges all include the bonus automatically. |

Bonus SQL (in the repository):
```sql
SELECT cbp."userId", SUM(cba.points)::int AS bonus
FROM "ChampionBonusPick" cbp
JOIN "ChampionBonusAward" cba
  ON cba."championBonusId" = cbp."championBonusId" AND cba."teamId" = cbp."teamId"
JOIN "Match" m ON m.id = cba."matchId"
WHERE <match conditions> GROUP BY cbp."userId"
```
Joining the award's match makes league/season/date filters behave consistently with prediction points.

## 4. API routes

Guards per existing patterns: admin = `auth()` + `isSessionAdmin`; web user = `auth()`; mobile = `getMobileSession(req)`. Handlers stay thin (auth → service → serialize, ids `.toString()`).

| Route | Method | Action |
|---|---|---|
| `/api/admin/seasons/[id]/champion-bonus` | GET | `getAdminState` (or `{enabled:false}`) |
| `/api/admin/seasons/[id]/champion-bonus` | POST `{leagueId, teamIds[]}` | `enable` |
| `/api/admin/seasons/[id]/champion-bonus` | PATCH `{teamIds[]}` | `updateTeams` |
| `/api/admin/seasons/[id]/champion-bonus/lock` | POST | `lock` |
| `/api/admin/seasons/[id]/champion-bonus` | DELETE | `cancel` (UI confirms) |
| `/api/champion-bonus` | GET | `getUserState` |
| `/api/champion-bonus/pick` | POST `{teamId}` | `setPick` (400/409 when locked or team not allowed) |
| `/api/mobile/champion-bonus` | GET | same as web GET, mobile auth |
| `/api/mobile/champion-bonus/pick` | POST | same as web pick, mobile auth |

**No new team-listing route needed**: the admin team picker reuses `GET /api/admin/teams?leagueId=` — verified `TeamService.getByLeagueId` returns ALL league teams (no `isActive` filter; the flag is just returned), and `GET /api/admin/leagues` feeds the league dropdown.

## 5. Web UI

**Navbar** — `src/components/Navbar.tsx`: add `{ href: "/champion", label: "Champion", icon: Crown }` (lucide) to `navItems` (one array feeds both desktop top bar and mobile bottom bar).

**User tab** — new `src/app/(app)/champion/{page.tsx, ChampionClient.tsx, useChampionBonus.ts}` (hook fetches `/api/champion-bonus`, Skeleton loading like `useLeaderboard.ts`). Three states:
1. **Not enabled**: friendly empty-state card + short rules explainer.
2. **OPEN**: banner "Picks are open — the admin can lock at any time" (+ "N players have picked"); grid of allowed team cards (logo + name), current pick highlighted with a check; first pick = single tap, changing an existing pick = confirm dialog ("Switch from Arsenal to Liverpool?").
3. **LOCKED (reveal)**: banner with league + lock date; "Your champion" summary card (games, wins, total, "next win = X pts"); below, all users' picks sorted by `totalBonus`, each row expandable using the leaderboard page's manual pattern (`expandedUserId` state + `ChevronDown/Up` — no accordion component exists). Expanded: per-game tiles `Game N · vs Opponent · 2–1 · +2^N pts` (0-pt draws/losses muted/struck so wins pop) + total. All data comes from the single GET — no lazy fetches.

**Admin** — extend `src/app/(app)/admin/seasons/SeasonsAdminClient.tsx` with a "Champion Bonus" block inside each non-ENDED season card:
- No config: "Set up Champion Bonus" → modal with league `<select>` (from `/api/admin/leagues`), then checkbox grid of ALL teams from `/api/admin/teams?leagueId=` (logos, search, select-all — mirror `admin/teams/page.tsx`) → POST.
- OPEN: status badge, allowed-team chips, pick count; buttons **Edit teams** (PATCH), **Lock picks** (confirm modal: "Users can no longer change picks; games from now on count"), **Cancel** (destructive modal: "Removes ALL bonus points from the leaderboard — deletes N picks / M points").
- LOCKED: lock date, picks summary (user → team → bonus so far), **Cancel** still available.
Reuse the existing hand-rolled modal + `notify()` toast idioms already in this file.

**Score breakdown display (web)**:
- **Leaderboard** — `src/app/(app)/leaderboard/page.tsx`: crown chip `+{championBonusPoints}` next to `totalPoints` when > 0; inside the expanded user row (above the `UserPredictionList` tiles), a "Champion Bonus" summary line: `👑 Champion Bonus (TeamName) · +N pts` so the total = predictions + bonus is explicit.
- **My Score page** — `src/app/(app)/predictions/page.tsx`: add a "Champion Bonus" line/stat (team, wins, +N pts) alongside the `AccuracyStatsCard`, sourced from the user's own bonus total (extend the page's data fetch or reuse `GET /api/champion-bonus`). Accuracy stats stay prediction-only.

## 6. Mobile UI (Expo)

- `mobile/app/(tabs)/_layout.tsx`: `<Tabs.Screen name="champion" options={{ title: 'Champion', tabBarIcon: Ionicons 'ribbon-outline' }} />`; `mobile/src/constants/routes.ts`: add `champion: '/(tabs)/champion'`.
- New `mobile/app/(tabs)/champion.tsx` + `mobile/src/hooks/useChampionBonus.ts` (`useRemoteData`-style wrapping `apiRequest('/api/mobile/champion-bonus', { token })` + `pick(teamId)` mutator that POSTs and refetches).
- Components `mobile/src/components/ChampionTeamCard.tsx` (Pressable pick card) and `ChampionRevealRow.tsx` (expandable, modeled on `LeaderboardRow.tsx` — Pressable + chevron; no ActivityIndicator needed since data arrives in the single GET).
- `LeaderboardRow.tsx`: bonus chip like web + "Champion Bonus" summary line in the expanded box; mobile My Score screen (`mobile/app/(tabs)/predictions.tsx`) gets the same bonus line as the web My Score page.

## 7a. Notifications (push + email, both channels for every event)

Reuse the exact `notifySeasonEnd` pattern (`src/lib/services/season-service.ts:324`): email every user with `notificationEmail` + `sendPushToUsers` to all device-token users; fired from the service method after the DB write, `.catch(log)` so notification failure never breaks the action.

| Event | Fired from | Push + email copy (new templates in `src/lib/email.ts`, style of `sendSeasonEndEmail`) |
|---|---|---|
| **Enabled** | `ChampionBonusService.enable()` | "Champion Bonus is live! Pick your champion from {league} before picks lock." (deep-link `data: { type: 'champion_bonus_enabled' }`) |
| **Locked** | `ChampionBonusService.lock()` | "Champion picks are locked — see who everyone chose! Every game your champion plays now counts." |
| **Bonus win** | `processFinishedMatch` when a new win award is created | To pickers of that team only: "{Team} won! You earned +X Champion Bonus points (next win = Y)." Guard: only notify for awards that are NEW wins (compare pre/post ledger during recompute) so corrections/reprocessing don't re-spam. |
| **Cancelled** | `ChampionBonusService.cancel()` | "Champion Bonus has been cancelled — bonus points were removed from the leaderboard." |

New email functions: `sendChampionBonusEnabledEmail`, `sendChampionBonusLockedEmail`, `sendChampionBonusWinEmail`, `sendChampionBonusCancelledEmail`.

## 7. UX suggestions

1. **Make the exponential ladder visible**: "Win 1 = 2 · Win 2 = 4 · Win 3 = 8 …" in the explainer, and "Next win = X pts" on the pick summary/expanded rows — the doubling is the hook; note that draws/losses still double the next stake (risk!).
2. **Pick privacy until lock**: while OPEN show only "N players have picked" (no names/teams) to avoid herding; the reveal at lock is the fun moment.
3. **Non-pickers after lock**: muted banner "You didn't pick a champion this time" above the reveal list — they can still browse.
4. **Destructive cancel modal in numbers**: "deletes N picks and removes M bonus points from the leaderboard".
5. **Notification deep links**: pushes carry `data: { type: 'champion_bonus_*' }` so the mobile app can navigate straight to the Champion tab (same pattern as `season_end`).
6. **Team logos everywhere** (picker, reveal rows, admin chips) — `Team.logo` already stored; optionally show current league position from `TeamStanding` on pick cards.
7. **Renumbering caveat in copy**: a postponed match finishing late can renumber later games (ledger is rebuilt by kickoff order) — one line of UI copy avoids confusion.

## 8. Edge cases handled

- **User never picks** → no pick row, no bonus term; read-only reveal view.
- **Cancel + re-enable** → cascade delete, then fresh insert (different league allowed).
- **Match corrected after award** → hook triggers per-team from-scratch recompute; `@@unique([championBonusId, teamId, matchId])` keeps it idempotent.
- **Team in cups/other leagues** → scoped by `externalLeagueId + seasonId + kickoffTime > lockedAt`.
- **Both allowed teams in one match** → both ledgers recomputed independently.
- **Result reset (removed result)** → `recomputeSeason` safety net on admin recalculate.
- **Season ends while enabled** → standings freeze bonus-inclusive totals; config stays as history; `setPick` guards on ACTIVE season.
- **Int overflow** → exponent capped at 20 (1,048,576 pts max per game).
- **Enable on ENDED season / double lock / pick after lock / disallowed team** → service guards return 400s.

## 9. E2E tests (new infra — project currently has zero tests)

**Stack** (per the project's `test` skill): Vitest + a dedicated test PostgreSQL database, exercising the real pipeline end-to-end (seed DB → run `processMatchResults` with a mocked football API → assert awards/leaderboard). Browser-level Playwright is explicitly out of scope for this feature (no auth/test-id infra exists); the suite below is service-level e2e over the real DB and real code paths.

**Setup**
- `npm i -D vitest`; `vitest.config.ts` (node environment, `@/` alias matching tsconfig); scripts `"test": "vitest run"`, `"test:watch": "vitest"`.
- `.env.test` with `DATABASE_URL`/`DIRECT_URL` → local test DB; `tests/helpers/db.ts` with `resetDb()` (TRUNCATE all tables) run in `beforeEach`; global setup runs `prisma migrate deploy`.
- **Football API mock = a real provider**: new `src/lib/football/providers/mock.ts` implementing `IFootballProvider`, registered in `src/lib/football/factory.ts` as `FOOTBALL_PROVIDER=mock`. Backed by an in-memory fixture store with test-facing setters (`setMockFixtures(fixtures)`, `clearMock()`), so `processMatchResults` → `fetchFixtures` runs completely unchanged. (Also handy for local dev without an API key.)
- Notification seams: `vi.mock` `src/lib/email.ts` and `src/lib/fcm.ts` in tests to capture calls (no real Gmail/FCM).

**Seed fixtures** — `tests/fixtures/seed.ts`, a composable builder mirroring `scripts/seed.ts` shapes:
- `seedScoringRules()` (same defaults as `scripts/seed.ts`)
- `seedLeague({ externalId, teams: 6 })` → League + Teams + TeamLeague rows
- `seedUsers(4)` + General group
- `seedActiveSeason()`
- `seedMatches(league, season, [{ home, away, kickoff, result? }])` → many matches spanning before/after lock, plus a second "cup" league's matches for scope tests
- `seedPredictions(user, matches, scores)`
- `seedChampionBonus({ season, league, allowedTeams, picks: { user → team }, locked? })`

**Test cases** — `tests/e2e/champion-bonus.test.ts` (+ `champion-bonus-api.test.ts`):
1. **Admin lifecycle**: enable stores config+teams; second enable on same season rejected (one league per season); enable on ENDED season rejected; `updateTeams` removing a picked team deletes that pick; lock sets `lockedAt`; double-lock rejected; cancel cascades (config/teams/picks/awards all gone).
2. **Pick guards**: pick while OPEN upserts; changing pick updates same row; pick after lock rejected; disallowed team rejected; pick with no config rejected.
3. **Exponential scoring over many matches** (the core case): user picks Team A; seed 6 Team A matches after lock with results W, D, W, L, W, W → run `processMatchResults` with mock fixtures → assert award rows `gameNumber 1..6` with points `2, 0, 8, 0, 32, 64` and user bonus total **106**. Also: matches kicking off **before** `lockedAt` excluded; Team A's matches in the other (cup) league excluded; a match with no result yet consumes no game number.
4. **Penalty win**: FT draw + penalty winner = picked team → `isWin: true`, points awarded (uses `resultWinner`).
5. **Idempotency & corrections**: run `processMatchResults` twice → identical ledger (no duplicate rows, unique constraint holds); `correctMatchResult` flipping game 1 from W to L → ledger rebuilt, later game numbers/points unchanged, total drops by exactly 2.
6. **Leaderboard integration**: users with predictions + bonus → `totalPoints` = prediction sum + bonus, `championBonusPoints` exposed, accuracy computed from prediction points only; bonus-only user (no predictions) appears; two users picking the same team both get the full bonus; after cancel, totals revert to prediction-only.
7. **Season standings**: `buildStandingsData` includes bonus; `recordFinalStandings` freezes bonus-inclusive totals.
8. **Notifications**: enable/lock/cancel each dispatch push + email (mocked capture); a processed win notifies only pickers of that team; reprocessing the same match does NOT re-send win notifications.
9. **API guards** (invoke route handlers directly with mocked `auth()` / mobile JWT): admin champion-bonus routes reject non-admin (401/403); user pick route rejects unauthenticated; mobile routes reject missing bearer token.

## 10. Implementation order

1. **Schema + migration** — `prisma/schema.prisma` (enum + 4 models + back-relations); `npx prisma migrate dev --name add_champion_bonus`.
2. **Repository** — `src/lib/repositories/champion-bonus-repository.ts`.
3. **Service** — `src/lib/services/champion-bonus-service.ts`.
4. **Scoring hooks** — `src/lib/results-processor.ts` (2 sites), `src/app/api/admin/recalculate/route.ts`.
5. **Leaderboard + standings** — `src/lib/services/leaderboard-service.ts`, `src/lib/services/season-service.ts`.
6. **Notifications** — 4 email templates in `src/lib/email.ts`, push+email dispatch helpers wired into `enable`/`lock`/`cancel`/`processFinishedMatch` (§7a).
7. **API routes** — admin (3 files under `src/app/api/admin/seasons/[id]/champion-bonus/`), web user (`src/app/api/champion-bonus/{route,pick/route}.ts`), mobile (`src/app/api/mobile/champion-bonus/{route,pick/route}.ts`).
8. **Admin UI** — `SeasonsAdminClient.tsx` (+ `page.tsx` if config embedded server-side).
9. **Web user UI** — `src/app/(app)/champion/*`, `Navbar.tsx`, leaderboard chip + expanded-row bonus line, My Score bonus line.
10. **Mobile** — `champion.tsx`, hook, 2 components, `_layout.tsx`, `routes.ts`, `LeaderboardRow` chip + bonus line, My Score bonus line.
11. **Test infra + e2e suite** (§9) — Vitest setup, test DB helpers, `src/lib/football/providers/mock.ts` + factory entry, `tests/fixtures/seed.ts`, `tests/e2e/champion-bonus*.test.ts`.
12. **Docs** (repo rule) — `docs/architecture/DATA_ARCHITECTURE.md`, `API_SPECIFICATIONS.md`, `SYSTEM_ARCHITECTURE.md` (+ note the new `FOOTBALL_PROVIDER=mock` value in the football provider docs).

## Verification

0. `npm test` — full e2e suite (§9) green against the test DB.
1. `npm run build` + `npm run lint` pass.
2. Local DB migrate + `npm run seed` + `npm run dev`.
3. **Admin flow**: create/activate season → enable on a league with a team subset → second enable rejected (one per season) → edit teams (verify removed team's picks deleted) → two test users pick/change picks → lock → pick endpoint now rejects.
4. **Scoring**: via admin results correction, finish a picked team's matches: win → award `gameNumber=1, points=2`; draw → `gameNumber=2, points=0`; win → `gameNumber=3, points=8`. Correct match 1 to a loss → ledger rebuilt, total drops by 2 only. Penalty case: level FT + penalty winner → counts as win.
5. **Leaderboard & breakdowns**: totals include bonus, `championBonusPoints` chip shows, expanded row and My Score show the "Champion Bonus" line, accuracy % unchanged, bonus-only user appears.
5a. **Notifications**: enable/lock/cancel each trigger push + email (check logs/test inbox via existing Gmail config); a bonus win triggers the win notification only for pickers of that team, and reprocessing the same match doesn't re-send it.
6. **Cancel**: config/picks/awards gone, leaderboard reverts, tab shows "not enabled"; re-enable works.
7. **Season end**: preview + final standings include bonus.
8. **Mobile**: Expo app renders all three tab states against the dev API; pick + reveal flows work.
