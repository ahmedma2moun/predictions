import { prisma } from '@/lib/prisma';

export const ODDS_MIN_DEFAULT = 1.1;
export const ODDS_MAX_DEFAULT = 5.0;

export type Outcome = 'homeWin' | 'draw' | 'awayWin';

export interface PredictionPool { homeWin: number; draw: number; awayWin: number; }
export interface MatchOddsResult { homeWin: number; draw: number; awayWin: number; }
export interface OddsConfig { oddsEnabled: boolean; oddsMin: number; oddsMax: number; }

export function deriveOutcome(homeScore: number, awayScore: number): Outcome {
  if (homeScore > awayScore) return 'homeWin';
  if (awayScore > homeScore) return 'awayWin';
  return 'draw';
}

export function calcMatchOdds(pool: PredictionPool, config: OddsConfig): MatchOddsResult {
  if (!config.oddsEnabled) return { homeWin: 1.0, draw: 1.0, awayWin: 1.0 };

  const { oddsMin, oddsMax } = config;
  const total = pool.homeWin + pool.draw + pool.awayWin;
  const mid = Math.round(((oddsMin + oddsMax) / 2) * 100) / 100;

  if (total === 0 || (pool.homeWin === pool.draw && pool.draw === pool.awayWin)) {
    return { homeWin: mid, draw: mid, awayWin: mid };
  }

  const raw = {
    homeWin: pool.homeWin === 0 ? total : total / pool.homeWin,
    draw:    pool.draw    === 0 ? total : total / pool.draw,
    awayWin: pool.awayWin === 0 ? total : total / pool.awayWin,
  };

  const rawMin = Math.min(raw.homeWin, raw.draw, raw.awayWin);
  const rawMax = Math.max(raw.homeWin, raw.draw, raw.awayWin);

  const normalize = (v: number): number => {
    if (rawMax === rawMin) return mid;
    return Math.round((oddsMin + ((v - rawMin) / (rawMax - rawMin)) * (oddsMax - oddsMin)) * 100) / 100;
  };

  return {
    homeWin: normalize(raw.homeWin),
    draw:    normalize(raw.draw),
    awayWin: normalize(raw.awayWin),
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
  if (!config.oddsEnabled) return { homeWin: 1.0, draw: 1.0, awayWin: 1.0 };

  const existing = await prisma.matchOdds.findUnique({ where: { matchId } });
  if (existing?.lockedAt) {
    return {
      homeWin: Number(existing.homeWinOdds),
      draw:    Number(existing.drawOdds),
      awayWin: Number(existing.awayWinOdds),
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
): Promise<(MatchOddsResult & { locked: boolean; homeWinVotes: number; drawVotes: number; awayWinVotes: number; totalVotes: number }) | null> {
  if (!config.oddsEnabled) return null;

  const existing = await prisma.matchOdds.findUnique({ where: { matchId } });

  const predictions = await prisma.prediction.findMany({
    where: { matchId },
    select: { homeScore: true, awayScore: true },
  });

  const pool: PredictionPool = { homeWin: 0, draw: 0, awayWin: 0 };
  for (const p of predictions) {
    pool[deriveOutcome(p.homeScore, p.awayScore)]++;
  }
  const totalVotes = pool.homeWin + pool.draw + pool.awayWin;

  if (existing?.lockedAt) {
    return {
      homeWin: Number(existing.homeWinOdds),
      draw:    Number(existing.drawOdds),
      awayWin: Number(existing.awayWinOdds),
      locked: true,
      homeWinVotes: pool.homeWin,
      drawVotes:    pool.draw,
      awayWinVotes: pool.awayWin,
      totalVotes,
    };
  }

  const odds = calcMatchOdds(pool, config);
  return {
    ...odds,
    locked: false,
    homeWinVotes: pool.homeWin,
    drawVotes:    pool.draw,
    awayWinVotes: pool.awayWin,
    totalVotes,
  };
}
