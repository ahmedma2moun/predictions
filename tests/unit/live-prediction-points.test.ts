import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getAll: vi.fn() }));
vi.mock('@/lib/services/scoring-rule-service', () => ({ ScoringRuleService: { getAll: mocks.getAll } }));
vi.mock('@/lib/services/leaderboard-service', () => ({ getLeaderboard: vi.fn() }));
vi.mock('@/lib/repositories/match-repository', () => ({ MatchRepository: {} }));
vi.mock('@/lib/repositories/prediction-repository', () => ({ PredictionRepository: {} }));
vi.mock('@/lib/football/service', () => ({ fetchFixtureById: vi.fn(), mapFixtureStatus: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: {} }));
import { getLivePredictionPoints } from '@/lib/services/live-standing-service';

const rule = (id: number, key: string, points: number, priority: number) =>
  ({ id, name: key, key, points, priority, isActive: true });
const rules = [
  rule(1, 'correct_winner', 2, 1),
  rule(2, 'exact_score', 3, 2),
  rule(3, 'score_difference', 2, 3),
  rule(4, 'one_team_score', 1, 4),
];

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getAll.mockResolvedValue(rules);
});

it('scores the prediction against the current score', async () => {
  const pick = { homeScore: 2, awayScore: 1 };
  expect(await getLivePredictionPoints(pick, { homeScore: 2, awayScore: 1 }, null)).toBe(5);
  expect(await getLivePredictionPoints(pick, { homeScore: 1, awayScore: 0 }, null)).toBe(4);
  expect(await getLivePredictionPoints(pick, { homeScore: 0, awayScore: 0 }, null)).toBe(0);
});

it('applies the odds multiplier the same way final scoring does', async () => {
  const points = await getLivePredictionPoints(
    { homeScore: 2, awayScore: 1 }, { homeScore: 2, awayScore: 1 }, { homeWin: 2, draw: 3, awayWin: 4 },
  );
  expect(points).toBe(7);
});

it('returns null without a prediction or a score', async () => {
  expect(await getLivePredictionPoints(null, { homeScore: 1, awayScore: 0 }, null)).toBeNull();
  expect(await getLivePredictionPoints({ homeScore: 1, awayScore: 0 }, { homeScore: null, awayScore: null }, null)).toBeNull();
  expect(mocks.getAll).not.toHaveBeenCalled();
});
