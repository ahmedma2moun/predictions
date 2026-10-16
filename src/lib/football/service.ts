/**
 * Football external service layer.
 * All application code imports from here — never from a provider directly.
 * Switching providers only requires: implement IFootballProvider, register in factory.ts,
 * set FOOTBALL_PROVIDER env var. This file and every caller stay unchanged.
 */

export type { APILeague, APIFixture, APITeam, APIStandingEntry, IFootballProvider } from './types';
export { mapFixtureStatus } from './types';

import { getFootballProvider } from './factory';
import type { APILeague, APIFixture, APITeam, APIStandingEntry } from './types';
import { logger } from '@/lib/logger';

// ── Outage guard for user-facing reads ───────────────────────────────────────
// Live scores, standings and team form are enhancements. If the provider is down
// they must fail fast (callers already degrade to cached/empty data) instead of
// hanging page renders. After FAILURE_THRESHOLD consecutive failures the circuit
// opens and upstream calls are skipped for OPEN_MS.
const USER_CALL_TIMEOUT_MS = 10_000;
const FAILURE_THRESHOLD = 3;
const OPEN_MS = 60_000;
let consecutiveFailures = 0;
let openUntil = 0;

async function guarded<T>(label: string, call: () => Promise<T>): Promise<T> {
  if (Date.now() < openUntil) throw new Error(`football provider unavailable (circuit open): ${label}`);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      call(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`football provider timeout: ${label}`)), USER_CALL_TIMEOUT_MS);
      }),
    ]);
    consecutiveFailures = 0;
    return result;
  } catch (e) {
    if (++consecutiveFailures >= FAILURE_THRESHOLD) {
      openUntil = Date.now() + OPEN_MS;
      logger.warn('[football] circuit opened — provider failing, skipping upstream calls', { label, seconds: OPEN_MS / 1000 });
    }
    throw e;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// Short-lived shared cache for single-fixture lookups (used for live-score polling).
// Collapses many concurrent viewers of the same live match into one upstream call —
// the free-tier providers cap requests at ~10/min, shared across the whole app.
const FIXTURE_CACHE_TTL_MS = 30_000;
const fixtureCache = new Map<number, { promise: Promise<APIFixture | null>; expiresAt: number }>();

export function fetchLeagues(): Promise<APILeague[]> {
  return getFootballProvider().fetchLeagues();
}

export function fetchTeams(leagueId: number, season: number): Promise<APITeam[]> {
  return getFootballProvider().fetchTeams(leagueId, season);
}

export function fetchFixtures(params: {
  league: number;
  season: number;
  from?: string;
  to?: string;
  date?: string;
}): Promise<APIFixture[]> {
  return getFootballProvider().fetchFixtures(params);
}

export function fetchFixtureById(fixtureId: number): Promise<APIFixture | null> {
  const now = Date.now();
  const cached = fixtureCache.get(fixtureId);
  if (cached && cached.expiresAt > now) return cached.promise;

  const promise = guarded('fixture', () => getFootballProvider().fetchFixtureById(fixtureId));
  fixtureCache.set(fixtureId, { promise, expiresAt: now + FIXTURE_CACHE_TTL_MS });
  // Don't cache failures — let the next call retry immediately.
  promise.catch(() => fixtureCache.delete(fixtureId));
  return promise;
}

export function fetchStandings(leagueId: number): Promise<{ season: number; standings: APIStandingEntry[] }> {
  return guarded('standings', () => getFootballProvider().fetchStandings(leagueId));
}

export function fetchTeamForm(teamId: number, limit = 5): Promise<APIFixture[]> {
  return guarded('form', () => getFootballProvider().fetchTeamForm(teamId, limit));
}
