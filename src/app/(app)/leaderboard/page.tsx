"use client";
import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type LeaderboardEntry = {
  rank: number;
  userId: string;
  name: string;
  avatarUrl?: string;
  totalPoints: number;
  predictionsCount: number;
  accuracy: number;
};

type Group = {
  id: string;
  name: string;
  isDefault: boolean;
};

export default function LeaderboardPage() {
  const { data: session } = useSession();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [period, setPeriod]           = useState("all");
  const [groups, setGroups]           = useState<Group[]>([]);
  const [groupId, setGroupId]         = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  // Cache per "period+groupId" key so switching back is instant
  const cache = useRef<Record<string, LeaderboardEntry[]>>({});

  // Load user's groups once
  useEffect(() => {
    fetch("/api/groups")
      .then(r => r.json())
      .then((data: Group[]) => {
        setGroups(data);
        // Auto-select the default group if present
        const defaultGroup = data.find(g => g.isDefault);
        if (defaultGroup) setGroupId(defaultGroup.id);
      });
  }, []);

  useEffect(() => {
    const cacheKey = `${period}:${groupId ?? "all"}`;
    const cached = cache.current[cacheKey];
    if (cached) {
      setLeaderboard(cached);
      setIsRefreshing(true);
    } else {
      setLeaderboard([]);
    }

    const url = `/api/leaderboard?period=${period}${groupId ? `&groupId=${groupId}` : ""}`;
    fetch(url)
      .then((r) => r.json())
      .then((data: LeaderboardEntry[]) => {
        cache.current[cacheKey] = data;
        setLeaderboard(data);
        setIsRefreshing(false);
      });
  }, [period, groupId]);

  const myId = (session?.user as { id?: string } | undefined)?.id;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Leaderboard</h1>
        {isRefreshing && (
          <span className="text-xs text-muted-foreground animate-pulse">Updating…</span>
        )}
      </div>

      {/* Group selector */}
      {groups.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {groups.map(g => (
            <button
              key={g.id}
              onClick={() => setGroupId(g.id)}
              className={cn(
                "px-3 py-1 rounded-full text-sm font-medium border transition-colors",
                groupId === g.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:border-foreground hover:text-foreground"
              )}
            >
              {g.name}
            </button>
          ))}
        </div>
      )}

      <Tabs value={period} onValueChange={setPeriod}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all">All Time</TabsTrigger>
          <TabsTrigger value="month">This Month</TabsTrigger>
          <TabsTrigger value="week">This Week</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardContent className="pt-4">
          {leaderboard.length === 0 ? (
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
                    <span
                      className={cn(
                        "text-sm font-bold w-6 text-center",
                        idx < 3 ? "text-yellow-500" : "text-muted-foreground"
                      )}
                    >
                      {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : idx + 1}
                    </span>
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={entry.avatarUrl} />
                      <AvatarFallback className="text-xs">
                        {entry.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {entry.name}
                        {isMe && " (you)"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {entry.predictionsCount} picks · {entry.accuracy}% accurate
                      </p>
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
