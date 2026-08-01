
import { isMatchLocked } from '@/lib/utils';
import { getStandingsMap, standingKey } from '@/lib/standings';
import { Prisma, MatchStatus, Match } from '@prisma/client';
import { MatchRepository } from '@/lib/repositories/match-repository';
import { PredictionRepository } from '@/lib/repositories/prediction-repository';
import { getLiveMatchOdds, calcMatchOdds, deriveOutcome, ODDS_MIN_DEFAULT, ODDS_MAX_DEFAULT, type OddsConfig, type PredictionPool } from '@/lib/odds';
import { ODDS_FEATURE_ENABLED } from '@/lib/feature-flags';

export interface MatchFilters {
  leagueId?: number;
  status?: string;
  week?: string;
}

export interface StandingData {
  position: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
  goalDifference: number;
  form: string | null;
}

export interface PredictionData {
  homeScore: number;
  awayScore: number;
  predictedWinner: string | null;
  pointsAwarded: number | null;
}

export interface MatchPredictionRow {
  userId: number;
  userName: string | null;
  homeScore: number;
  awayScore: number;
  pointsAwarded: number | null;
  rawBreakdown: unknown;
}

export type MatchWithLeague = Match & { league: { name: string } | null };

export interface MatchListItem {
  match: MatchWithLeague;
  prediction: PredictionData | null;
  homeStanding: StandingData | null;
  awayStanding: StandingData | null;
}

export interface MatchOddsData {
  homeWin: number;
  draw: number;
  awayWin: number;
  locked: boolean;
  votes: { homeWin: number; draw: number; awayWin: number };
}

export interface MatchDetailData {
  match: MatchWithLeague;
  prediction: PredictionData | null;
  allPredictions: MatchPredictionRow[] | null;
  homeStanding: StandingData | null;
  awayStanding: StandingData | null;
  odds: MatchOddsData | null;
}

export async function getMatches(
  filters: MatchFilters,
  opts: { userId: number; isAdmin: boolean; withStandings?: boolean },
): Promise<MatchListItem[]> {
  const where: Prisma.MatchWhereInput = {};
  if (filters.leagueId) where.externalLeagueId = filters.leagueId;
  if (filters.status) {
    where.status = filters.status as MatchStatus;
  } else {
    where.status = { in: ['scheduled', 'live', 'finished'] as MatchStatus[] };
  }
  if (filters.week) where.weekStart = new Date(filters.week);

  const matches = await MatchRepository.findMany({
    where,
    include: {
      league: { select: { name: true } },
      season: { select: { name: true } },
    },
    orderBy: { kickoffTime: 'asc' },
    take: 100,
  });

  const matchIds = matches.map(m => m.id);

  const uniqueLeagues = [
    ...new Map(matches.map(m => [m.externalLeagueId, { externalLeagueId: m.externalLeagueId, season: 0 }])).values(),
  ];

  const [predMap, standingMap] = await Promise.all([
    (async () => {
      const map = new Map<number, { homeScore: number; awayScore: number; predictedWinner: string | null; pointsAwarded: number | null }>();
      if (!opts.isAdmin && matchIds.length > 0) {
        const predictions = await PredictionRepository.findMany({
          where: { userId: opts.userId, matchId: { in: matchIds } },
          select: { matchId: true, homeScore: true, awayScore: true, predictedWinner: true, pointsAwarded: true },
        });
        predictions.forEach(p => map.set(p.matchId, p));
      }
      return map;
    })(),
    opts.withStandings && matches.length > 0
      ? getStandingsMap(uniqueLeagues)
      : Promise.resolve(new Map<string, unknown>()),
  ]);

  return matches.map(m => {
    const p = predMap.get(m.id) ?? null;
    const homeStanding = standingMap.get(standingKey(m.homeTeamExtId, m.externalLeagueId)) ?? null;
    const awayStanding = standingMap.get(standingKey(m.awayTeamExtId, m.externalLeagueId)) ?? null;
    return {
      match: m,
      prediction: p ? { homeScore: p.homeScore, awayScore: p.awayScore, predictedWinner: p.predictedWinner, pointsAwarded: p.pointsAwarded } : null,
      homeStanding: homeStanding ? toStandingData(homeStanding) : null,
      awayStanding: awayStanding ? toStandingData(awayStanding) : null,
    };
  });
}

export async function getMatchById(
  matchId: number,
  opts: { userId: number; isAdmin: boolean },
): Promise<MatchDetailData | null> {
  const match = await MatchRepository.findUnique({
    where: { id: matchId },
    include: {
      league: { select: { name: true } },
      season: { select: { name: true, oddsEnabled: true, oddsMin: true, oddsMax: true } },
    },
  });
  if (!match) return null;

  const isCustom = match.externalLeagueId === 0;
  const s = (match as any).season;
  const oddsConfig: OddsConfig = {
    oddsEnabled: ODDS_FEATURE_ENABLED && (s?.oddsEnabled ?? false),
    oddsMin: s ? Number(s.oddsMin) : 1.1,
    oddsMax: s ? Number(s.oddsMax) : 5.0,
  };

  const adminOddsConfig: OddsConfig = { ...oddsConfig, oddsEnabled: ODDS_FEATURE_ENABLED };

  const [prediction, standingMap, odds] = await Promise.all([
    opts.isAdmin
      ? Promise.resolve(null)
      : PredictionRepository.findFirst({
          where: { userId: opts.userId, matchId: match.id },
          select: { homeScore: true, awayScore: true, predictedWinner: true, pointsAwarded: true },
        }),
    isCustom
      ? Promise.resolve(new Map<string, unknown>())
      : getStandingsMap([{ externalLeagueId: match.externalLeagueId, season: 0 }]),
    (opts.isAdmin || isMatchLocked(match.kickoffTime))
      ? getLiveMatchOdds(matchId, opts.isAdmin ? adminOddsConfig : oddsConfig)
      : Promise.resolve(null),
  ]);

  let allPredictions: MatchPredictionRow[] | null = null;
  if (opts.isAdmin || isMatchLocked(match.kickoffTime)) {
    const rows = await PredictionRepository.findMany({
      where: { matchId: match.id },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { pointsAwarded: 'desc' },
    });
    allPredictions = rows.map(p => ({
      userId: p.userId,
      userName: p.user.name,
      homeScore: p.homeScore,
      awayScore: p.awayScore,
      pointsAwarded: p.pointsAwarded,
      rawBreakdown: p.scoringBreakdown,
    }));
  }

  const homeStanding = standingMap.get(standingKey(match.homeTeamExtId, match.externalLeagueId)) ?? null;
  const awayStanding = standingMap.get(standingKey(match.awayTeamExtId, match.externalLeagueId)) ?? null;

  return {
    match,
    prediction: prediction
      ? { homeScore: prediction.homeScore, awayScore: prediction.awayScore, predictedWinner: prediction.predictedWinner, pointsAwarded: prediction.pointsAwarded }
      : null,
    allPredictions,
    homeStanding: homeStanding ? toStandingData(homeStanding) : null,
    awayStanding: awayStanding ? toStandingData(awayStanding) : null,
    odds,
  };
}

export interface AdminMatchOdds {
  homeWinVotes: number;
  drawVotes: number;
  awayWinVotes: number;
  totalVotes: number;
  homeWinOdds: number;
  drawOdds: number;
  awayWinOdds: number;
  locked: boolean;
}

export interface AdminMatchListItem {
  match: Match & {
    season: { oddsEnabled: boolean; oddsMin: Prisma.Decimal; oddsMax: Prisma.Decimal } | null;
    matchOdds: { homeWinOdds: Prisma.Decimal; drawOdds: Prisma.Decimal; awayWinOdds: Prisma.Decimal; lockedAt: Date | null } | null;
  };
  odds: AdminMatchOdds;
}

export async function getAdminMatches(page: number, limit: number): Promise<{ items: AdminMatchListItem[]; total: number }> {
  const [matches, total] = await Promise.all([
    MatchRepository.findMany({
      orderBy: { kickoffTime: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        season: { select: { oddsEnabled: true, oddsMin: true, oddsMax: true } },
        matchOdds: true,
      },
    }),
    MatchRepository.count(),
  ]) as [AdminMatchListItem['match'][], number];

  const matchIds = matches.map(m => m.id);
  const allPredictions = matchIds.length > 0
    ? await PredictionRepository.findMany({
        where: { matchId: { in: matchIds } },
        select: { matchId: true, homeScore: true, awayScore: true },
      })
    : [];

  const poolByMatch = new Map<number, PredictionPool>();
  for (const p of allPredictions) {
    const pool = poolByMatch.get(p.matchId) ?? { homeWin: 0, draw: 0, awayWin: 0 };
    pool[deriveOutcome(p.homeScore, p.awayScore)]++;
    poolByMatch.set(p.matchId, pool);
  }

  const items = matches.map(m => {
    const pool = poolByMatch.get(m.id) ?? { homeWin: 0, draw: 0, awayWin: 0 };
    const oddsMin = m.season ? Number(m.season.oddsMin) : ODDS_MIN_DEFAULT;
    const oddsMax = m.season ? Number(m.season.oddsMax) : ODDS_MAX_DEFAULT;
    const locked = !!m.matchOdds?.lockedAt;
    const odds = locked
      ? { homeWin: Number(m.matchOdds!.homeWinOdds), draw: Number(m.matchOdds!.drawOdds), awayWin: Number(m.matchOdds!.awayWinOdds) }
      : calcMatchOdds(pool, { oddsEnabled: ODDS_FEATURE_ENABLED, oddsMin, oddsMax });

    return {
      match: m,
      odds: {
        homeWinVotes: pool.homeWin,
        drawVotes: pool.draw,
        awayWinVotes: pool.awayWin,
        totalVotes: pool.homeWin + pool.draw + pool.awayWin,
        homeWinOdds: odds.homeWin,
        drawOdds: odds.draw,
        awayWinOdds: odds.awayWin,
        locked,
      },
    };
  });

  return { items, total };
}

function toStandingData(s: unknown): StandingData {
  const st = s as Record<string, unknown>;
  return {
    position: st.position as number,
    played: st.played as number,
    won: st.won as number,
    drawn: st.drawn as number,
    lost: st.lost as number,
    points: st.points as number,
    goalDifference: st.goalDifference as number,
    form: st.form as string | null,
  };
}
