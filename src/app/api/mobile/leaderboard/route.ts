import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getMobileSession } from '@/lib/mobile-auth';
import { Prisma } from '@prisma/client';

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const groupId   = searchParams.get('groupId');
  const from      = searchParams.get('from');
  const to        = searchParams.get('to');
  const leagueIds = searchParams.getAll('leagueId').map(Number).filter(Boolean);

  let userIdFilter: number[] | null = null;
  let groupKickoffGte: Date | null = null;

  if (groupId) {
    const group = await prisma.group.findUnique({
      where: { id: Number(groupId) },
      select: { isDefault: true, createdAt: true, members: { select: { userId: true } } },
    });
    if (!group) return NextResponse.json([]);
    if (!group.isDefault) {
      const existingGte = from ? new Date(from) : null;
      const groupGte    = group.createdAt;
      groupKickoffGte   = existingGte && existingGte > groupGte ? existingGte : groupGte;
    }
    userIdFilter = group.members.map(m => m.userId);
    if (userIdFilter.length === 0) return NextResponse.json([]);
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

  type AggRow = { userId: number; totalPoints: bigint; predictions: bigint; scoredPredictions: bigint };
  const rows = await prisma.$queryRaw<AggRow[]>(
    Prisma.sql`
      SELECT
        p."userId",
        SUM(p."pointsAwarded")                              AS "totalPoints",
        COUNT(*)                                            AS "predictions",
        COUNT(*) FILTER (WHERE p."pointsAwarded" > 0)      AS "scoredPredictions"
      FROM "Prediction" p
      JOIN "Match" m ON m.id = p."matchId"
      WHERE ${whereClause}
      GROUP BY p."userId"
      ORDER BY "totalPoints" DESC
      LIMIT 100
    `
  );

  const scoredUserIds = new Set(rows.map(r => Number(r.userId)));
  const allUserIds    = userIdFilter
    ? [...new Set([...scoredUserIds, ...userIdFilter])]
    : [...scoredUserIds];
  if (allUserIds.length === 0) return NextResponse.json([]);

  const users = await prisma.user.findMany({
    where: { id: { in: allUserIds }, role: { not: 'admin' } },
    select: { id: true, name: true, avatarUrl: true },
  });
  const userMap = new Map(users.map(u => [u.id, u]));

  const result = rows.flatMap((entry) => {
    const user = userMap.get(Number(entry.userId));
    if (!user) return [];
    const predictionsCount = Number(entry.predictions);
    const scoredCount = Number(entry.scoredPredictions);
    const accuracy = predictionsCount > 0 ? Math.round((scoredCount / predictionsCount) * 100) : 0;
    return [{
      userId: user.id,
      name: user.name,
      avatarUrl: user.avatarUrl ?? null,
      totalPoints: Number(entry.totalPoints),
      predictionsCount,
      accuracy,
    }];
  });

  // Append zero-score group members so they show up in the group leaderboard.
  if (userIdFilter !== null) {
    for (const uid of userIdFilter) {
      if (scoredUserIds.has(uid)) continue;
      const user = userMap.get(uid);
      if (!user) continue;
      result.push({
        userId: uid,
        name: user.name,
        avatarUrl: user.avatarUrl ?? null,
        totalPoints: 0,
        predictionsCount: 0,
        accuracy: 0,
      });
    }
  }

  return NextResponse.json(
    result.map((entry, idx) => ({ rank: idx + 1, ...entry, userId: entry.userId.toString() })),
    { headers: { 'Cache-Control': 's-maxage=30, stale-while-revalidate=60' } },
  );
}
