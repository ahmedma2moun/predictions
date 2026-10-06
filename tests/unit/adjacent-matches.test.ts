import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock('@/lib/repositories/match-repository', () => ({ MatchRepository: { findMany: mocks.findMany } }));
vi.mock('@/lib/standings', () => ({ getStandingsMap: vi.fn(), standingKey: vi.fn() }));
vi.mock('@/lib/odds', () => ({ getLiveMatchOdds: vi.fn(), calcMatchOdds: vi.fn(), deriveOutcome: vi.fn() }));
import { getAdjacentMatches } from '@/lib/services/match-service';

const kickoffTime = new Date('2026-10-10T14:00:00Z');
const prev = { id: 10, homeTeamName: 'A', awayTeamName: 'B' };
const next = { id: 12, homeTeamName: 'C', awayTeamName: 'D' };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.findMany.mockResolvedValueOnce([prev]).mockResolvedValueOnce([next]);
});

it('returns the neighbouring matches in kickoff order, breaking ties by id', async () => {
  expect(await getAdjacentMatches({ id: 11, kickoffTime, status: 'scheduled' })).toEqual({ prevMatch: prev, nextMatch: next });

  const [prevArgs, nextArgs] = mocks.findMany.mock.calls.map(c => c[0]);
  expect(prevArgs).toMatchObject({
    where: {
      predictionsEnabled: true,
      status: { in: ['scheduled', 'live'] },
      id: { not: 11 },
      OR: [{ kickoffTime: { lt: kickoffTime } }, { kickoffTime, id: { lt: 11 } }],
    },
    orderBy: [{ kickoffTime: 'desc' }, { id: 'desc' }],
    take: 1,
  });
  expect(nextArgs).toMatchObject({
    where: { OR: [{ kickoffTime: { gt: kickoffTime } }, { kickoffTime, id: { gt: 11 } }] },
    orderBy: [{ kickoffTime: 'asc' }, { id: 'asc' }],
    take: 1,
  });
});

it('pages finished matches among finished matches only', async () => {
  await getAdjacentMatches({ id: 11, kickoffTime, status: 'finished' });
  expect(mocks.findMany.mock.calls[0][0].where.status).toEqual({ in: ['finished'] });
});

it('returns null at either end of the list', async () => {
  mocks.findMany.mockReset().mockResolvedValue([]);
  expect(await getAdjacentMatches({ id: 11, kickoffTime, status: 'live' })).toEqual({ prevMatch: null, nextMatch: null });
});
