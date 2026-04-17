import { prisma } from '@/lib/prisma';
import { getWinner } from '@/lib/utils';
import { Prisma, Match, Prediction } from '@prisma/client';

export type PredictionWithMatch = Prediction & {
  match: Match & { league: { name: string } | null };
};

export interface UpsertPredictionResult {
  prediction: Prediction;
  error?: never;
}

export interface UpsertPredictionError {
  prediction?: never;
  error: string;
  status: number;
}

export async function getUserPredictions(userId: number): Promise<PredictionWithMatch[]> {
  return prisma.prediction.findMany({
    where: { userId },
    include: { match: { include: { league: { select: { name: true } } } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
}

export async function upsertPrediction(
  userId: number,
  matchId: number,
  homeScore: number,
  awayScore: number,
): Promise<UpsertPredictionResult | UpsertPredictionError> {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) return { error: 'Match not found', status: 404 };
  if (new Date() >= match.kickoffTime) return { error: 'Match has already started', status: 400 };

  const predictedWinner = getWinner(homeScore, awayScore);
  const prediction = await prisma.prediction.upsert({
    where: { userId_matchId: { userId, matchId: match.id } },
    create: { userId, matchId: match.id, homeScore, awayScore, predictedWinner },
    update: { homeScore, awayScore, predictedWinner },
  });

  return { prediction };
}

export interface UserPredictionHistoryFilters {
  userId: number;
  leagueIds?: number[];
  from?: string;
  to?: string;
}

export interface UserPredictionHistoryItem {
  matchId: string;
  kickoffTime: string;
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number;
  awayScore: number;
  result: { homeScore: number; awayScore: number };
  pointsAwarded: number | null;
  rawBreakdown: unknown;
}

export async function getUserPredictionHistory(
  filters: UserPredictionHistoryFilters,
): Promise<UserPredictionHistoryItem[]> {
  const matchWhere: Prisma.MatchWhereInput = { status: 'finished' };
  if (filters.leagueIds && filters.leagueIds.length === 1) matchWhere.externalLeagueId = filters.leagueIds[0];
  else if (filters.leagueIds && filters.leagueIds.length > 1) matchWhere.externalLeagueId = { in: filters.leagueIds };
  if (filters.from || filters.to) {
    const timeFilter: Prisma.DateTimeFilter = {};
    if (filters.from) timeFilter.gte = new Date(filters.from);
    if (filters.to)   timeFilter.lt  = new Date(filters.to);
    matchWhere.kickoffTime = timeFilter;
  }

  const predictions = await prisma.prediction.findMany({
    where: { userId: filters.userId, match: matchWhere },
    include: {
      match: {
        select: {
          id: true,
          kickoffTime: true,
          homeTeamName: true,
          awayTeamName: true,
          resultHomeScore: true,
          resultAwayScore: true,
        },
      },
    },
    orderBy: { match: { kickoffTime: 'desc' } },
  });

  return predictions
    .filter(p => p.match.resultHomeScore !== null)
    .map(p => ({
      matchId:      p.match.id.toString(),
      kickoffTime:  p.match.kickoffTime.toISOString(),
      homeTeamName: p.match.homeTeamName,
      awayTeamName: p.match.awayTeamName,
      homeScore:    p.homeScore,
      awayScore:    p.awayScore,
      result: {
        homeScore: p.match.resultHomeScore!,
        awayScore: p.match.resultAwayScore!,
      },
      pointsAwarded: p.pointsAwarded,
      rawBreakdown:  p.scoringBreakdown,
    }));
}
