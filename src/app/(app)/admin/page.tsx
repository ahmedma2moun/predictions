import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { MatchRepository } from '@/lib/repositories/match-repository';
import { PredictionRepository } from '@/lib/repositories/prediction-repository';

export default async function AdminDashboardPage() {
  await auth();
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const [totalUsers, activeLeagues, upcomingMatches, predictionsToday] = await Promise.all([
    prisma.user.count(),
    prisma.league.count({ where: { isActive: true } }),
    MatchRepository.count({ where: { status: { in: ['scheduled', 'live'] } } }),
    PredictionRepository.count({ where: { createdAt: { gte: today } } }),
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
