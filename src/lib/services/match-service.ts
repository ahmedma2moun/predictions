import { prisma } from '@/lib/prisma';
import { isMatchLocked } from '@/lib/utils';
import { getStandingsMap, standingKey } from '@/lib/standings';
import { Prisma, MatchStatus, Match, Prediction } from '@prisma/client';

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

export interface MatchDetailData {
  match: MatchWithLeague;
  prediction: PredictionData | null;
  allPredictions: MatchPredictionRow[] | null;
  homeStanding: StandingData | null;
  awayStanding: StandingData | null;
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

  const matches = await prisma.match.findMany({
    where,
    include: { league: { select: { name: true } } },
    orderBy: { kickoffTime: 'asc' },
    take: 100,
  });

  const matchIds = matches.map(m => m.id);

  const uniqueLeagues = [
    ...new Map(matches.map(m => [m.externalLeagueId, { externalLeagueId: m.externalLeagueId, season: 0 }])).values(),
  ];

  const [predMap, standingMap] = await Promise.all([
    (async () => {
      const map = new Map<number, Prediction>();
      if (!opts.isAdmin && matchIds.length > 0) {
        const predictions = await prisma.prediction.findMany({
          where: { userId: opts.userId, matchId: { in: matchIds } },
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
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { league: { select: { name: true } } },
  });
  if (!match) return null;

  const [prediction, standingMap] = await Promise.all([
    opts.isAdmin
      ? Promise.resolve(null)
      : prisma.prediction.findFirst({ where: { userId: opts.userId, matchId: match.id } }),
    getStandingsMap([{ externalLeagueId: match.externalLeagueId, season: 0 }]),
  ]);

  let allPredictions: MatchPredictionRow[] | null = null;
  if (opts.isAdmin || isMatchLocked(match.kickoffTime)) {
    const rows = await prisma.prediction.findMany({
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
  };
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
