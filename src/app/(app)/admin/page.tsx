import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { Match } from "@/models/Match";
import { Prediction } from "@/models/Prediction";
import { League } from "@/models/League";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function AdminDashboardPage() {
  await connectDB();
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const [totalUsers, activeLeagues, upcomingMatches, predictionsToday] = await Promise.all([
    User.countDocuments(),
    League.countDocuments({ isActive: true }),
    Match.countDocuments({ status: { $in: ["scheduled", "live"] } }),
    Prediction.countDocuments({ createdAt: { $gte: today } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Users", value: totalUsers },
          { label: "Active Leagues", value: activeLeagues },
          { label: "Upcoming Matches", value: upcomingMatches },
          { label: "Predictions Today", value: predictionsToday },
        ].map(stat => (
          <Card key={stat.label}>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <p className="text-3xl font-bold mt-1">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>Quick Actions</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Link href="/admin/leagues"><Button variant="outline">Manage Leagues</Button></Link>
          <Link href="/admin/matches"><Button variant="outline">Manage Matches</Button></Link>
          <Link href="/admin/users"><Button variant="outline">Manage Users</Button></Link>
          <Link href="/admin/scoring"><Button variant="outline">Scoring Rules</Button></Link>
        </CardContent>
      </Card>
    </div>
  );
}
