import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const leagueIds = searchParams.getAll('leagueId').map(Number).filter(Boolean);
  const groupId   = searchParams.get('groupId');
  const fromParam = searchParams.get('from');
  const toParam   = searchParams.get('to');

  // Resolve group constraints
  let userIdFilter: number[] | null = null;
  let groupKickoffGte: Date | null = null;

  if (groupId) {
    const group = await prisma.group.findUnique({
      where: { id: Number(groupId) },
      select: { isDefault: true, createdAt: true, members: { select: { userId: true } } },
    });
    if (!group) return NextResponse.json([]);

    if (!group.isDefault) {
      const existingGte = fromParam ? new Date(fromParam) : null;
      const groupGte    = group.createdAt;
      groupKickoffGte   = existingGte && existingGte > groupGte ? existingGte : groupGte;
    }

    userIdFilter = group.members.map(m => m.userId);
    if (userIdFilter.length === 0) return NextResponse.json([]);
  }

  // Build WHERE conditions — all filters pushed into a single JOIN query,
  // eliminating the previous two-step "fetch matchIds → pass giant array to SQL" pattern.
  const conditions: Prisma.Sql[] = [Prisma.sql`m.status = 'finished'`];

  if (leagueIds.length === 1) {
    conditions.push(Prisma.sql`m."externalLeagueId" = ${leagueIds[0]}`);
  } else if (leagueIds.length > 1) {
    conditions.push(Prisma.sql`m."externalLeagueId" = ANY(${leagueIds})`);
  }

  const effectiveFrom = groupKickoffGte ?? (fromParam ? new Date(fromParam) : null);
  if (effectiveFrom) conditions.push(Prisma.sql`m."kickoffTime" >= ${effectiveFrom}`);
  if (toParam)       conditions.push(Prisma.sql`m."kickoffTime" < ${new Date(toParam)}`);

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
    `
  );

  // Collect all user IDs: scored members + zero-score group members
  const scoredUserIds = new Set(rows.map(r => Number(r.userId)));
  const allUserIds    = userIdFilter
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
    if (!user) return [];
    const predictionsCount   = Number(entry.predictionsCount);
    const correctPredictions = Number(entry.correctPredictions);
    return [{
      userId: Number(entry.userId),
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl ?? undefined,
      totalPoints: Number(entry.totalPoints),
      predictionsCount,
      correctPredictions,
      accuracy: predictionsCount > 0 ? Math.round((correctPredictions / predictionsCount) * 100) : 0,
    }];
  });

  // Append group members with zero predictions (only when a group is selected)
  if (userIdFilter !== null) {
    for (const uid of userIdFilter) {
      if (!scoredUserIds.has(uid)) {
        const user = userMap.get(uid);
        if (!user) continue;
        result.push({
          userId: uid,
          name: user.name,
          email: user.email,
          avatarUrl: user.avatarUrl ?? undefined,
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
    { headers: { 'Cache-Control': 's-maxage=30, stale-while-revalidate=60' } },
  );
}
