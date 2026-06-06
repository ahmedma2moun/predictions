import { prisma } from '@/lib/prisma';
import { Prisma, BadgeKey, SeasonStatus } from '@prisma/client';
import { SeasonRepository } from '@/lib/repositories/season-repository';
import { UserRepository } from '@/lib/repositories/user-repository';
import { DeviceTokenRepository } from '@/lib/repositories/device-repository';
import { sendPushToUsers } from '@/lib/fcm';
import { sendSeasonEndEmail } from '@/lib/email';
import { logger } from '@/lib/logger';

export interface CreateSeasonInput {
  name: string;
  description?: string;
  startDate: Date;
  oddsEnabled?: boolean;
  oddsMin?: number;
  oddsMax?: number;
}

export interface SeasonWithStandings {
  id: number;
  name: string;
  description: string | null;
  status: SeasonStatus;
  startDate: Date;
  startedAt: Date | null;
  endedAt: Date | null;
  createdAt: Date;
  standings: StandingEntry[];
}

export interface StandingEntry {
  id: number;
  rank: number;
  totalPoints: number;
  totalPredictions: number;
  exactScores: number;
  groupId: number | null;
  groupName: string | null;
  userId: number;
  userName: string | null;
  userAvatar: string | null;
}

export const SeasonService = {
  getActiveSeason: () =>
    SeasonRepository.findFirst({ where: { status: 'ACTIVE' } }),

  getAllSeasons: () =>
    SeasonRepository.findMany({ orderBy: { createdAt: 'desc' } }),

  getPublicSeasons: () =>
    SeasonRepository.findMany({
      where: { status: { in: ['ACTIVE', 'ENDED'] } },
      orderBy: { createdAt: 'desc' },
    }),

  getSeasonById: (id: number) =>
    SeasonRepository.findUnique({ where: { id } }),

  async getSeasonWithStandings(id: number): Promise<SeasonWithStandings | null> {
    const season = await SeasonRepository.findUnique({ where: { id } });
    if (!season) return null;

    const rawStandings = await prisma.seasonStanding.findMany({
      where: { seasonId: id },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
        group: { select: { id: true, name: true } },
      },
      orderBy: [{ groupId: 'asc' }, { rank: 'asc' }],
    });

    const standings: StandingEntry[] = rawStandings.map(s => ({
      id: s.id,
      rank: s.rank,
      totalPoints: s.totalPoints,
      totalPredictions: s.totalPredictions,
      exactScores: s.exactScores,
      groupId: s.groupId,
      groupName: s.group?.name ?? null,
      userId: s.userId,
      userName: s.user.name,
      userAvatar: s.user.avatarUrl ?? null,
    }));

    return { ...season, standings };
  },

  async createSeason(input: CreateSeasonInput) {
    return SeasonRepository.create({
      data: {
        name: input.name,
        description: input.description ?? null,
        startDate: input.startDate,
        status: 'DRAFT',
        oddsEnabled: input.oddsEnabled ?? false,
        oddsMin: input.oddsMin ?? 1.1,
        oddsMax: input.oddsMax ?? 5.0,
      },
    });
  },

  async activateSeason(id: number) {
    const season = await SeasonRepository.findUnique({ where: { id } });
    if (!season) throw new Error('Season not found');
    if (season.status !== 'DRAFT') throw new Error('Only DRAFT seasons can be activated');

    const existing = await SeasonRepository.findFirst({ where: { status: 'ACTIVE' } });
    if (existing) throw new Error(`Season "${existing.name}" is already active`);

    const activated = await SeasonRepository.update({
      where: { id },
      data: { status: 'ACTIVE', startedAt: new Date() },
    });

    const retroCount = await retroAssignMatches(id, season.startDate);
    logger.info(`[season-service] Activated season ${id}, retro-assigned ${retroCount} matches`);

    return { season: activated, retroAssigned: retroCount };
  },

  async endSeason(id: number) {
    const season = await SeasonRepository.findUnique({ where: { id } });
    if (!season) throw new Error('Season not found');
    if (season.status !== 'ACTIVE') throw new Error('Only ACTIVE seasons can be ended');

    const endedAt = new Date();

    await recordFinalStandings(id);

    const updated = await SeasonRepository.update({
      where: { id },
      data: { status: 'ENDED', endedAt },
    });

    await notifySeasonEnd(id, season.name).catch(e =>
      logger.error('[season-service] Notification failed:', { error: e instanceof Error ? e.message : String(e) })
    );

    return updated;
  },

  async retroAssign(id: number) {
    const season = await SeasonRepository.findUnique({ where: { id } });
    if (!season) throw new Error('Season not found');
    if (season.status === 'DRAFT') throw new Error('Activate the season before retro-assigning');

    const count = await retroAssignMatches(id, season.startDate);
    return { retroAssigned: count };
  },

  async getChampionPreview(id: number) {
    return buildStandingsData(id);
  },
};

// ── Internals ──────────────────────────────────────────────────────────────────

async function retroAssignMatches(seasonId: number, startDate: Date): Promise<number> {
  const result = await prisma.match.updateMany({
    where: {
      seasonId: null,
      kickoffTime: { gte: startDate },
    },
    data: { seasonId },
  });
  return result.count;
}

interface UserStat {
  userId: number;
  totalPoints: number;
  totalPredictions: number;
  exactScores: number;
}

async function buildStandingsData(seasonId: number) {
  const predStats = await prisma.prediction.groupBy({
    by: ['userId'],
    where: { match: { seasonId, status: 'finished' } },
    _sum: { pointsAwarded: true },
    _count: { id: true },
  });

  if (predStats.length === 0) return { overall: [], perGroup: [] };

  const allUserIds = predStats.map(r => r.userId);

  const exactRows = await prisma.$queryRaw<Array<{ userId: bigint; exactCount: bigint }>>(
    Prisma.sql`
      SELECT p."userId", COUNT(*)::bigint AS "exactCount"
      FROM "Prediction" p
      JOIN "Match" m ON m.id = p."matchId"
      WHERE m."seasonId" = ${seasonId}
        AND m.status = 'finished'
        AND p."userId" = ANY(${allUserIds})
        AND p."scoringBreakdown" IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM jsonb_array_elements((p."scoringBreakdown")::jsonb->'rules') r
          WHERE r->>'key' = 'exact_score' AND r->>'matched' = 'true'
        )
      GROUP BY p."userId"
    `,
  );
  const exactMap = new Map(exactRows.map(r => [Number(r.userId), Number(r.exactCount)]));

  const users = await UserRepository.findMany({
    where: { id: { in: allUserIds }, role: { not: 'admin' } },
    select: { id: true, name: true, avatarUrl: true },
  });
  const userMap = new Map(users.map(u => [u.id, u]));

  const statMap = new Map<number, UserStat>(
    predStats.flatMap(r => {
      const user = userMap.get(r.userId);
      if (!user) return [];
      return [[r.userId, {
        userId: r.userId,
        totalPoints: r._sum.pointsAwarded ?? 0,
        totalPredictions: r._count.id,
        exactScores: exactMap.get(r.userId) ?? 0,
      }]];
    }),
  );

  const overallSorted = [...statMap.values()].sort((a, b) => b.totalPoints - a.totalPoints);

  const overall = overallSorted.map((s, idx) => ({
    ...s,
    rank: idx + 1,
    groupId: null as number | null,
    userName: userMap.get(s.userId)?.name ?? null,
    userAvatar: userMap.get(s.userId)?.avatarUrl ?? null,
  }));

  const groups = await prisma.group.findMany({
    select: { id: true, name: true, members: { select: { userId: true } } },
  });

  const perGroup = groups.flatMap(group => {
    const memberIds = new Set(group.members.map(m => m.userId));
    const sorted = [...statMap.values()]
      .filter(s => memberIds.has(s.userId))
      .sort((a, b) => b.totalPoints - a.totalPoints);

    return sorted.map((s, idx) => ({
      ...s,
      rank: idx + 1,
      groupId: group.id,
      groupName: group.name,
      userName: userMap.get(s.userId)?.name ?? null,
      userAvatar: userMap.get(s.userId)?.avatarUrl ?? null,
    }));
  });

  return { overall, perGroup };
}

async function recordFinalStandings(seasonId: number) {
  const { overall, perGroup } = await buildStandingsData(seasonId);

  await prisma.seasonStanding.deleteMany({ where: { seasonId } });

  const rows = [
    ...overall.map(s => ({
      seasonId,
      groupId: null as number | null,
      userId: s.userId,
      rank: s.rank,
      totalPoints: s.totalPoints,
      totalPredictions: s.totalPredictions,
      exactScores: s.exactScores,
    })),
    ...perGroup.map(s => ({
      seasonId,
      groupId: s.groupId,
      userId: s.userId,
      rank: s.rank,
      totalPoints: s.totalPoints,
      totalPredictions: s.totalPredictions,
      exactScores: s.exactScores,
    })),
  ];

  if (rows.length > 0) {
    await prisma.seasonStanding.createMany({ data: rows });
  }

  await awardSeasonBadges(overall, perGroup);
}

async function awardSeasonBadges(
  overall: Array<{ userId: number; rank: number }>,
  perGroup: Array<{ userId: number; rank: number }>,
) {
  for (const entry of overall) {
    if (entry.rank === 1) {
      await upsertBadge(entry.userId, BadgeKey.season_champion);
    } else if (entry.rank <= 3) {
      await upsertBadge(entry.userId, BadgeKey.season_podium);
    }
  }
  for (const entry of perGroup) {
    if (entry.rank === 1) {
      await upsertBadge(entry.userId, BadgeKey.group_season_champion);
    }
  }
}

async function upsertBadge(userId: number, badge: BadgeKey) {
  try {
    await prisma.userBadge.upsert({
      where: { userId_badge: { userId, badge } },
      create: { userId, badge },
      update: {},
    });
  } catch (e) {
    logger.error(`[season-service] Badge award failed ${badge} → user ${userId}:`, {
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

async function notifySeasonEnd(seasonId: number, seasonName: string) {
  const users = await UserRepository.findMany({
    where: { role: { not: 'admin' } },
    select: { id: true, notificationEmail: true },
  });

  const emailUsers = users.filter(u => u.notificationEmail);
  for (const u of emailUsers) {
    try {
      await sendSeasonEndEmail(u.notificationEmail!, seasonName);
    } catch (e) {
      logger.error(`[season-service] Email failed for user ${u.id}:`, {
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const mobileUsers = await DeviceTokenRepository.findMany({
    select: { userId: true },
    distinct: ['userId'],
  });
  const pushUserIds = mobileUsers.map(d => d.userId);

  try {
    await sendPushToUsers(pushUserIds, {
      title: `${seasonName} is over!`,
      body: 'The season has ended. See who won!',
      data: { type: 'season_end', seasonId: String(seasonId) },
    });
  } catch (e) {
    logger.error('[season-service] Push notification failed:', {
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
