"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export default function LeaderboardPage() {
  const { data: session } = useSession();
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [period, setPeriod] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/leaderboard?period=${period}`)
      .then(r => r.json())
      .then(data => { setLeaderboard(data); setLoading(false); });
  }, [period]);

  const myId = (session?.user as any)?.id;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <h1 className="text-2xl font-bold">Leaderboard</h1>
      <Tabs value={period} onValueChange={setPeriod}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all">All Time</TabsTrigger>
          <TabsTrigger value="month">This Month</TabsTrigger>
          <TabsTrigger value="week">This Week</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardContent className="pt-4">
          {loading ? (
            <div className="flex items-center justify-center py-8"><div className="animate-spin text-2xl">⚽</div></div>
          ) : leaderboard.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No predictions yet</p>
          ) : (
            <div className="space-y-2">
              {leaderboard.map((entry, idx) => {
                const isMe = entry.userId === myId;
                return (
                  <div
                    key={entry.userId}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg transition-colors",
                      isMe ? "bg-primary/10 border border-primary/30" : "hover:bg-accent"
                    )}
                  >
                    <span className={cn("text-sm font-bold w-6 text-center", idx < 3 ? "text-yellow-500" : "text-muted-foreground")}>
                      {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : idx + 1}
                    </span>
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={entry.avatarUrl} />
                      <AvatarFallback className="text-xs">{entry.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{entry.name}{isMe && " (you)"}</p>
                      <p className="text-xs text-muted-foreground">{entry.predictionsCount} picks · {entry.accuracy}% accurate</p>
                    </div>
                    <Badge variant={isMe ? "default" : "outline"} className="font-bold">
                      {entry.totalPoints} pts
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
