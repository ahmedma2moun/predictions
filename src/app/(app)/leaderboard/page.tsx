"use client";
import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
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

type CacheEntry = { data: LeaderboardEntry[]; ts: number };
const CACHE_TTL_MS = 60_000; // 1 minute

export default function LeaderboardPage() {
  const { data: session } = useSession();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [period, setPeriod]           = useState("all");
  const [groups, setGroups]           = useState<Group[]>([]);
  const [groupId, setGroupId]         = useState<string | null>(null);
  // groupsReady prevents the leaderboard fetch from firing before we know
  // which group to filter by — eliminates the "all users flash" on first load.
  const [groupsReady, setGroupsReady] = useState(false);
  const [isLoading, setIsLoading]     = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const cache = useRef<Record<string, CacheEntry>>({});

  // Load user's groups once; mark groupsReady only after we've set the default groupId
  useEffect(() => {
    fetch("/api/groups")
      .then(r => {
        if (!r.ok) throw new Error("Failed to load groups");
        return r.json();
      })
      .then((data: Group[]) => {
        setGroups(data);
        const defaultGroup = data.find(g => g.isDefault);
        if (defaultGroup) setGroupId(defaultGroup.id);
        setGroupsReady(true);
      })
      .catch(() => {
        // Even on error, unblock the leaderboard fetch
        setGroupsReady(true);
      });
  }, []);

  useEffect(() => {
    // Don't fetch until we know which group to show — prevents the all-users flash
    if (!groupsReady) return;

    const cacheKey = `${period}:${groupId ?? "all"}`;
    const cached = cache.current[cacheKey];
    const now = Date.now();

    if (cached && now - cached.ts < CACHE_TTL_MS) {
      setLeaderboard(cached.data);
      setIsLoading(false);
      setIsRefreshing(true);
    } else {
      setLeaderboard([]);
      setIsLoading(true);
    }

    const url = `/api/leaderboard?period=${period}${groupId ? `&groupId=${groupId}` : ""}`;
    fetch(url)
      .then(r => {
        if (!r.ok) throw new Error("Failed to load leaderboard");
        return r.json();
      })
      .then((data: LeaderboardEntry[]) => {
        cache.current[cacheKey] = { data, ts: Date.now() };
        setLeaderboard(data);
        setIsLoading(false);
        setIsRefreshing(false);
      })
      .catch(() => {
        setIsLoading(false);
        setIsRefreshing(false);
      });
  }, [period, groupId, groupsReady]);

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
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3">
                  <Skeleton className="h-4 w-6 rounded" />
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-4 w-32 rounded" />
                    <Skeleton className="h-3 w-48 rounded" />
                  </div>
                  <Skeleton className="h-6 w-12 rounded" />
                </div>
              ))}
            </div>
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
