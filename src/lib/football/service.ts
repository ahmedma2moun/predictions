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

  const promise = getFootballProvider().fetchFixtureById(fixtureId);
  fixtureCache.set(fixtureId, { promise, expiresAt: now + FIXTURE_CACHE_TTL_MS });
  // Don't cache failures — let the next call retry immediately.
  promise.catch(() => fixtureCache.delete(fixtureId));
  return promise;
}

export function fetchStandings(leagueId: number): Promise<{ season: number; standings: APIStandingEntry[] }> {
  return getFootballProvider().fetchStandings(leagueId);
}

export function fetchHeadToHead(matchId: number, limit = 5): Promise<APIFixture[]> {
  return getFootballProvider().fetchHeadToHead(matchId, limit);
}
