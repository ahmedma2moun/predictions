import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getMobileSession } from '@/lib/mobile-auth';
import { Prisma } from '@prisma/client';

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const groupId = searchParams.get('groupId');

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

  const conditions: Prisma.Sql[] = [Prisma.sql`m.status = 'finished'`];
  if (userIdFilter !== null) {
    conditions.push(Prisma.sql`p."userId" = ANY(${userIdFilter})`);
  }
  const whereClause = Prisma.join(conditions, ' AND ');

  type AggRow = { userId: number; totalPoints: bigint };
  const rows = await prisma.$queryRaw<AggRow[]>(
    Prisma.sql`
      SELECT p."userId", SUM(p."pointsAwarded") AS "totalPoints"
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
    select: { id: true, name: true },
  });
  const userMap = new Map(users.map(u => [u.id, u]));

  const result = rows.flatMap((entry, idx) => {
    const user = userMap.get(Number(entry.userId));
    if (!user) return [];
    return [{ userId: user.id.toString(), name: user.name, totalPoints: Number(entry.totalPoints), rank: idx + 1 }];
  });

  return NextResponse.json(result);
}
