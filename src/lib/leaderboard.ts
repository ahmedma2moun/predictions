import { Prisma } from '@prisma/client';
import type { GroupLeaderboard } from '@/lib/email';
import { PredictionRepository } from '@/lib/repositories/prediction-repository';
import { GroupMemberRepository } from '@/lib/repositories/group-member-repository';

/**
 * Returns leaderboard data for all non-default groups the given user belongs to.
 * Each group's scores are counted only from predictions on matches played after the
 * group was created (group.createdAt), matching the leaderboard page behaviour.
 * Entries are sorted by total points descending.
 */
export async function getUserGroupLeaderboards(userId: number): Promise<GroupLeaderboard[]> {
  const memberships = await GroupMemberRepository.findMany({
    where: { userId, group: { isDefault: false } },
    select: {
      group: {
        select: {
          name: true,
          createdAt: true,
          members: {
            where: { user: { role: { not: 'admin' } } },
            select: { userId: true, user: { select: { name: true } } },
          },
        },
      },
    },
  });

  if (!memberships.length) return [];

  // Run per-group aggregations in parallel; each is filtered by group.createdAt so
  // only predictions from matches kicked off after group creation are counted.
  return Promise.all(
    memberships.map(async ({ group }) => {
      const memberIds = group.members.map(m => m.userId);

      const whereClause = Prisma.sql`
        m.status = 'finished'
        AND m."kickoffTime" >= ${group.createdAt}
        AND p."userId" = ANY(${memberIds})
      `;

      const pointRows = await PredictionRepository.getLeaderboardStats(whereClause);
      const pointMap = new Map(pointRows.map(r => [Number(r.userId), Number(r.totalPoints)]));

      const entries = group.members
        .map(m => ({ userName: m.user.name, totalPoints: pointMap.get(m.userId) ?? 0 }))
        .sort((a, b) => b.totalPoints - a.totalPoints);

      return { groupName: group.name, entries };
    }),
  );
}
