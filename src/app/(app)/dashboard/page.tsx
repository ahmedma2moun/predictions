import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Match } from "@/models/Match";
import { Prediction } from "@/models/Prediction";
import { User } from "@/models/User";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { formatKickoff, isMatchLocked } from "@/lib/utils";
import { Calendar, Trophy, TrendingUp, Users } from "lucide-react";

export default async function DashboardPage() {
  const session = await auth();
  const userId = (session!.user as any).id;
  const isAdmin = (session!.user as any).role === "admin";

  await connectDB();

  const [upcomingMatches, userPredictions, leaderboardTop, totalUsers] = await Promise.all([
    Match.find({ status: { $in: ["scheduled", "live"] } }).sort({ kickoffTime: 1 }).limit(5).lean(),
    Prediction.find({ userId }).populate("matchId").sort({ createdAt: -1 }).limit(5).lean(),
    Prediction.aggregate([
      { $group: { _id: "$userId", totalPoints: { $sum: "$pointsAwarded" } } },
      { $sort: { totalPoints: -1 } },
      { $limit: 5 },
    ]),
    isAdmin ? User.countDocuments() : Promise.resolve(null),
  ]);

  const userIds = leaderboardTop.map((l: any) => l._id);
  const topUsers = await User.find({ _id: { $in: userIds } }, "name").lean();
  const userNameMap = new Map(topUsers.map(u => [u._id.toString(), u.name]));

  const myStats = await Prediction.aggregate([
    { $match: { userId: { $oid: userId } } },
    { $group: { _id: null, total: { $sum: "$pointsAwarded" }, count: { $sum: 1 } } },
  ]).catch(() => []);

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
            <p className="text-2xl font-bold mt-1">{myStats[0]?.total ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">Predictions</span>
            </div>
            <p className="text-2xl font-bold mt-1">{myStats[0]?.count ?? 0}</p>
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
            upcomingMatches.map((match: any) => (
              <Link key={match._id.toString()} href={`/matches/${match._id}`} className="block">
                <div className="flex items-center justify-between p-3 rounded-lg bg-accent hover:bg-accent/80 transition-colors">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{match.homeTeam.name} vs {match.awayTeam.name}</p>
                    <p className="text-xs text-muted-foreground">{formatKickoff(match.kickoffTime)}</p>
                  </div>
                  <Badge variant={match.status === "live" ? "destructive" : "secondary"}>
                    {match.status === "live" ? "LIVE" : formatKickoff(match.kickoffTime).split(",")[0]}
                  </Badge>
                </div>
              </Link>
            ))
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
              {leaderboardTop.map((entry: any, idx: number) => (
                <div key={entry._id.toString()} className="flex items-center justify-between p-2 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground text-sm w-5">{idx + 1}</span>
                    <span className="font-medium text-sm">{userNameMap.get(entry._id.toString()) ?? "Unknown"}</span>
                  </div>
                  <Badge variant="outline">{entry.totalPoints} pts</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
