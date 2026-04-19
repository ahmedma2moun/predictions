
import { getWinner } from '@/lib/utils';
import { Prisma, Match, Prediction } from '@prisma/client';
import { MatchRepository } from '@/lib/repositories/match-repository';
import { PredictionRepository } from '@/lib/repositories/prediction-repository';
import { GroupRepository } from '@/lib/repositories/group-repository';

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
  return PredictionRepository.findMany({
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
  const match = await MatchRepository.findUnique({
    where: { id: matchId },
    select: { id: true, kickoffTime: true },
  });
  if (!match) return { error: 'Match not found', status: 404 };
  if (new Date() >= match.kickoffTime) return { error: 'Match has already started', status: 400 };

  const predictedWinner = getWinner(homeScore, awayScore);
  const prediction = await PredictionRepository.upsert({
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

  const predictions = await PredictionRepository.findMany({
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

export interface GroupPredictionEntry {
  userId: string;
  userName: string | null;
  homeScore: number | null;
  awayScore: number | null;
  pointsAwarded: number | null;
  scoringBreakdown: unknown;
  predicted: boolean;
}

type GroupPredictionResult =
  | { entries: GroupPredictionEntry[] }
  | { error: string; status: number };

export async function getGroupPredictionsForMatch(
  matchId: number,
  groupId: number,
  requestingUserId: number,
  isAdmin: boolean,
): Promise<GroupPredictionResult> {
  const match = await MatchRepository.findUnique({
    where: { id: matchId },
    select: { id: true, kickoffTime: true },
  });
  if (!match) return { error: 'Match not found', status: 404 };
  if (!isAdmin && new Date() < match.kickoffTime) {
    return { error: 'Predictions are not yet visible', status: 403 };
  }

  const group = await GroupRepository.findByIdWithMembers(groupId);
  if (!group) return { error: 'Group not found', status: 404 };

  const isMember = isAdmin || group.members.some(m => m.userId === requestingUserId);
  if (!isMember) return { error: 'Forbidden', status: 403 };

  const memberIds = group.members.map(m => m.userId);
  const predictions = await PredictionRepository.findMany({
    where: { matchId, userId: { in: memberIds } },
    select: {
      userId: true,
      homeScore: true,
      awayScore: true,
      pointsAwarded: true,
      scoringBreakdown: true,
    },
  });

  const predMap = new Map(predictions.map(p => [p.userId, p]));

  const entries: GroupPredictionEntry[] = group.members.map(m => {
    const pred = predMap.get(m.userId);
    return {
      userId: m.userId.toString(),
      userName: m.user.name,
      homeScore: pred?.homeScore ?? null,
      awayScore: pred?.awayScore ?? null,
      pointsAwarded: pred?.pointsAwarded ?? null,
      scoringBreakdown: pred?.scoringBreakdown ?? null,
      predicted: !!pred,
    };
  });

  entries.sort((a, b) => {
    if (a.predicted !== b.predicted) return a.predicted ? -1 : 1;
    if (a.pointsAwarded !== b.pointsAwarded) {
      if (b.pointsAwarded === null) return -1;
      if (a.pointsAwarded === null) return 1;
      return b.pointsAwarded - a.pointsAwarded;
    }
    return (a.userName ?? '').localeCompare(b.userName ?? '');
  });

  return { entries };
}

export async function recalculateAllScores(rules: any[]) {
  const finishedMatches = await MatchRepository.findMany({
    where: { status: 'finished', resultHomeScore: { not: null } },
    select: { id: true, resultHomeScore: true, resultAwayScore: true, resultWinner: true },
  });
  const matchMap = new Map(finishedMatches.map(m => [m.id, m]));
  const matchIds = finishedMatches.map(m => m.id);

  let updated = 0;
  const batchSize = 100;
  let skip = 0;

  const { calculateScore } = await import('@/lib/scoring-engine');

  while (true) {
    const predictions = await PredictionRepository.findMany({
      where: { matchId: { in: matchIds } },
      skip,
      take: batchSize,
    });
    if (predictions.length === 0) break;

    await PredictionRepository.transaction(
      predictions.flatMap(pred => {
        const match = matchMap.get(pred.matchId);
        if (!match || match.resultHomeScore === null || match.resultAwayScore === null || match.resultWinner === null) return [];
        const { totalPoints, breakdown } = calculateScore(
          { homeScore: pred.homeScore, awayScore: pred.awayScore },
          {
            homeScore: match.resultHomeScore!,
            awayScore: match.resultAwayScore!,
            winner: match.resultWinner! as 'home' | 'away' | 'draw',
          },
          rules
        );
        return [
          PredictionRepository.update({
            where: { id: pred.id },
            data: { pointsAwarded: totalPoints, scoringBreakdown: { rules: breakdown } },
          }),
        ];
      })
    );

    updated += predictions.length;
    skip += batchSize;
    if (predictions.length < batchSize) break;
  }

  await MatchRepository.updateMany({
    where: { status: 'finished', resultHomeScore: { not: null } },
    data: { scoresProcessed: true },
  });

  return updated;
}
