import { prisma } from '@/lib/prisma';

export const ODDS_MIN_DEFAULT = 1.1;
export const ODDS_MAX_DEFAULT = 5.0;

export type Outcome = 'homeWin' | 'draw' | 'awayWin';

export interface PredictionPool { homeWin: number; draw: number; awayWin: number; }
export interface MatchOddsResult {
  homeWin: number;
  draw: number;
  awayWin: number;
  votes: { homeWin: number; draw: number; awayWin: number };
}
export interface OddsConfig { oddsEnabled: boolean; oddsMin: number; oddsMax: number; }

export function deriveOutcome(homeScore: number, awayScore: number): Outcome {
  if (homeScore > awayScore) return 'homeWin';
  if (awayScore > homeScore) return 'awayWin';
  return 'draw';
}

export function calcMatchOdds(pool: PredictionPool, config: OddsConfig): MatchOddsResult {
  const votes = { homeWin: pool.homeWin, draw: pool.draw, awayWin: pool.awayWin };

  if (!config.oddsEnabled) return { homeWin: 1.0, draw: 1.0, awayWin: 1.0, votes };

  const { oddsMin, oddsMax } = config;
  const mid = Math.round(((oddsMin + oddsMax) / 2) * 100) / 100;

  // Only consider outcomes that have at least one prediction
  const outcomes = (['homeWin', 'draw', 'awayWin'] as const).filter(o => pool[o] > 0);
  const activeTotal = outcomes.reduce((s, o) => s + pool[o], 0);

  if (outcomes.length === 0) {
    return { homeWin: 0, draw: 0, awayWin: 0, votes };
  }

  // raw[o] = activeTotal / votes[o] — more popular → lower raw → closer to oddsMin
  const raw = Object.fromEntries(outcomes.map(o => [o, activeTotal / pool[o]])) as Record<string, number>;

  const rawValues = Object.values(raw);
  const rawMin = Math.min(...rawValues);
  const rawMax = Math.max(...rawValues);

  const normalize = (v: number): number => {
    if (rawMax === rawMin) return oddsMin;
    return Math.round((oddsMin + ((v - rawMin) / (rawMax - rawMin)) * (oddsMax - oddsMin)) * 100) / 100;
  };

  // Outcomes with 0 votes get oddsMax as a placeholder (no one to score them anyway)
  return {
    homeWin: pool.homeWin > 0 ? normalize(raw.homeWin) : 0,
    draw:    pool.draw    > 0 ? normalize(raw.draw)    : 0,
    awayWin: pool.awayWin > 0 ? normalize(raw.awayWin) : 0,
    votes,
  };
}

export function calcFinalScore(baseScore: number, odds: number): number {
  if (baseScore === 0) return 0;
  return Math.round(baseScore * odds);
}

/**
 * Locks match odds idempotently at scoring time. If already locked, returns
 * the existing snapshot. Otherwise counts predictions, computes odds, and
 * persists them with a lockedAt timestamp.
 */
export async function lockMatchOdds(matchId: number, config: OddsConfig): Promise<MatchOddsResult> {
  if (!config.oddsEnabled) return { homeWin: 1.0, draw: 1.0, awayWin: 1.0, votes: { homeWin: 0, draw: 0, awayWin: 0 } };

  const existing = await prisma.matchOdds.findUnique({ where: { matchId } });
  if (existing?.lockedAt) {
    return {
      homeWin: Number(existing.homeWinOdds),
      draw:    Number(existing.drawOdds),
      awayWin: Number(existing.awayWinOdds),
      votes: { homeWin: existing.homeWinVotes, draw: existing.drawVotes, awayWin: existing.awayWinVotes },
    };
  }

  const predictions = await prisma.prediction.findMany({
    where: { matchId },
    select: { homeScore: true, awayScore: true },
  });

  const pool: PredictionPool = { homeWin: 0, draw: 0, awayWin: 0 };
  for (const p of predictions) {
    pool[deriveOutcome(p.homeScore, p.awayScore)]++;
  }

  const odds = calcMatchOdds(pool, config);

  await prisma.matchOdds.upsert({
    where: { matchId },
    create: {
      matchId,
      homeWinVotes: pool.homeWin,
      drawVotes:    pool.draw,
      awayWinVotes: pool.awayWin,
      homeWinOdds:  odds.homeWin,
      drawOdds:     odds.draw,
      awayWinOdds:  odds.awayWin,
      lockedAt:     new Date(),
    },
    update: {
      homeWinVotes: pool.homeWin,
      drawVotes:    pool.draw,
      awayWinVotes: pool.awayWin,
      homeWinOdds:  odds.homeWin,
      drawOdds:     odds.draw,
      awayWinOdds:  odds.awayWin,
      lockedAt:     new Date(),
    },
  });

  return odds;
}

/**
 * Returns live (pre-lock) odds for a match by counting current predictions.
 * Returns null if odds are not enabled for the match's season.
 */
export async function getLiveMatchOdds(
  matchId: number,
  config: OddsConfig,
): Promise<(MatchOddsResult & { locked: boolean }) | null> {
  if (!config.oddsEnabled) return null;

  const existing = await prisma.matchOdds.findUnique({ where: { matchId } });
  if (existing?.lockedAt) {
    return {
      homeWin: Number(existing.homeWinOdds),
      draw:    Number(existing.drawOdds),
      awayWin: Number(existing.awayWinOdds),
      votes: { homeWin: existing.homeWinVotes, draw: existing.drawVotes, awayWin: existing.awayWinVotes },
      locked: true,
    };
  }

  const predictions = await prisma.prediction.findMany({
    where: { matchId },
    select: { homeScore: true, awayScore: true },
  });

  const pool: PredictionPool = { homeWin: 0, draw: 0, awayWin: 0 };
  for (const p of predictions) {
    pool[deriveOutcome(p.homeScore, p.awayScore)]++;
  }

  const odds = calcMatchOdds(pool, config);
  return {
    ...odds,
    locked: false,
  };
}
