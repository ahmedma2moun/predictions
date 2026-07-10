"use client";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useLiveStanding } from "./useLiveStanding";
import type { LiveMovement, LiveStandingMatch } from "./useLiveStanding";

function MovementArrow({ movement, previousRank, rank }: { movement: LiveMovement; previousRank: number; rank: number }) {
  if (movement === "up") {
    return (
      <span className="flex items-center gap-0.5 text-green-600 dark:text-green-500" title={`Up from #${previousRank}`}>
        <ArrowUp className="h-4 w-4" />
        <span className="text-[11px] font-bold font-mono-nums">{previousRank - rank}</span>
      </span>
    );
  }
  if (movement === "down") {
    return (
      <span className="flex items-center gap-0.5 text-red-600 dark:text-red-500" title={`Down from #${previousRank}`}>
        <ArrowDown className="h-4 w-4" />
        <span className="text-[11px] font-bold font-mono-nums">{rank - previousRank}</span>
      </span>
    );
  }
  return <Minus className="h-4 w-4 text-muted-foreground" aria-label="No change" />;
}

function LiveMatchCard({ match }: { match: LiveStandingMatch }) {
  return (
    <div className="rounded-[14px] border border-border bg-card px-4 py-3 flex items-center gap-3">
      <div className="flex-1 min-w-0 flex items-center justify-end gap-2">
        <span className="text-[13px] font-semibold truncate">{match.homeTeamName}</span>
        {match.homeTeamLogo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={match.homeTeamLogo} alt="" className="h-5 w-5 object-contain shrink-0" />
        )}
      </div>
      <span className="text-[15px] font-bold font-mono-nums shrink-0">
        {match.homeScore}–{match.awayScore}
      </span>
      <div className="flex-1 min-w-0 flex items-center gap-2">
        {match.awayTeamLogo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={match.awayTeamLogo} alt="" className="h-5 w-5 object-contain shrink-0" />
        )}
        <span className="text-[13px] font-semibold truncate">{match.awayTeamName}</span>
      </div>
      <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[rgba(255,77,109,0.12)] border border-[rgba(255,77,109,0.30)] text-live text-[10px] font-bold uppercase shrink-0">
        <span className="animate-live inline-block h-1.5 w-1.5 rounded-full bg-live" />
        {match.status === "finished" ? "FT" : "LIVE"}
      </span>
    </div>
  );
}

export default function LiveStandingPage() {
  const {
    groups, groupId, setGroupId,
    data, isLoading, isRefreshing,
    offSeason, lastUpdated,
    myId,
  } = useLiveStanding();

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          Live Standing
          {data?.hasLiveMatches && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[rgba(255,77,109,0.12)] border border-[rgba(255,77,109,0.30)] text-live text-[10px] font-bold uppercase">
              <span className="animate-live inline-block h-1.5 w-1.5 rounded-full bg-live" />
              LIVE
            </span>
          )}
        </h1>
        {isRefreshing ? (
          <span className="text-xs text-muted-foreground animate-pulse">Updating…</span>
        ) : lastUpdated ? (
          <span className="text-xs text-muted-foreground">
            Updated {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        ) : null}
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

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-[14px] border border-border">
              <Skeleton className="h-4 w-6 rounded" />
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-32 rounded" />
              </div>
              <Skeleton className="h-6 w-12 rounded" />
            </div>
          ))}
        </div>
      ) : offSeason ? (
        <div className="rounded-[14px] border border-border bg-card px-6 py-10 text-center space-y-3">
          <p className="text-3xl">🏆</p>
          <p className="font-semibold text-base">Season has ended</p>
          <p className="text-sm text-muted-foreground">Live standings will return when a new season starts.</p>
        </div>
      ) : !data || data.standings.length === 0 ? (
        <p className="text-muted-foreground text-center py-4">No standings yet</p>
      ) : (
        <div className="space-y-4">
          {/* In-play matches */}
          {data.hasLiveMatches ? (
            <div className="space-y-2">
              {data.matches.map(m => <LiveMatchCard key={m.matchId} match={m} />)}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center rounded-[14px] border border-dashed border-border px-4 py-3">
              No matches in play right now — the standing shows confirmed points and updates automatically once a match kicks off.
            </p>
          )}

          {/* Standing rows */}
          <div className="space-y-2">
            {data.standings.map(entry => {
              const isMe = entry.userId === myId;
              const name = entry.name ?? "Unknown";
              return (
                <div
                  key={entry.userId}
                  className={cn(
                    "rounded-[14px] border px-[14px] py-[11px] flex items-center gap-[10px] transition-colors",
                    isMe ? "bg-primary-soft border-primary-soft-border" : "bg-card border-border"
                  )}
                >
                  <span className="w-[26px] text-[13px] font-bold font-mono-nums text-muted-foreground shrink-0 text-center">
                    {entry.rank}
                  </span>
                  <span className="w-8 shrink-0 flex justify-center">
                    <MovementArrow movement={entry.movement} previousRank={entry.previousRank} rank={entry.rank} />
                  </span>
                  <div className="h-7 w-7 rounded-full bg-card-elevated border border-border flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold">{name.slice(0, 2).toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0 flex items-center gap-1.5 truncate">
                    <p className="text-[13px] font-semibold truncate">{name}</p>
                    {isMe && <span className="text-[10px] font-bold uppercase text-primary shrink-0">YOU</span>}
                  </div>
                  <span className="flex items-center gap-1.5 shrink-0">
                    {entry.livePoints > 0 && (
                      <span className="text-[10px] font-bold font-mono-nums text-green-600 dark:text-green-500 bg-green-500/10 rounded-full px-1.5 py-0.5">
                        +{entry.livePoints}
                      </span>
                    )}
                    <span className="text-[14px] font-bold font-mono-nums">{entry.liveTotalPoints}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
