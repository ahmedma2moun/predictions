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

  // --- Match filter ---
  const matchWhere: any = { status: 'finished' };
  if (leagueId) matchWhere.externalLeagueId = Number(leagueId);

  const now = new Date();
  if (period === 'week') {
    matchWhere.kickoffTime = { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) };
  } else if (period === 'month') {
    matchWhere.kickoffTime = { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) };
  }

  // When a group is selected, also filter matches by the group's leagues and teams (if any are set)
  let userIdFilter: number[] | null = null;

  if (groupId) {
    const group = await prisma.group.findUnique({
      where: { id: Number(groupId) },
      include: {
        members:      { select: { userId: true } },
        groupLeagues: { select: { league: { select: { externalId: true } } } },
        groupTeams:   { select: { team:   { select: { externalId: true } } } },
      },
    });

    if (group) {
      userIdFilter = group.members.map(m => m.userId);
      if (userIdFilter.length === 0) return NextResponse.json([]);

      const groupExternalLeagueIds = group.groupLeagues.map(gl => gl.league.externalId);
      const groupTeamExternalIds   = group.groupTeams.map(gt => gt.team.externalId);

      if (groupExternalLeagueIds.length > 0 || groupTeamExternalIds.length > 0) {
        const conditions: any[] = [];
        if (groupExternalLeagueIds.length > 0) {
          conditions.push({ externalLeagueId: { in: groupExternalLeagueIds } });
        }
        if (groupTeamExternalIds.length > 0) {
          conditions.push({
            OR: [
              { homeTeamExtId: { in: groupTeamExternalIds } },
              { awayTeamExtId: { in: groupTeamExternalIds } },
            ],
          });
        }
        matchWhere.OR = conditions;
      }
    }
  }

  const finishedMatches = await prisma.match.findMany({ where: matchWhere, select: { id: true } });
  const matchIds = finishedMatches.map(m => m.id);
  if (matchIds.length === 0) return NextResponse.json([]);

  // Build aggregation with optional user filter
  type AggRow = { userId: number; totalPoints: bigint; predictionsCount: bigint; correctPredictions: bigint };

  let rows: AggRow[];
  if (userIdFilter !== null) {
    rows = await prisma.$queryRaw<AggRow[]>`
      SELECT
        "userId",
        SUM("pointsAwarded")                                          AS "totalPoints",
        COUNT(*)                                                       AS "predictionsCount",
        SUM(CASE WHEN "pointsAwarded" > 0 THEN 1 ELSE 0 END)         AS "correctPredictions"
      FROM "Prediction"
      WHERE "matchId" = ANY(${matchIds})
        AND "userId" = ANY(${userIdFilter})
      GROUP BY "userId"
      ORDER BY "totalPoints" DESC
      LIMIT 100
    `;
  } else {
    rows = await prisma.$queryRaw<AggRow[]>`
      SELECT
        "userId",
        SUM("pointsAwarded")                                          AS "totalPoints",
        COUNT(*)                                                       AS "predictionsCount",
        SUM(CASE WHEN "pointsAwarded" > 0 THEN 1 ELSE 0 END)         AS "correctPredictions"
      FROM "Prediction"
      WHERE "matchId" = ANY(${matchIds})
      GROUP BY "userId"
      ORDER BY "totalPoints" DESC
      LIMIT 100
    `;
  }

  const userIds = rows.map(r => Number(r.userId));
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true, avatarUrl: true },
  });
  const userMap = new Map(users.map(u => [u.id, u]));

  const result = rows.map((entry, idx) => {
    const user = userMap.get(Number(entry.userId));
    const predictionsCount   = Number(entry.predictionsCount);
    const correctPredictions = Number(entry.correctPredictions);
    return {
      rank: idx + 1,
      userId: entry.userId.toString(),
      name: user?.name ?? 'Unknown',
      email: user?.email ?? '',
      avatarUrl: user?.avatarUrl ?? undefined,
      totalPoints: Number(entry.totalPoints),
      predictionsCount,
      correctPredictions,
      accuracy: predictionsCount > 0 ? Math.round((correctPredictions / predictionsCount) * 100) : 0,
    };
  });

  return NextResponse.json(result, {
    headers: { "Cache-Control": "s-maxage=30, stale-while-revalidate=60" },
  });
}
