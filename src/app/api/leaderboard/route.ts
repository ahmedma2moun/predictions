import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const period   = searchParams.get('period') || 'all';
  const leagueId = searchParams.get('leagueId');
  const groupId  = searchParams.get('groupId');

  const matchWhere: any = { status: 'finished' };
  if (leagueId) matchWhere.externalLeagueId = Number(leagueId);

  const fromParam = searchParams.get('from');
  const toParam   = searchParams.get('to');
  if (fromParam || toParam) {
    matchWhere.kickoffTime = {};
    if (fromParam) matchWhere.kickoffTime.gte = new Date(fromParam);
    if (toParam)   matchWhere.kickoffTime.lt  = new Date(toParam);
  }

  // Restrict to group members when a group is selected
  let userIdFilter: number[] | null = null;
  if (groupId) {
    const group = await prisma.group.findUnique({
      where: { id: Number(groupId) },
      select: { isDefault: true, createdAt: true, members: { select: { userId: true } } },
    });
    if (!group) return NextResponse.json([]);

    // For non-general groups, only count matches that kicked off after the group was created.
    // If a period filter (week/month) is already applied, use whichever lower bound is later.
    if (!group.isDefault) {
      const existingGte: Date | undefined = matchWhere.kickoffTime?.gte;
      const groupGte = group.createdAt;
      matchWhere.kickoffTime = {
        ...(matchWhere.kickoffTime ?? {}),
        gte: existingGte && existingGte > groupGte ? existingGte : groupGte,
      };
    }

    userIdFilter = group.members.map(m => m.userId);
    if (userIdFilter.length === 0) return NextResponse.json([]);
  }

  const finishedMatches = await prisma.match.findMany({ where: matchWhere, select: { id: true } });
  const matchIds = finishedMatches.map(m => m.id);

  type AggRow = { userId: number; totalPoints: bigint; predictionsCount: bigint; correctPredictions: bigint };

  let rows: AggRow[] = [];
  if (matchIds.length > 0) {
    if (userIdFilter !== null) {
      rows = await prisma.$queryRaw<AggRow[]>`
        SELECT
          "userId",
          SUM("pointsAwarded")                                  AS "totalPoints",
          COUNT(*)                                               AS "predictionsCount",
          SUM(CASE WHEN "pointsAwarded" > 0 THEN 1 ELSE 0 END) AS "correctPredictions"
        FROM "Prediction"
        WHERE "matchId" = ANY(${matchIds})
          AND "userId"  = ANY(${userIdFilter})
        GROUP BY "userId"
        ORDER BY "totalPoints" DESC
        LIMIT 100
      `;
    } else {
      rows = await prisma.$queryRaw<AggRow[]>`
        SELECT
          "userId",
          SUM("pointsAwarded")                                  AS "totalPoints",
          COUNT(*)                                               AS "predictionsCount",
          SUM(CASE WHEN "pointsAwarded" > 0 THEN 1 ELSE 0 END) AS "correctPredictions"
        FROM "Prediction"
        WHERE "matchId" = ANY(${matchIds})
        GROUP BY "userId"
        ORDER BY "totalPoints" DESC
        LIMIT 100
      `;
    }
  }

  // Collect all user IDs we need: scored members + zero-score group members
  const scoredUserIds = new Set(rows.map(r => Number(r.userId)));
  const allUserIds = userIdFilter
    ? [...new Set([...scoredUserIds, ...userIdFilter])]
    : [...scoredUserIds];

  if (allUserIds.length === 0) return NextResponse.json([]);

  const users = await prisma.user.findMany({
    where: { id: { in: allUserIds }, role: { not: 'admin' } },
    select: { id: true, name: true, email: true, avatarUrl: true },
  });
  const userMap = new Map(users.map(u => [u.id, u]));

  const result = rows.flatMap((entry) => {
    const user = userMap.get(Number(entry.userId));
    if (!user) return []; // skip admins
    const predictionsCount   = Number(entry.predictionsCount);
    const correctPredictions = Number(entry.correctPredictions);
    return [{
      userId: Number(entry.userId),
      name: user?.name ?? 'Unknown',
      email: user?.email ?? '',
      avatarUrl: user?.avatarUrl ?? undefined,
      totalPoints: Number(entry.totalPoints),
      predictionsCount,
      correctPredictions,
      accuracy: predictionsCount > 0 ? Math.round((correctPredictions / predictionsCount) * 100) : 0,
    }];
  });

  // Append group members who have no predictions yet (only when a group is selected)
  if (userIdFilter !== null) {
    for (const uid of userIdFilter) {
      if (!scoredUserIds.has(uid)) {
        const user = userMap.get(uid);
        if (!user) continue; // skip admins and unknown users
        result.push({
          userId: uid,
          name: user?.name ?? 'Unknown',
          email: user?.email ?? '',
          avatarUrl: user?.avatarUrl ?? undefined,
          totalPoints: 0,
          predictionsCount: 0,
          correctPredictions: 0,
          accuracy: 0,
        });
      }
    }
  }

  return NextResponse.json(
    result.map((entry, idx) => ({ rank: idx + 1, ...entry, userId: entry.userId.toString() })),
    { headers: { "Cache-Control": "s-maxage=30, stale-while-revalidate=60" } },
  );
}
