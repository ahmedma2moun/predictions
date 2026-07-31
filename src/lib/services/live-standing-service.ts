import { getLeaderboard } from '@/lib/services/leaderboard-service';
import { ScoringRuleService } from '@/lib/services/scoring-rule-service';
import { MatchRepository } from '@/lib/repositories/match-repository';
import { PredictionRepository } from '@/lib/repositories/prediction-repository';
import { fetchFixtureById, mapFixtureStatus } from '@/lib/football/service';
import { calculateScore } from '@/lib/scoring-engine';
import { getLiveMatchOdds, deriveOutcome, calcFinalScore, type OddsConfig } from '@/lib/odds';
import { ODDS_FEATURE_ENABLED } from '@/lib/feature-flags';
import { logger } from '@/lib/logger';

export type LiveMovement = 'up' | 'down' | 'same';

export interface LiveStandingMatch {
  matchId: number;
  homeTeamName: string;
  homeTeamLogo: string | null;
  awayTeamName: string;
  awayTeamLogo: string | null;
  homeScore: number;
  awayScore: number;
  status: 'live' | 'finished';
  kickoffTime: Date;
}

export interface LiveStandingEntry {
  userId: number;
  name: string | null;
  avatarUrl: string | null;
  /** Rank from confirmed (finished) points only — the pre-live standing. */
  previousRank: number;
  /** Rank once provisional live points are added. */
  rank: number;
  movement: LiveMovement;
  /** Confirmed points (finished matches + champion bonus). */
  points: number;
  /** Provisional points from in-play matches. */
  livePoints: number;
  liveTotalPoints: number;
}

export interface LiveGroupStanding {
  hasLiveMatches: boolean;
  matches: LiveStandingMatch[];
  standings: LiveStandingEntry[];
}

export interface LiveStandingFilters {
  groupId?: number;
  seasonId: number;
}

// A football match (incl. half-time and stoppage) fits comfortably in this
// window; anything older that is still unfinished is a stale fixture, not live.
const LIVE_WINDOW_MS = 4 * 60 * 60 * 1000;

/**
 * Live group standing: the current leaderboard re-ranked with provisional
 * points from matches that are in play right now. Live scores come from the
 * football API via fetchFixtureById, which has a shared 30s cache so many
 * concurrent viewers collapse into one upstream call per match.
 */
export async function getLiveGroupStanding(filters: LiveStandingFilters): Promise<LiveGroupStanding> {
  const { groupId, seasonId } = filters;

  const now = new Date();
  const [base, candidates] = await Promise.all([
    getLeaderboard({ groupId, seasonId }),
    MatchRepository.findMany({
      where: {
        seasonId,
        externalId: { not: null },
        status: { in: ['scheduled', 'live'] },
        kickoffTime: { lte: now, gt: new Date(now.getTime() - LIVE_WINDOW_MS) },
      },
      include: { season: { select: { oddsEnabled: true, oddsMin: true, oddsMax: true } } },
      orderBy: { kickoffTime: 'asc' },
    }),
  ]);

  // Confirm each candidate is actually in play and grab its current score.
  const matches: LiveStandingMatch[] = [];
  const liveResults = new Map<number, { homeScore: number; awayScore: number; oddsConfig: OddsConfig }>();
  for (const match of candidates) {
    const fixture = await fetchFixtureById(match.externalId!).catch((e) => {
      logger.warn(`[live-standing] Failed to fetch fixture ${match.externalId}:`, { error: e instanceof Error ? e.message : String(e) });
      return null;
    });
    if (!fixture) continue;

    const status = mapFixtureStatus(fixture.fixture.status.short);
    // 'finished' still counts while the DB result hasn't been processed yet —
    // those points are not in the base leaderboard, so they are provisional.
    if (status !== 'live' && status !== 'finished') continue;

    const homeScore = fixture.score.fulltime.home ?? fixture.goals.home;
    const awayScore = fixture.score.fulltime.away ?? fixture.goals.away;
    if (homeScore === null || awayScore === null) continue;

    const s = match.season;
    liveResults.set(match.id, {
      homeScore,
      awayScore,
      oddsConfig: {
        oddsEnabled: ODDS_FEATURE_ENABLED && (s?.oddsEnabled ?? false),
        oddsMin: s ? Number(s.oddsMin) : 1.1,
        oddsMax: s ? Number(s.oddsMax) : 5.0,
      },
    });
    matches.push({
      matchId: match.id,
      homeTeamName: match.homeTeamName,
      homeTeamLogo: match.homeTeamLogo,
      awayTeamName: match.awayTeamName,
      awayTeamLogo: match.awayTeamLogo,
      homeScore,
      awayScore,
      status,
      kickoffTime: match.kickoffTime,
    });
  }

  // Provisional points per user, mirroring how final scoring will run
  // (calculateScore + odds multiplier on the winner points).
  const livePointsByUser = new Map<number, number>();
  const liveOnlyUsers = new Map<number, { name: string | null; avatarUrl: string | null }>();
  const baseUserIds = new Set(base.map(e => e.userId));

  if (liveResults.size > 0) {
    const rules = await ScoringRuleService.getAll({ where: { isActive: true } });

    for (const [matchId, { homeScore, awayScore, oddsConfig }] of liveResults) {
      const winner: 'home' | 'away' | 'draw' =
        homeScore > awayScore ? 'home' : awayScore > homeScore ? 'away' : 'draw';

      const [odds, preds] = await Promise.all([
        getLiveMatchOdds(matchId, oddsConfig).catch(() => null),
        PredictionRepository.findMany({
          where: { matchId },
          include: { user: { select: { name: true, avatarUrl: true, role: true } } },
        }),
      ]);

      for (const pred of preds) {
        if (pred.user.role === 'admin') continue;
        // Group boards only track members; skip non-members' predictions.
        if (groupId && !baseUserIds.has(pred.userId)) continue;

        const { totalPoints, breakdown } = calculateScore(
          { homeScore: pred.homeScore, awayScore: pred.awayScore },
          { homeScore, awayScore, winner },
          rules,
        );

        let points = totalPoints;
        if (odds) {
          const odd = odds[deriveOutcome(pred.homeScore, pred.awayScore)];
          const winnerPoints = breakdown.find(r => r.key === 'correct_winner')?.pointsAwarded ?? 0;
          points = calcFinalScore(winnerPoints, totalPoints - winnerPoints, odd);
        }

        livePointsByUser.set(pred.userId, (livePointsByUser.get(pred.userId) ?? 0) + points);
        if (!baseUserIds.has(pred.userId)) {
          liveOnlyUsers.set(pred.userId, { name: pred.user.name, avatarUrl: pred.user.avatarUrl ?? null });
        }
      }
    }
  }

  // Pre-live order: the base leaderboard, with any live-only users (no
  // confirmed points yet) appended at the bottom.
  const preLive = [
    ...base.map(e => ({ userId: e.userId, name: e.name, avatarUrl: e.avatarUrl, points: e.totalPoints })),
    ...[...liveOnlyUsers.entries()].map(([userId, u]) => ({ userId, name: u.name, avatarUrl: u.avatarUrl, points: 0 })),
  ];
  const previousRankByUser = new Map(preLive.map((e, idx) => [e.userId, idx + 1]));

  const standings: LiveStandingEntry[] = preLive
    .map(e => {
      const livePoints = livePointsByUser.get(e.userId) ?? 0;
      return {
        userId: e.userId,
        name: e.name,
        avatarUrl: e.avatarUrl,
        previousRank: previousRankByUser.get(e.userId)!,
        rank: 0,
        movement: 'same' as LiveMovement,
        points: e.points,
        livePoints,
        liveTotalPoints: e.points + livePoints,
      };
    })
    .sort(
      (a, b) =>
        b.liveTotalPoints - a.liveTotalPoints ||
        a.previousRank - b.previousRank ||
        (a.name ?? '').localeCompare(b.name ?? ''),
    )
    .map((e, idx) => {
      const rank = idx + 1;
      return {
        ...e,
        rank,
        movement: (rank < e.previousRank ? 'up' : rank > e.previousRank ? 'down' : 'same') as LiveMovement,
      };
    });

  return { hasLiveMatches: matches.length > 0, matches, standings };
}
