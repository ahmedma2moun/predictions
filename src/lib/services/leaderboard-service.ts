import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

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
}

export async function getLeaderboard(filters: LeaderboardFilters): Promise<LeaderboardEntry[]> {
  const { leagueIds = [], groupId, from, to } = filters;

  let userIdFilter: number[] | null = null;
  let groupKickoffGte: Date | null = null;

  if (groupId) {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { isDefault: true, createdAt: true, members: { select: { userId: true } } },
    });
    if (!group) return [];

    if (!group.isDefault) {
      const existingGte = from ? new Date(from) : null;
      const groupGte    = group.createdAt;
      groupKickoffGte   = existingGte && existingGte > groupGte ? existingGte : groupGte;
    }

    userIdFilter = group.members.map(m => m.userId);
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

  type AggRow = { userId: number; totalPoints: bigint; predictionsCount: bigint; correctPredictions: bigint };

  const rows = await prisma.$queryRaw<AggRow[]>(
    Prisma.sql`
      SELECT
        p."userId",
        SUM(p."pointsAwarded")                                  AS "totalPoints",
        COUNT(*)                                                 AS "predictionsCount",
        SUM(CASE WHEN p."pointsAwarded" > 0 THEN 1 ELSE 0 END) AS "correctPredictions"
      FROM "Prediction" p
      JOIN "Match" m ON m.id = p."matchId"
      WHERE ${whereClause}
      GROUP BY p."userId"
      ORDER BY "totalPoints" DESC
      LIMIT 100
    `,
  );

  const scoredUserIds = new Set(rows.map(r => Number(r.userId)));
  const allUserIds    = userIdFilter
    ? [...new Set([...scoredUserIds, ...userIdFilter])]
    : [...scoredUserIds];

  if (allUserIds.length === 0) return [];

  const users = await prisma.user.findMany({
    where: { id: { in: allUserIds }, role: { not: 'admin' } },
    select: { id: true, name: true, email: true, avatarUrl: true },
  });
  const userMap = new Map(users.map(u => [u.id, u]));

  const result: LeaderboardEntry[] = rows.flatMap(entry => {
    const user = userMap.get(Number(entry.userId));
    if (!user) return [];
    const predictionsCount   = Number(entry.predictionsCount);
    const correctPredictions = Number(entry.correctPredictions);
    return [{
      userId: Number(entry.userId),
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl ?? null,
      totalPoints: Number(entry.totalPoints),
      predictionsCount,
      correctPredictions,
      accuracy: predictionsCount > 0 ? Math.round((correctPredictions / predictionsCount) * 100) : 0,
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
        });
      }
    }
  }

  return result;
}
