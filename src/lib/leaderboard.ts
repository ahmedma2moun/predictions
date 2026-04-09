import { prisma } from '@/lib/prisma';
import type { GroupLeaderboard } from '@/lib/email';

/**
 * Returns leaderboard data for all non-default groups the given user belongs to.
 * Entries are sorted by total points descending.
 */
export async function getUserGroupLeaderboards(userId: number): Promise<GroupLeaderboard[]> {
  // Find groups the user belongs to, excluding the default (General) group
  const memberships = await prisma.groupMember.findMany({
    where: { userId, group: { isDefault: false } },
    select: { groupId: true, group: { select: { name: true } } },
  });

  if (!memberships.length) return [];

  const result: GroupLeaderboard[] = [];

  for (const { groupId, group } of memberships) {
    // Get all members of this group
    const members = await prisma.groupMember.findMany({
      where: { groupId },
      select: { userId: true, user: { select: { name: true } } },
    });

    const memberIds = members.map(m => m.userId);
    const userNameMap = new Map(members.map(m => [m.userId, m.user.name]));

    // Sum all-time points per member
    const pointRows = await prisma.prediction.groupBy({
      by: ['userId'],
      where: { userId: { in: memberIds } },
      _sum: { pointsAwarded: true },
    });

    const pointMap = new Map(pointRows.map(r => [r.userId, r._sum.pointsAwarded ?? 0]));

    const entries = memberIds
      .map(id => ({ userName: userNameMap.get(id) ?? 'Unknown', totalPoints: pointMap.get(id) ?? 0 }))
      .sort((a, b) => b.totalPoints - a.totalPoints);

    result.push({ groupName: group.name, entries });
  }

  return result;
}
