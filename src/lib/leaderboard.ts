import type { GroupLeaderboard } from '@/lib/email';
import { PredictionRepository } from '@/lib/repositories/prediction-repository';
import { GroupMemberRepository } from '@/lib/repositories/group-member-repository';

/**
 * Returns leaderboard data for all non-default groups the given user belongs to.
 * Entries are sorted by total points descending.
 *
 * Uses 2 DB queries regardless of the number of groups (was N+1 before):
 *   1. Fetch all group memberships with their full member lists in one include.
 *   2. One groupBy aggregation across all member IDs combined.
 */
export async function getUserGroupLeaderboards(userId: number): Promise<GroupLeaderboard[]> {
  // Single query: get all non-default groups the user belongs to,
  // with each group's full member list included.
  const memberships = await GroupMemberRepository.findMany({
    where: { userId, group: { isDefault: false } },
    select: {
      group: {
        select: {
          name: true,
          members: {
            select: { userId: true, user: { select: { name: true } } },
          },
        },
      },
    },
  });

  if (!memberships.length) return [];

  // Collect every member ID across all groups for a single aggregation query.
  const allMemberIds = [
    ...new Set(memberships.flatMap(m => m.group.members.map(gm => gm.userId))),
  ];

  // Single aggregation for all members — no more N per-group queries.
  const pointRows = (await PredictionRepository.groupBy({
    by: ['userId'],
    where: { userId: { in: allMemberIds } },
    _sum: { pointsAwarded: true },
  })) as any[];

  const pointMap = new Map(pointRows.map(r => [r.userId, r._sum.pointsAwarded ?? 0]));

  return memberships.map(({ group }) => {
    const entries = group.members
      .map(m => ({ userName: m.user.name, totalPoints: pointMap.get(m.userId) ?? 0 }))
      .sort((a, b) => b.totalPoints - a.totalPoints);
    return { groupName: group.name, entries };
  });
}
