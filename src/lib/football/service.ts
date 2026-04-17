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
  return getFootballProvider().fetchFixtureById(fixtureId);
}

export function fetchStandings(leagueId: number): Promise<{ season: number; standings: APIStandingEntry[] }> {
  return getFootballProvider().fetchStandings(leagueId);
}

export function fetchHeadToHead(matchId: number, limit = 5): Promise<APIFixture[]> {
  return getFootballProvider().fetchHeadToHead(matchId, limit);
}
