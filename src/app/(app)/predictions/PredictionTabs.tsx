"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { KickoffTime } from "@/components/KickoffTime";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ScoringBreakdown, type RuleBreakdown } from "@/components/ScoringBreakdown";
import { computeWeekLabel, getWeekBounds } from "@/lib/period-filter";
import { cn } from "@/lib/utils";

export type SerializedPrediction = {
  _id: string;
  homeScore: number;
  awayScore: number;
  pointsAwarded: number;
  baseScore: number;
  outcomeOdds: number;
  scoringBreakdown: RuleBreakdown[] | null;
  matchId: {
    _id: string;
    kickoffTime: string;
    status: string;
    homeTeam: { name: string };
    awayTeam: { name: string };
    result?: { homeScore: number; awayScore: number; penaltyHomeScore?: number | null; penaltyAwayScore?: number | null };
    odds?: { homeWin: number; draw: number; awayWin: number; locked: boolean } | null;
  };
};

type OtherPrediction = {
  userId: number;
  userName: string;
  homeScore: number;
  awayScore: number;
  pointsAwarded: number | null;
  scoringBreakdown: RuleBreakdown[] | null;
};

function ScoreTile({ pred }: { pred: SerializedPrediction }) {
  const match = pred.matchId;
  const isFinished = !!match.result;

  const [open, setOpen] = useState(false);
  const [others, setOthers] = useState<OtherPrediction[] | null>(null);
  const [loading, setLoading] = useState(false);

  const isExact =
    isFinished &&
    match.result!.homeScore === pred.homeScore &&
    match.result!.awayScore === pred.awayScore;

  const pts = pred.pointsAwarded || 0;

  const chipClass = isExact
    ? "bg-primary-soft border-primary-soft-border text-primary"
    : pts > 0
    ? "bg-card-elevated border-border text-warning"
    : "bg-card-elevated border-border text-muted-foreground";

  const chipCaption = isExact ? "EXACT" : pts > 0 ? "WIN" : "—";

  async function toggle() {
    if (!open && others === null) {
      setLoading(true);
      try {
        const res = await fetch(`/api/matches/${match._id}`);
        const data = await res.json();
        setOthers(data.allPredictions ?? []);
        if (data.odds?.locked && !match.odds) {
          pred.matchId.odds = data.odds;
        }
      } finally {
        setLoading(false);
      }
    }
    setOpen((v) => !v);
  }

  const predictedOutcome = pred.homeScore > pred.awayScore ? 'homeWin'
    : pred.awayScore > pred.homeScore ? 'awayWin' : 'draw';
  const matchOdds = match.odds;

  return (
    <div className="rounded-[14px] border border-border bg-card overflow-hidden">
      <div className="flex items-stretch">
        {/* Left col */}
        <div className="flex-1 min-w-0 p-3 space-y-1">
          <p className="text-[10.5px] text-muted-foreground">
            <KickoffTime date={match.kickoffTime} />
          </p>
          <p className="text-sm font-semibold truncate">
            {match.homeTeam?.name} vs {match.awayTeam?.name}
          </p>
          {isFinished && (
            <div className="flex items-center gap-3 flex-wrap">
              <span className="inline-flex items-center gap-1">
                <span className="text-[10.5px] font-bold uppercase text-muted-foreground">PICK</span>
                <span className="font-mono-nums text-[12.5px]">
                  {pred.homeScore}–{pred.awayScore}
                </span>
                {pred.scoringBreakdown && pred.scoringBreakdown.length > 0 && (
                  <ScoringBreakdown rules={pred.scoringBreakdown} />
                )}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="text-[10.5px] font-bold uppercase text-muted-foreground">FINAL</span>
                <span className="font-mono-nums text-[12.5px]">
                  {match.result!.homeScore}–{match.result!.awayScore}
                </span>
              </span>
            </div>
          )}
          {isFinished && matchOdds?.locked && (
            <div className="flex items-center gap-2 text-[10.5px] text-muted-foreground mt-0.5">
              <span className={cn("font-mono-nums", predictedOutcome === 'homeWin' && "text-foreground font-bold")}>
                H {matchOdds.homeWin.toFixed(2)}
              </span>
              <span className={cn("font-mono-nums", predictedOutcome === 'draw' && "text-foreground font-bold")}>
                D {matchOdds.draw.toFixed(2)}
              </span>
              <span className={cn("font-mono-nums", predictedOutcome === 'awayWin' && "text-foreground font-bold")}>
                A {matchOdds.awayWin.toFixed(2)}
              </span>
            </div>
          )}
        </div>

        {/* Right chip */}
        {isFinished && (
          <div className={cn("w-[72px] shrink-0 border-l rounded-r-[14px] p-2 flex flex-col items-center justify-center gap-0.5", chipClass)}>
            <span className="text-[22px] font-bold font-mono-nums leading-none">
              {pts > 0 ? `+${pts}` : "0"}
            </span>
            <span className="text-[9.5px] font-bold uppercase">{chipCaption}</span>
            {pred.outcomeOdds !== 1 && pts > 0 && (
              <span className="text-[8px] text-muted-foreground font-mono-nums">×{pred.outcomeOdds.toFixed(2)}</span>
            )}
          </div>
        )}
      </div>

      {/* Show other predictions (locked matches) */}
      {match.status !== "scheduled" && (
        <button
          onClick={toggle}
          className="w-full border-t border-border py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {loading ? "Loading…" : open ? "Hide predictions" : "Show all predictions"}
        </button>
      )}

      {open && others && others.length > 0 && (
        <div className="border-t border-border divide-y divide-border">
          {others.map((o) => (
            <div key={o.userId} className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
              <span className="font-medium truncate max-w-[140px]">{o.userName}</span>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-mono-nums">{o.homeScore}–{o.awayScore}</span>
                {isFinished && o.scoringBreakdown && o.scoringBreakdown.length > 0 && (
                  <ScoringBreakdown rules={o.scoringBreakdown} />
                )}
                {isFinished && (
                  <span className={cn("font-medium font-mono-nums", (o.pointsAwarded ?? 0) > 0 ? "text-warning" : "text-muted-foreground")}>
                    +{o.pointsAwarded ?? 0}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {open && others && others.length === 0 && (
        <p className="py-2 text-xs text-muted-foreground text-center border-t border-border">No other predictions.</p>
      )}
    </div>
  );
}

const PAGE_SIZE = 20;

export function PredictionTabs({ allPreds }: { allPreds: SerializedPrediction[] }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const weekLabel = useMemo(() => computeWeekLabel(weekOffset), [weekOffset]);

  const [visible, setVisible] = useState(PAGE_SIZE);
  const showMore = useCallback(() => setVisible(n => n + PAGE_SIZE), []);

  useEffect(() => { setVisible(PAGE_SIZE); }, [weekOffset]);

  const filtered = useMemo(() => {
    const { from, to } = getWeekBounds(weekOffset);
    return allPreds.filter(p => {
      if (!p.matchId.result) return false;
      const t = new Date(p.matchId.kickoffTime).getTime();
      return t >= from.getTime() && t < to.getTime();
    });
  }, [allPreds, weekOffset]);

  const weekPoints = useMemo(
    () => filtered.reduce((sum, p) => sum + (p.pointsAwarded || 0), 0),
    [filtered],
  );

  const page = filtered.slice(0, visible);
  const hasMore = visible < filtered.length;

  return (
    <div className="space-y-4">
      {/* Week nav */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setWeekOffset(o => o - 1)}
          className="h-8 w-8 flex items-center justify-center rounded-full bg-card-elevated border border-border hover:border-border/80 transition-colors"
          aria-label="Previous week"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold font-mono-nums">{weekLabel}</span>
        <button
          onClick={() => setWeekOffset(o => o + 1)}
          className="h-8 w-8 flex items-center justify-center rounded-full bg-card-elevated border border-border hover:border-border/80 transition-colors"
          aria-label="Next week"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        Week score:{" "}
        <span className="font-semibold font-mono-nums text-foreground">{weekPoints} pts</span>
      </p>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <p className="text-muted-foreground text-sm">No scored predictions for this week.</p>
        ) : (
          <>
            {page.map((pred) => <ScoreTile key={pred._id} pred={pred} />)}
            {hasMore && (
              <button
                onClick={showMore}
                className="w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Show more ({filtered.length - visible} remaining)
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
