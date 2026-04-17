import type { IFootballProvider } from './types';
import { FootballDataProvider } from './providers/football-data';

// Module-level singleton — one provider instance per serverless cold start.
// Set FOOTBALL_PROVIDER env var to switch integrations without touching service code.
// Supported values: "football-data" (default)
let _instance: IFootballProvider | null = null;

export function getFootballProvider(): IFootballProvider {
  if (_instance) return _instance;

  const name = process.env.FOOTBALL_PROVIDER ?? 'football-data';
  switch (name) {
    case 'football-data':
      _instance = new FootballDataProvider();
      break;
    default:
      throw new Error(
        `Unknown FOOTBALL_PROVIDER: "${name}". Supported values: "football-data"`,
      );
  }
  return _instance;
}
