import type { IFootballProvider } from './types';
import { FootballDataProvider } from './providers/football-data';
import { ApiFootballProvider } from './providers/api-football';
import { TheSportsDBProvider } from './providers/thesportsdb';
import { MockFootballProvider } from './providers/mock';

// Module-level singleton — one provider instance per serverless cold start.
// Set FOOTBALL_PROVIDER env var to switch integrations without touching service code.
// Supported values: "football-data" (default), "api-football", "thesportsdb", "mock" (tests / local dev without an API key)
let _instance: IFootballProvider | null = null;

export function getFootballProvider(): IFootballProvider {
  if (_instance) return _instance;

  const name = process.env.FOOTBALL_PROVIDER ?? 'football-data';
  switch (name) {
    case 'football-data':
      _instance = new FootballDataProvider();
      break;
    case 'api-football':
      _instance = new ApiFootballProvider();
      break;
    case 'thesportsdb':
      _instance = new TheSportsDBProvider();
      break;
    case 'mock':
      _instance = new MockFootballProvider();
      break;
    default:
      throw new Error(
        `Unknown FOOTBALL_PROVIDER: "${name}". Supported values: "football-data", "api-football", "thesportsdb", "mock"`,
      );
  }
  return _instance;
}
