import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { GroupRepository } from '@/lib/repositories/group-repository';
import { UserRepository } from '@/lib/repositories/user-repository';
import { PredictionRepository } from '@/lib/repositories/prediction-repository';
import { ScoringRuleService } from '@/lib/services/scoring-rule-service';
import { getMaxPointsPerMatch } from '@/lib/scoring-engine';

export interface LeaderboardFilters {
  leagueIds?: number[];
  groupId?: number;
  from?: string;
  to?: string;
}

export interface LeaderboardEntry {
  userId: number;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  totalPoints: number;
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
  const { leagueIds = [], groupId, from, to } = filters;

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

  const conditions: Prisma.Sql[] = [Prisma.sql`m.status = 'finished'`];

  if (leagueIds.length === 1) {
    conditions.push(Prisma.sql`m."externalLeagueId" = ${leagueIds[0]}`);
  } else if (leagueIds.length > 1) {
    conditions.push(Prisma.sql`m."externalLeagueId" = ANY(${leagueIds})`);
  }

  const effectiveFrom = groupKickoffGte ?? (from ? new Date(from) : null);
  if (effectiveFrom) conditions.push(Prisma.sql`m."kickoffTime" >= ${effectiveFrom}`);
  if (to)            conditions.push(Prisma.sql`m."kickoffTime" < ${new Date(to)}`);

  if (userIdFilter !== null) {
    conditions.push(Prisma.sql`p."userId" = ANY(${userIdFilter})`);
  }

  const whereClause = Prisma.join(conditions, ' AND ');

  const rows = await PredictionRepository.getLeaderboardStats(whereClause);

  const scoredUserIds = new Set(rows.map(r => Number(r.userId)));
  const allUserIds    = userIdFilter
    ? [...new Set([...scoredUserIds, ...userIdFilter])]
    : [...scoredUserIds];

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
    const totalPoints        = Number(entry.totalPoints);
    return [{
      userId: Number(entry.userId),
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl ?? null,
      totalPoints,
      predictionsCount,
      correctPredictions,
      accuracy: predictionsCount > 0 && maxPoints > 0 ? Math.round((totalPoints / (maxPoints * predictionsCount)) * 100) : 0,
      currentStreak: user.currentStreak,
      ...buildBadgeFields(user),
    }];
  });

  if (userIdFilter !== null) {
    for (const uid of userIdFilter) {
      if (!scoredUserIds.has(uid)) {
        const user = userMap.get(uid);
        if (!user) continue;
        result.push({
          userId: uid,
          name: user.name,
          email: user.email,
          avatarUrl: user.avatarUrl ?? null,
          totalPoints: 0,
          predictionsCount: 0,
          correctPredictions: 0,
          accuracy: 0,
          currentStreak: user.currentStreak,
          ...buildBadgeFields(user),
        });
      }
    }
  }

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
