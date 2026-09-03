import type {
  IFootballProvider,
  APILeague,
  APIFixture,
  APITeam,
  APIStandingEntry,
} from '../types';

/**
 * In-memory football provider for tests and local dev without an API key.
 * Register via `FOOTBALL_PROVIDER=mock`. Fixtures are set with `setMockFixtures()`
 * and cleared with `clearMock()` — `processMatchResults()` runs completely
 * unchanged against this provider since it only calls `fetchFixtures()`.
 */
let fixtures: APIFixture[] = [];

export function setMockFixtures(next: APIFixture[]): void {
  fixtures = next;
}

export function clearMock(): void {
  fixtures = [];
}

export class MockFootballProvider implements IFootballProvider {
  async fetchLeagues(): Promise<APILeague[]> {
    return [];
  }

  async fetchTeams(): Promise<APITeam[]> {
    return [];
  }

  async fetchFixtures(params: { league: number; season: number; from?: string; to?: string; date?: string }): Promise<APIFixture[]> {
    return fixtures.filter(f => f.league.id === params.league);
  }

  async fetchFixtureById(fixtureId: number): Promise<APIFixture | null> {
    return fixtures.find(f => f.fixture.id === fixtureId) ?? null;
  }

  async fetchStandings(): Promise<{ season: number; standings: APIStandingEntry[] }> {
    return { season: 0, standings: [] };
  }

  async fetchTeamForm(): Promise<APIFixture[]> {
    return [];
  }
}
