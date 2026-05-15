"use client";
import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { Award } from "lucide-react";
import { cn } from "@/lib/utils";

type AnchorPos = { x: number; top?: number; bottom?: number };

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
  const [anchor, setAnchor] = useState<AnchorPos | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const hasExact = badges.includes('first_exact_score');
  const hasRoll  = badges.includes('on_a_roll');

  if (!hasExact && !hasRoll) return null;

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      const x = Math.max(108, Math.min(r.left + r.width / 2, window.innerWidth - 108));
      setAnchor(r.top > 160
        ? { x, bottom: window.innerHeight - r.top + 8 }
        : { x, top: r.bottom + 8 },
      );
    }
    setOpen(v => !v);
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleClick}
        className="text-muted-foreground hover:text-foreground transition-colors"
        aria-label="View badges"
      >
        <Award className="h-3.5 w-3.5" />
      </button>
      {open && anchor && createPortal(
        <>
          <div className="fixed inset-0 z-40" onMouseDown={() => setOpen(false)} />
          <div
            className="fixed z-50 bg-popover border border-border rounded-lg shadow-lg p-3 min-w-[200px]"
            style={{ left: anchor.x, transform: 'translateX(-50%)', top: anchor.top, bottom: anchor.bottom }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <p className="text-xs font-semibold mb-1.5 text-foreground">Badges</p>
            <div className="space-y-1.5">
              {hasExact && (
                <div className="flex items-center justify-between gap-4 text-xs">
                  <span>🎯 Exact Score</span>
                  <span className="text-muted-foreground font-mono-nums">×{exactScoreCount}</span>
                </div>
              )}
              {hasRoll && (
                <div className="flex items-center justify-between gap-4 text-xs">
                  <span>🔥 On a Roll</span>
                  <span className="text-muted-foreground font-mono-nums">longest: {longestStreak}</span>
                </div>
              )}
            </div>
          </div>
        </>,
        document.body,
      )}
    </>
  );
}

import { Skeleton } from "@/components/ui/skeleton";
import { KickoffTime } from "@/components/KickoffTime";
import { ChevronDown, ChevronUp } from "lucide-react";
import { ScoringBreakdown } from "@/components/ScoringBreakdown";
import { useLeaderboard } from "./useLeaderboard";
import type { UserPrediction } from "./useLeaderboard";
import { LeaderboardFilters } from "./LeaderboardFilters";
import { PeriodNav } from "./PeriodNav";
import { Badge } from "@/components/ui/badge";

const MEDAL_COLORS = ["#F2C744", "#C5CDD9", "#CB8C5C"] as const;
const TOWER_HEIGHTS = ["h-[86px]", "h-12", "h-[62px]"] as const;
// podium order: 2nd (idx=1), 1st (idx=0), 3rd (idx=2)
const PODIUM_ORDER = [1, 0, 2] as const;

function PodiumTower({
  entry,
  rank,
  medalColor,
  towerHeight,
  isMe,
}: {
  entry: { name: string; totalPoints: number; avatarUrl?: string };
  rank: number;
  medalColor: string;
  towerHeight: string;
  isMe: boolean;
}) {
  const initials = entry.name.slice(0, 2).toUpperCase();
  return (
    <div className="flex flex-col items-center gap-1">
      {/* Avatar */}
      <div className={cn(
        "h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold border-2",
        isMe ? "border-primary text-primary" : "border-border text-foreground"
      )}
        style={{ background: `${medalColor}22` }}
      >
        {initials}
      </div>
      <p className="text-[11px] font-semibold text-center leading-tight max-w-[60px] truncate">{entry.name}</p>
      <p className="text-[11px] font-mono-nums text-muted-foreground">{entry.totalPoints}</p>
      {/* Tower */}
      <div
        className={cn("w-full rounded-t-[14px] border-t border-x flex items-center justify-center", towerHeight)}
        style={{
          background: `${medalColor}33`,
          borderColor: `${medalColor}55`,
        }}
      >
        <span className="text-xl font-[800]" style={{ color: medalColor }}>{rank}</span>
      </div>
    </div>
  );
}

function UserPredictionList({ predictions }: { predictions: UserPrediction[] }) {
  if (predictions.length === 0) {
    return <p className="text-xs text-muted-foreground text-center py-2">No scored predictions in this period.</p>;
  }
  return (
    <div className="mt-2 space-y-2 border-t border-border pt-2">
      {predictions.map((p) => (
        <div key={p.matchId} className="rounded-md bg-card-elevated px-3 py-2 text-xs space-y-1">
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
              Pick: <span className="font-mono-nums text-foreground">{p.homeScore}–{p.awayScore}</span>
              {p.scoringBreakdown && p.scoringBreakdown.length > 0 && (
                <ScoringBreakdown rules={p.scoringBreakdown} />
              )}
            </span>
            <span>
              Result: <span className="font-mono-nums text-foreground">{p.result.homeScore}–{p.result.awayScore}</span>
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

  const showPodium = isCurrentPeriod && !isLoading && leaderboard.length >= 3;
  const compactEntries = showPodium ? leaderboard.slice(3) : leaderboard;

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

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-[14px] border border-border">
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
          {/* Podium — top 3, current period only */}
          {showPodium && (
            <div className="grid grid-cols-[1fr_1.2fr_1fr] items-end gap-2 px-2 pb-4">
              {PODIUM_ORDER.map((entryIdx, colIdx) => {
                const entry = leaderboard[entryIdx];
                const rank = entryIdx + 1;
                const medalColor = MEDAL_COLORS[entryIdx];
                const towerHeight = colIdx === 1 ? TOWER_HEIGHTS[0] : colIdx === 0 ? TOWER_HEIGHTS[2] : TOWER_HEIGHTS[1];
                return (
                  <PodiumTower
                    key={entry.userId}
                    entry={entry}
                    rank={rank}
                    medalColor={medalColor}
                    towerHeight={towerHeight}
                    isMe={entry.userId === myId}
                  />
                );
              })}
            </div>
          )}

          {/* Compact rows — rank 4+ (or all when no podium) */}
          {compactEntries.map((entry, idx) => {
            const rank = showPodium ? idx + 4 : idx + 1;
            const isMe = entry.userId === myId;
            const isExpanded = expandedUserId === entry.userId;
            const isLoadingUser = loadingUserId === entry.userId;
            const preds = upData.current[entry.userId] ?? [];

            return (
              <div key={entry.userId}>
                <div
                  className={cn(
                    "rounded-[14px] border px-[14px] py-[11px] flex items-center gap-[10px] transition-colors",
                    isMe
                      ? "bg-primary-soft border-primary-soft-border"
                      : "bg-card border-border"
                  )}
                >
                  <span className="w-[26px] text-[13px] font-bold font-mono-nums text-muted-foreground shrink-0 text-center">
                    {rank}
                  </span>
                  <div className="h-7 w-7 rounded-full bg-card-elevated border border-border flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold">{entry.name.slice(0, 2).toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0 flex items-center gap-1.5 truncate">
                    <p className="text-[13px] font-semibold truncate">{entry.name}</p>
                    {isMe && <span className="text-[10px] font-bold uppercase text-primary shrink-0">YOU</span>}
                    {entry.isGroupChampion && <span title="Group Champion" className="text-sm leading-none shrink-0">🏆</span>}
                    {isCurrentPeriod && (
                      <BadgesPopover
                        badges={entry.badges ?? []}
                        exactScoreCount={entry.exactScoreCount ?? 0}
                        longestStreak={entry.longestStreak ?? 0}
                      />
                    )}
                  </div>
                  <span className="text-[14px] font-bold font-mono-nums shrink-0">{entry.totalPoints}</span>
                  <button
                    onClick={() => toggleUser(entry.userId)}
                    className="ml-1 p-1 rounded hover:bg-card-elevated transition-colors text-muted-foreground hover:text-foreground shrink-0"
                    aria-label={isExpanded ? "Collapse" : "Expand"}
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
    </div>
  );
}
