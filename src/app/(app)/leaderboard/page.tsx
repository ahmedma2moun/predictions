"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { KickoffTime } from "@/components/KickoffTime";
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScoringBreakdown, type RuleBreakdown } from "@/components/ScoringBreakdown";

// ── Types ─────────────────────────────────────────────────────────────────────

type LeaderboardEntry = {
  rank: number;
  userId: string;
  name: string;
  avatarUrl?: string;
  totalPoints: number;
  predictionsCount: number;
  accuracy: number;
};

type Group = { id: string; name: string; isDefault: boolean };

type League = { id: string; externalId: number; name: string; country: string; logo?: string };

type UserPrediction = {
  matchId: string;
  kickoffTime: string;
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number;
  awayScore: number;
  result: { homeScore: number; awayScore: number };
  pointsAwarded: number;
  scoringBreakdown: RuleBreakdown[] | null;
};

// ── Date helpers ──────────────────────────────────────────────────────────────

/** Week = Friday 00:00 to next Friday 00:00 (local time). */
function getWeekBounds(offset: number): { from: Date; to: Date } {
  const now = new Date();
  // 0=Sun,1=Mon,…,5=Fri,6=Sat  →  days since last Friday
  const daysSinceFriday = (now.getDay() - 5 + 7) % 7;
  const friday = new Date(now);
  friday.setDate(now.getDate() - daysSinceFriday + offset * 7);
  friday.setHours(0, 0, 0, 0);
  const nextFriday = new Date(friday);
  nextFriday.setDate(friday.getDate() + 7);
  return { from: friday, to: nextFriday };
}

/** Month = first day of month 00:00 to first day of next month 00:00 (local). */
function getMonthBounds(offset: number): { from: Date; to: Date } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const to   = new Date(now.getFullYear(), now.getMonth() + offset + 1, 1);
  return { from, to };
}

function fmtDate(d: Date) {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function fmtMonthYear(d: Date) {
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

// ── Sub-component: per-user prediction list ───────────────────────────────────

function UserPredictionList({ predictions }: { predictions: UserPrediction[] }) {
  if (predictions.length === 0) {
    return <p className="text-xs text-muted-foreground text-center py-2">No scored predictions in this period.</p>;
  }
  return (
    <div className="mt-2 space-y-2 border-t pt-2">
      {predictions.map((p) => (
        <div key={p.matchId} className="rounded-md bg-muted/40 px-3 py-2 text-xs space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium truncate">
              {p.homeTeamName} <span className="text-muted-foreground font-normal">vs</span> {p.awayTeamName}
            </span>
            <Badge
              variant={p.pointsAwarded > 0 ? "default" : "secondary"}
              className="text-xs shrink-0"
            >
              +{p.pointsAwarded} pts
            </Badge>
          </div>
          <div className="flex items-center gap-3 text-muted-foreground">
            <KickoffTime date={p.kickoffTime} />
            <span className="flex items-center gap-1">
              Pick: <span className="font-mono text-foreground">{p.homeScore}–{p.awayScore}</span>
              {p.scoringBreakdown && p.scoringBreakdown.length > 0 && (
                <ScoringBreakdown rules={p.scoringBreakdown} />
              )}
            </span>
            <span>
              Result: <span className="font-mono text-foreground">{p.result.homeScore}–{p.result.awayScore}</span>
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Cache helpers ─────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 60_000;
type LbCacheEntry = { data: LeaderboardEntry[]; ts: number };
type UpCacheEntry = { data: UserPrediction[]; ts: number };

// ── Main page ─────────────────────────────────────────────────────────────────

export default function LeaderboardPage() {
  const { data: session } = useSession();

  const [period, setPeriod]           = useState("all");
  const [weekOffset, setWeekOffset]   = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);

  const [groups, setGroups]           = useState<Group[]>([]);
  const [groupId, setGroupId]         = useState<string | null>(null);
  const [groupsReady, setGroupsReady] = useState(false);

  const [leagues, setLeagues]           = useState<League[]>([]);
  const [selectedLeagues, setSelectedLeagues] = useState<string[]>([]);
  const [leagueDropdownOpen, setLeagueDropdownOpen] = useState(false);
  const leagueDropdownRef = useRef<HTMLDivElement>(null);

  const [leaderboard, setLeaderboard]     = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading]         = useState(true);
  const [isRefreshing, setIsRefreshing]   = useState(false);

  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [loadingUserId, setLoadingUserId]   = useState<string | null>(null);

  const lbCache  = useRef<Record<string, LbCacheEntry>>({});
  const upCache  = useRef<Record<string, UpCacheEntry>>({});
  const upData   = useRef<Record<string, UserPrediction[]>>({});

  // ── Date range ──────────────────────────────────────────────────────────────

  const getDateRange = useCallback((): { from: Date; to: Date } | null => {
    if (period === "week")  return getWeekBounds(weekOffset);
    if (period === "month") return getMonthBounds(monthOffset);
    return null;
  }, [period, weekOffset, monthOffset]);

  // ── Load groups ─────────────────────────────────────────────────────────────

  useEffect(() => {
    fetch("/api/groups")
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then((data: Group[]) => {
        const sorted = [...data.filter(g => !g.isDefault), ...data.filter(g => g.isDefault)];
        setGroups(sorted);
        const def = data.find(g => g.isDefault);
        if (def) setGroupId(def.id);
        setGroupsReady(true);
      })
      .catch(() => setGroupsReady(true));
  }, []);

  // ── Load leagues ─────────────────────────────────────────────────────────────

  useEffect(() => {
    fetch("/api/leagues")
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then((data: League[]) => setLeagues(data))
      .catch(() => {});
  }, []);

  // ── Close league dropdown on outside click ───────────────────────────────────

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (leagueDropdownRef.current && !leagueDropdownRef.current.contains(e.target as Node)) {
        setLeagueDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ── Collapse expanded row when time frame changes ───────────────────────────

  useEffect(() => {
    setExpandedUserId(null);
  }, [period, weekOffset, monthOffset, groupId, selectedLeagues]);

  // ── Fetch leaderboard ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!groupsReady) return;

    const range = getDateRange();
    const fromStr = range ? range.from.toISOString() : "";
    const toStr   = range ? range.to.toISOString()   : "";
    const leagueKey = selectedLeagues.slice().sort().join(",");
    const cacheKey = `${fromStr}:${toStr}:${groupId ?? "all"}:${leagueKey}`;

    const cached = lbCache.current[cacheKey];
    const now    = Date.now();

    if (cached && now - cached.ts < CACHE_TTL_MS) {
      setLeaderboard(cached.data);
      setIsLoading(false);
      setIsRefreshing(true);
    } else {
      setLeaderboard([]);
      setIsLoading(true);
    }

    let url = `/api/leaderboard?period=${period}`;
    if (range) url += `&from=${encodeURIComponent(range.from.toISOString())}&to=${encodeURIComponent(range.to.toISOString())}`;
    if (groupId) url += `&groupId=${groupId}`;
    for (const lid of selectedLeagues) url += `&leagueId=${lid}`;

    fetch(url)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then((data: LeaderboardEntry[]) => {
        lbCache.current[cacheKey] = { data, ts: Date.now() };
        setLeaderboard(data);
        setIsLoading(false);
        setIsRefreshing(false);
      })
      .catch(() => { setIsLoading(false); setIsRefreshing(false); });
  }, [period, weekOffset, monthOffset, groupId, selectedLeagues, groupsReady, getDateRange]);

  // ── Toggle per-user prediction panel ────────────────────────────────────────

  async function toggleUser(userId: string) {
    if (expandedUserId === userId) {
      setExpandedUserId(null);
      return;
    }

    const range = getDateRange();
    const fromStr = range ? range.from.toISOString() : "";
    const toStr   = range ? range.to.toISOString()   : "";
    const leagueKey = selectedLeagues.slice().sort().join(",");
    const cacheKey = `${userId}:${fromStr}:${toStr}:${leagueKey}`;

    if (upCache.current[cacheKey] && Date.now() - upCache.current[cacheKey].ts < CACHE_TTL_MS) {
      upData.current[userId] = upCache.current[cacheKey].data;
      setExpandedUserId(userId);
      return;
    }

    setLoadingUserId(userId);
    setExpandedUserId(userId);

    let url = `/api/leaderboard/user-predictions?userId=${userId}`;
    if (range) url += `&from=${encodeURIComponent(range.from.toISOString())}&to=${encodeURIComponent(range.to.toISOString())}`;
    for (const lid of selectedLeagues) url += `&leagueId=${lid}`;

    try {
      const res  = await fetch(url);
      const data: UserPrediction[] = await res.json();
      upCache.current[cacheKey] = { data, ts: Date.now() };
      upData.current[userId] = data;
    } catch {
      upData.current[userId] = [];
    } finally {
      setLoadingUserId(null);
    }
  }

  // ── Navigation labels ────────────────────────────────────────────────────────

  function weekLabel() {
    const { from, to } = getWeekBounds(weekOffset);
    const thursdayEnd  = new Date(to);
    thursdayEnd.setDate(to.getDate() - 1);
    return `${fmtDate(from)} – ${fmtDate(thursdayEnd)}`;
  }

  function monthLabel() {
    return fmtMonthYear(getMonthBounds(monthOffset).from);
  }

  const myId = (session?.user as { id?: string } | undefined)?.id;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      {/* Header */}
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

      {/* Tournament multi-select */}
      {leagues.length > 0 && (
        <div className="relative" ref={leagueDropdownRef}>
          <button
            onClick={() => setLeagueDropdownOpen(o => !o)}
            className={cn(
              "w-full flex items-center justify-between gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors",
              leagueDropdownOpen
                ? "border-ring ring-2 ring-ring bg-background"
                : "border-border bg-background hover:border-foreground"
            )}
          >
            <span className="truncate text-left">
              {selectedLeagues.length === 0
                ? "All Tournaments"
                : selectedLeagues.length === 1
                ? leagues.find(l => l.externalId.toString() === selectedLeagues[0])?.name ?? "1 selected"
                : `${selectedLeagues.length} tournaments`}
            </span>
            <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", leagueDropdownOpen && "rotate-180")} />
          </button>

          {leagueDropdownOpen && (
            <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-background shadow-md">
              {/* All option */}
              <button
                onClick={() => setSelectedLeagues([])}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors",
                  selectedLeagues.length === 0 && "font-medium"
                )}
              >
                <span className={cn("flex h-4 w-4 items-center justify-center rounded border shrink-0",
                  selectedLeagues.length === 0 ? "bg-primary border-primary" : "border-border"
                )}>
                  {selectedLeagues.length === 0 && <Check className="h-3 w-3 text-primary-foreground" />}
                </span>
                All Tournaments
              </button>

              <div className="border-t border-border" />

              {leagues.map(l => {
                const val = l.externalId.toString();
                const checked = selectedLeagues.includes(val);
                return (
                  <button
                    key={l.id}
                    onClick={() => {
                      setSelectedLeagues(prev =>
                        checked ? prev.filter(x => x !== val) : [...prev, val]
                      );
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors"
                  >
                    <span className={cn("flex h-4 w-4 items-center justify-center rounded border shrink-0",
                      checked ? "bg-primary border-primary" : "border-border"
                    )}>
                      {checked && <Check className="h-3 w-3 text-primary-foreground" />}
                    </span>
                    {l.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Period tabs */}
      <Tabs value={period} onValueChange={(v) => { setPeriod(v); }}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all">All Time</TabsTrigger>
          <TabsTrigger value="month">Month</TabsTrigger>
          <TabsTrigger value="week">Week</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Week navigation */}
      {period === "week" && (
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => setWeekOffset(o => o - 1)}
            className="p-1.5 rounded-md hover:bg-accent transition-colors"
            aria-label="Previous week"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium tabular-nums">{weekLabel()}</span>
          <button
            onClick={() => setWeekOffset(o => o + 1)}
            className="p-1.5 rounded-md hover:bg-accent transition-colors"
            aria-label="Next week"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Month navigation */}
      {period === "month" && (
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => setMonthOffset(o => o - 1)}
            className="p-1.5 rounded-md hover:bg-accent transition-colors"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium">{monthLabel()}</span>
          <button
            onClick={() => setMonthOffset(o => o + 1)}
            className="p-1.5 rounded-md hover:bg-accent transition-colors"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Leaderboard list */}
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
            <div className="space-y-1">
              {leaderboard.map((entry, idx) => {
                const isMe       = entry.userId === myId;
                const isExpanded = expandedUserId === entry.userId;
                const isLoading_ = loadingUserId  === entry.userId;
                const preds      = upData.current[entry.userId] ?? [];

                return (
                  <div key={entry.userId}>
                    {/* Row */}
                    <div
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg transition-colors",
                        isMe ? "bg-primary/10 border border-primary/30" : "hover:bg-accent"
                      )}
                    >
                      <span
                        className={cn(
                          "text-sm font-bold w-6 text-center shrink-0",
                          idx < 3 ? "text-yellow-500" : "text-muted-foreground"
                        )}
                      >
                        {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : idx + 1}
                      </span>
                      <Avatar className="h-8 w-8 shrink-0">
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
                          {entry.predictionsCount} picks
                        </p>
                      </div>
                      <Badge variant={isMe ? "default" : "outline"} className="font-bold shrink-0">
                        {entry.totalPoints} pts
                      </Badge>
                      {/* Expand toggle */}
                      <button
                        onClick={() => toggleUser(entry.userId)}
                        className="ml-1 p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground shrink-0"
                        aria-label={isExpanded ? "Collapse predictions" : "Show predictions"}
                      >
                        {isExpanded
                          ? <ChevronUp className="h-4 w-4" />
                          : <ChevronDown className="h-4 w-4" />}
                      </button>
                    </div>

                    {/* Predictions panel */}
                    {isExpanded && (
                      <div className="px-3 pb-2">
                        {isLoading_ ? (
                          <div className="space-y-1 pt-2">
                            {[1, 2].map(i => (
                              <Skeleton key={i} className="h-12 w-full rounded-md" />
                            ))}
                          </div>
                        ) : (
                          <UserPredictionList predictions={preds} />
                        )}
                      </div>
                    )}
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
