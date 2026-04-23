"use client";
import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Award } from "lucide-react";

function BadgesPopover({
  badges,
  exactScoreCount,
  longestStreak,
}: {
  badges: string[];
  exactScoreCount: number;
  longestStreak: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open]);

  const hasExact = badges.includes('first_exact_score');
  const hasRoll  = badges.includes('on_a_roll');

  if (!hasExact && !hasRoll) return null;

  return (
    <div ref={ref} className="relative inline-flex items-center">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(v => !v); }}
        className="text-muted-foreground hover:text-foreground transition-colors"
        aria-label="View badges"
      >
        <Award className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-30 bg-popover border rounded-lg shadow-lg p-3 min-w-[200px]">
          <p className="text-xs font-semibold mb-1.5 text-foreground">Badges</p>
          <div className="space-y-1.5">
            {hasExact && (
              <div className="flex items-center justify-between gap-4 text-xs">
                <span>🎯 Exact Score</span>
                <span className="text-muted-foreground tabular-nums">×{exactScoreCount}</span>
              </div>
            )}
            {hasRoll && (
              <div className="flex items-center justify-between gap-4 text-xs">
                <span>🔥 On a Roll</span>
                <span className="text-muted-foreground tabular-nums">longest: {longestStreak}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { KickoffTime } from "@/components/KickoffTime";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScoringBreakdown } from "@/components/ScoringBreakdown";
import { useLeaderboard } from "./useLeaderboard";
import type { UserPrediction } from "./useLeaderboard";
import { LeaderboardFilters } from "./LeaderboardFilters";
import { PeriodNav } from "./PeriodNav";

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
            <Badge variant={p.pointsAwarded > 0 ? "default" : "secondary"} className="text-xs shrink-0">
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

export default function LeaderboardPage() {
  const {
    period, setPeriod,
    weekOffset, setWeekOffset,
    monthOffset, setMonthOffset,
    groups, groupId, setGroupId,
    leagues, selectedLeagues, setSelectedLeagues,
    leagueDropdownOpen, setLeagueDropdownOpen, leagueDropdownRef,
    leaderboard, isLoading, isRefreshing,
    expandedUserId, loadingUserId,
    upData, toggleUser,
    weekLabel, monthLabel,
    myId,
    isCurrentPeriod,
  } = useLeaderboard();

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Leaderboard</h1>
        {isRefreshing && (
          <span className="text-xs text-muted-foreground animate-pulse">Updating…</span>
        )}
      </div>

      <LeaderboardFilters
        groups={groups}
        groupId={groupId}
        setGroupId={setGroupId}
        leagues={leagues}
        selectedLeagues={selectedLeagues}
        setSelectedLeagues={setSelectedLeagues}
        leagueDropdownOpen={leagueDropdownOpen}
        setLeagueDropdownOpen={setLeagueDropdownOpen}
        leagueDropdownRef={leagueDropdownRef}
      />

      <PeriodNav
        period={period}
        setPeriod={setPeriod}
        weekOffset={weekOffset}
        setWeekOffset={setWeekOffset}
        monthOffset={monthOffset}
        setMonthOffset={setMonthOffset}
        weekLabel={weekLabel}
        monthLabel={monthLabel}
      />

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
                const isLoadingUser = loadingUserId === entry.userId;
                const preds      = upData.current[entry.userId] ?? [];

                return (
                  <div key={entry.userId}>
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
                        <div className="flex items-center gap-1.5">
                          <p className="font-medium text-sm truncate">
                            {entry.name}{isMe && " (you)"}
                          </p>
                          {entry.isGroupChampion && (
                            <span title="Group Champion" className="text-sm leading-none shrink-0">🏆</span>
                          )}
                          {!isCurrentPeriod && entry.badges.includes('perfect_week') && (
                            <span title="Perfect Week" className="text-sm leading-none shrink-0">⭐</span>
                          )}
                          {isCurrentPeriod && (
                            <BadgesPopover
                              badges={entry.badges ?? []}
                              exactScoreCount={entry.exactScoreCount ?? 0}
                              longestStreak={entry.longestStreak ?? 0}
                            />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{entry.predictionsCount} picks</p>
                      </div>
                      <Badge variant={isMe ? "default" : "outline"} className="font-bold shrink-0">
                        {entry.totalPoints} pts
                      </Badge>
                      <button
                        onClick={() => toggleUser(entry.userId)}
                        className="ml-1 p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground shrink-0"
                        aria-label={isExpanded ? "Collapse predictions" : "Show predictions"}
                      >
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="px-3 pb-2">
                        {isLoadingUser ? (
                          <div className="space-y-1 pt-2">
                            {[1, 2].map(i => <Skeleton key={i} className="h-12 w-full rounded-md" />)}
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
