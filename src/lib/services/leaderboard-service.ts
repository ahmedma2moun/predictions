import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { GroupRepository } from '@/lib/repositories/group-repository';
import { UserRepository } from '@/lib/repositories/user-repository';
import { PredictionRepository } from '@/lib/repositories/prediction-repository';
import { ChampionBonusRepository } from '@/lib/repositories/champion-bonus-repository';
import { ScoringRuleService } from '@/lib/services/scoring-rule-service';
import { getMaxPointsPerMatch } from '@/lib/scoring-engine';

export interface LeaderboardFilters {
  leagueIds?: number[];
  groupId?: number;
  from?: string;
  to?: string;
  seasonId?: number;
}

export interface LeaderboardEntry {
  userId: number;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  totalPoints: number;
  championBonusPoints: number;
  predictionsCount: number;
  correctPredictions: number;
  accuracy: number;
  currentStreak: number;
  longestStreak: number;
  badges: string[];           // excludes 'group_champion'
  exactScoreCount: number;
  isGroupChampion: boolean;
}

export async function getLeaderboard(filters: LeaderboardFilters): Promise<LeaderboardEntry[]> {
  const { leagueIds = [], groupId, from, to, seasonId } = filters;

  let userIdFilter: number[] | null = null;
  let groupKickoffGte: Date | null = null;

  const [activeRules] = await Promise.all([
    ScoringRuleService.getAll({ where: { isActive: true } }),
  ]);
  const maxPoints = getMaxPointsPerMatch(activeRules);

  if (groupId) {
    const group = await GroupRepository.findUnique({
      where: { id: groupId },
      select: { isDefault: true, createdAt: true, members: { select: { userId: true, user: { select: { role: true } } } } },
    });
    if (!group) return [];

    if (!group.isDefault) {
      const existingGte = from ? new Date(from) : null;
      const groupGte    = group.createdAt;
      groupKickoffGte   = existingGte && existingGte > groupGte ? existingGte : groupGte;
    }

    userIdFilter = group.members.filter(m => m.user.role !== 'admin').map(m => m.userId);
    if (userIdFilter.length === 0) return [];
  }

  const matchConditions: Prisma.Sql[] = [Prisma.sql`m.status = 'finished'`];

  if (leagueIds.length === 1) {
    matchConditions.push(Prisma.sql`m."externalLeagueId" = ${leagueIds[0]}`);
  } else if (leagueIds.length > 1) {
    matchConditions.push(Prisma.sql`m."externalLeagueId" = ANY(${leagueIds})`);
  }

  const effectiveFrom = groupKickoffGte ?? (from ? new Date(from) : null);
  if (effectiveFrom) matchConditions.push(Prisma.sql`m."kickoffTime" >= ${effectiveFrom}`);
  if (to)            matchConditions.push(Prisma.sql`m."kickoffTime" < ${new Date(to)}`);
  if (seasonId != null) matchConditions.push(Prisma.sql`m."seasonId" = ${seasonId}`);

  // Prediction points reuse the match conditions + a per-user (p) filter.
  const predConditions = [...matchConditions];
  if (userIdFilter !== null) predConditions.push(Prisma.sql`p."userId" = ANY(${userIdFilter})`);
  const whereClause = Prisma.join(predConditions, ' AND ');

  // Champion Bonus reuses the same match conditions; the user filter applies to
  // the pick's user (cbp) instead of the prediction's.
  const bonusConditions = [...matchConditions];
  if (userIdFilter !== null) bonusConditions.push(Prisma.sql`cbp."userId" = ANY(${userIdFilter})`);
  const bonusWhere = Prisma.join(bonusConditions, ' AND ');

  const [rows, bonusRows] = await Promise.all([
    PredictionRepository.getLeaderboardStats(whereClause),
    ChampionBonusRepository.getBonusStats(bonusWhere),
  ]);

  const bonusMap = new Map(bonusRows.map(r => [Number(r.userId), Number(r.bonus)]));

  const scoredUserIds = new Set(rows.map(r => Number(r.userId)));
  const allUserIds    = [...new Set([
    ...scoredUserIds,
    ...(userIdFilter ?? []),
    ...bonusMap.keys(),
  ])];

  if (allUserIds.length === 0) return [];

  const [users, exactRows] = await Promise.all([
    UserRepository.findMany({
      where: { id: { in: allUserIds }, role: { not: 'admin' } },
      select: {
        id: true, name: true, email: true, avatarUrl: true,
        currentStreak: true, longestStreak: true,
        badges: { select: { badge: true } },
      },
    }),
    prisma.$queryRaw<Array<{ userId: number; exactCount: number }>>(
      Prisma.sql`
        SELECT p."userId", COUNT(*)::int AS "exactCount"
        FROM "Prediction" p
        JOIN "Match" m ON m.id = p."matchId"
        WHERE m.status = 'finished'
          AND p."userId" = ANY(${allUserIds})
          AND p."scoringBreakdown" IS NOT NULL
          ${seasonId != null ? Prisma.sql`AND m."seasonId" = ${seasonId}` : Prisma.empty}
          AND EXISTS (
            SELECT 1 FROM jsonb_array_elements((p."scoringBreakdown")::jsonb->'rules') r
            WHERE r->>'key' = 'exact_score' AND r->>'matched' = 'true'
          )
        GROUP BY p."userId"
      `,
    ),
  ]);
  const userMap = new Map(users.map(u => [u.id, u]));
  const exactMap = new Map(exactRows.map(r => [Number(r.userId), Number(r.exactCount)]));

  const buildBadgeFields = (u: (typeof users)[number]) => {
    const allBadges = u.badges.map(b => b.badge as string);
    return {
      badges: allBadges.filter(b => b !== 'group_champion'),
      isGroupChampion: allBadges.includes('group_champion'),
      longestStreak: u.longestStreak,
      exactScoreCount: exactMap.get(u.id) ?? 0,
    };
  };

  const result: LeaderboardEntry[] = rows.flatMap(entry => {
    const user = userMap.get(Number(entry.userId));
    if (!user) return [];
    const predictionsCount   = Number(entry.predictionsCount);
    const correctPredictions = Number(entry.correctPredictions);
    const predictionPoints   = Number(entry.totalPoints);
    const bonus              = bonusMap.get(Number(entry.userId)) ?? 0;
    return [{
      userId: Number(entry.userId),
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl ?? null,
      totalPoints: predictionPoints + bonus,
      championBonusPoints: bonus,
      predictionsCount,
      correctPredictions,
      // Accuracy is prediction-only — the bonus never inflates it.
      accuracy: predictionsCount > 0 && maxPoints > 0 ? Math.round((predictionPoints / (maxPoints * predictionsCount)) * 100) : 0,
      currentStreak: user.currentStreak,
      ...buildBadgeFields(user),
    }];
  });

  // Users with no scored predictions but who belong to the filtered group and/or
  // earned Champion Bonus points still appear (bonus-only entries).
  for (const uid of allUserIds) {
    if (scoredUserIds.has(uid)) continue;
    const user = userMap.get(uid);
    if (!user) continue;
    const bonus = bonusMap.get(uid) ?? 0;
    result.push({
      userId: uid,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl ?? null,
      totalPoints: bonus,
      championBonusPoints: bonus,
      predictionsCount: 0,
      correctPredictions: 0,
      accuracy: 0,
      currentStreak: user.currentStreak,
      ...buildBadgeFields(user),
    });
  }

  // Bonus is added after the SQL ORDER BY, so re-sort by the final total.
  result.sort((a, b) => b.totalPoints - a.totalPoints || (a.name ?? '').localeCompare(b.name ?? ''));

  // On-the-fly group_champion: set flag for #1 of any group-scoped period that has ended.
  // All-time persisted winners already have isGroupChampion=true from the badge flag.
  if (groupId && to) {
    const periodEnd = new Date(to);
    if (periodEnd <= new Date() && result.length > 0) {
      const champion = result[0];
      if (champion.totalPoints > 0) champion.isGroupChampion = true;
    }
  }

  return result;
}
