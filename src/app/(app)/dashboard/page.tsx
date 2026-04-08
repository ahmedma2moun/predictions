import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serializeMatch } from "@/models/Match";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { KickoffTime } from "@/components/KickoffTime";
import { Calendar, Trophy, TrendingUp, Users } from "lucide-react";

export default async function DashboardPage() {
  const session = await auth();
  const userId = Number((session!.user as any).id);
  const isAdmin = (session!.user as any).role === "admin";

  const [upcomingMatches, userPredictions, leaderboardTop, totalUsers, myStats] = await Promise.all([
    prisma.match.findMany({
      where: { status: { in: ['scheduled', 'live'] } },
      orderBy: { kickoffTime: 'asc' },
      take: 5,
    }),
    isAdmin
      ? Promise.resolve([])
      : prisma.prediction.findMany({
          where: { userId },
          include: { match: true },
          orderBy: { createdAt: 'desc' },
          take: 5,
        }),
    prisma.$queryRaw<Array<{ userId: number; totalPoints: bigint }>>`
      SELECT "userId", SUM("pointsAwarded") AS "totalPoints"
      FROM "Prediction"
      GROUP BY "userId"
      ORDER BY "totalPoints" DESC
      LIMIT 5
    `,
    isAdmin ? prisma.user.count() : Promise.resolve(null),
    isAdmin
      ? Promise.resolve([{ total: BigInt(0), count: BigInt(0) }])
      : prisma.$queryRaw<Array<{ total: bigint; count: bigint }>>`
          SELECT SUM("pointsAwarded") AS total, COUNT(*) AS count
          FROM "Prediction"
          WHERE "userId" = ${userId}
        `,
  ]);

  const topUserIds = leaderboardTop.map(l => Number(l.userId));
  const topUsers = await prisma.user.findMany({
    where: { id: { in: topUserIds } },
    select: { id: true, name: true },
  });
  const userNameMap = new Map(topUsers.map(u => [u.id, u.name]));

  const myTotal = Number(myStats[0]?.total ?? 0);
  const myCount = Number(myStats[0]?.count ?? 0);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-yellow-500" />
              <span className="text-sm text-muted-foreground">My Points</span>
            </div>
            <p className="text-2xl font-bold mt-1">{myTotal}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">Predictions</span>
            </div>
            <p className="text-2xl font-bold mt-1">{myCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">Upcoming</span>
            </div>
            <p className="text-2xl font-bold mt-1">{upcomingMatches.length}</p>
          </CardContent>
        </Card>
        {isAdmin && (
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-purple-500" />
                <span className="text-sm text-muted-foreground">Users</span>
              </div>
              <p className="text-2xl font-bold mt-1">{totalUsers}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Upcoming matches */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Upcoming Matches</span>
            <Link href="/matches" className="text-sm font-normal text-primary hover:underline">View all →</Link>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {upcomingMatches.length === 0 ? (
            <p className="text-muted-foreground text-sm">No upcoming matches</p>
          ) : (
            upcomingMatches.map(match => {
              const s = serializeMatch(match);
              return (
                <Link key={s._id} href={`/matches/${s._id}`} className="block">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-accent hover:bg-accent/80 transition-colors">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{s.homeTeam.name} vs {s.awayTeam.name}</p>
                      <p className="text-xs text-muted-foreground"><KickoffTime date={match.kickoffTime} /></p>
                    </div>
                    <Badge variant={match.status === "live" ? "destructive" : "secondary"}>
                      {match.status === "live" ? "LIVE" : <KickoffTime date={match.kickoffTime} weekdayOnly />}
                    </Badge>
                  </div>
                </Link>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Mini leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Top Predictors</span>
            <Link href="/leaderboard" className="text-sm font-normal text-primary hover:underline">Full table →</Link>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {leaderboardTop.length === 0 ? (
            <p className="text-muted-foreground text-sm">No scores yet</p>
          ) : (
            <div className="space-y-2">
              {leaderboardTop.map((entry, idx) => (
                <div key={Number(entry.userId)} className="flex items-center justify-between p-2 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground text-sm w-5">{idx + 1}</span>
                    <span className="font-medium text-sm">{userNameMap.get(Number(entry.userId)) ?? "Unknown"}</span>
                  </div>
                  <Badge variant="outline">{Number(entry.totalPoints)} pts</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
