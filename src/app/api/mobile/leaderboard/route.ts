import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getMobileSession } from '@/lib/mobile-auth';
import { Prisma } from '@prisma/client';

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const groupId = searchParams.get('groupId');
  const from    = searchParams.get('from');
  const to      = searchParams.get('to');

  let userIdFilter: number[] | null = null;

  if (groupId) {
    const group = await prisma.group.findUnique({
      where: { id: Number(groupId) },
      select: { members: { select: { userId: true } } },
    });
    if (!group) return NextResponse.json([]);
    userIdFilter = group.members.map(m => m.userId);
    if (userIdFilter.length === 0) return NextResponse.json([]);
  }

  const matchConditions: Prisma.Sql[] = [Prisma.sql`m.status = 'finished'`];
  if (from) matchConditions.push(Prisma.sql`m."kickoffTime" >= ${new Date(from)}`);
  if (to)   matchConditions.push(Prisma.sql`m."kickoffTime" < ${new Date(to)}`);

  const predConditions: Prisma.Sql[] = [...matchConditions];
  if (userIdFilter !== null) {
    predConditions.push(Prisma.sql`p."userId" = ANY(${userIdFilter})`);
  }
  const whereClause = Prisma.join(predConditions, ' AND ');

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

  const userIds = rows.map(r => Number(r.userId));
  if (userIds.length === 0) return NextResponse.json([]);

  const users = await prisma.user.findMany({
    where: { id: { in: userIds }, role: { not: 'admin' } },
    select: { id: true, name: true, avatarUrl: true },
  });
  const userMap = new Map(users.map(u => [u.id, u]));

  const result = rows.flatMap((entry, idx) => {
    const user = userMap.get(Number(entry.userId));
    if (!user) return [];
    const predictionsCount = Number(entry.predictions);
    const scoredCount = Number(entry.scoredPredictions);
    const accuracy = predictionsCount > 0 ? Math.round((scoredCount / predictionsCount) * 100) : 0;
    return [{
      userId: user.id.toString(),
      name: user.name,
      avatarUrl: user.avatarUrl ?? null,
      totalPoints: Number(entry.totalPoints),
      predictionsCount,
      accuracy,
      rank: idx + 1,
    }];
  });

  return NextResponse.json(result);
}
