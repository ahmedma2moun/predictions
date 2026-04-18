"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KickoffTime } from "@/components/KickoffTime";
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from "lucide-react";
import { ScoringBreakdown, type RuleBreakdown } from "@/components/ScoringBreakdown";
import { computeWeekLabel, getWeekBounds } from "@/lib/period-filter";

export type SerializedPrediction = {
  _id: string;
  homeScore: number;
  awayScore: number;
  pointsAwarded: number;
  scoringBreakdown: RuleBreakdown[] | null;
  matchId: {
    _id: string;
    kickoffTime: string;
    status: string;
    homeTeam: { name: string };
    awayTeam: { name: string };
    result?: { homeScore: number; awayScore: number; penaltyHomeScore?: number | null; penaltyAwayScore?: number | null };
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

function PredictionCard({ pred }: { pred: SerializedPrediction }) {
  const match = pred.matchId;
  const isFinished = match.status === "finished";
  const isLocked = match.status !== "upcoming" && match.status !== "scheduled";

  const [open, setOpen] = useState(false);
  const [others, setOthers] = useState<OtherPrediction[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    if (!open && others === null) {
      setLoading(true);
      try {
        const res = await fetch(`/api/matches/${match._id}`);
        const data = await res.json();
        setOthers(data.allPredictions ?? []);
      } finally {
        setLoading(false);
      }
    }
    setOpen((v) => !v);
  }

  return (
    <Card className={isFinished && pred.pointsAwarded > 0 ? "border-green-500/30" : ""}>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground"><KickoffTime date={match.kickoffTime} /></span>
          <div className="flex items-center gap-2">
            <Badge variant={isFinished ? "secondary" : "outline"} className="text-xs">
              {match.status.toUpperCase()}
            </Badge>
            {isFinished && (
              <Badge
                variant={pred.pointsAwarded > 0 ? "default" : "secondary"}
                className="text-xs"
              >
                +{pred.pointsAwarded} pts
              </Badge>
            )}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-xs text-muted-foreground">Home</p>
            <p className="font-medium text-sm">{match.homeTeam?.name}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Your pick</p>
            <div className="flex items-center justify-center gap-1">
              <span className="font-bold text-lg">{pred.homeScore} – {pred.awayScore}</span>
              {isFinished && pred.scoringBreakdown && pred.scoringBreakdown.length > 0 && (
                <ScoringBreakdown rules={pred.scoringBreakdown} />
              )}
            </div>
            {isFinished && match.result && (
              <p className="text-xs text-muted-foreground">
                Result: {match.result.homeScore} – {match.result.awayScore}
                {match.result.penaltyHomeScore != null && (
                  <> ({match.result.penaltyHomeScore} – {match.result.penaltyAwayScore} pen)</>
                )}
              </p>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Away</p>
            <p className="font-medium text-sm">{match.awayTeam?.name}</p>
          </div>
        </div>
        {isLocked && (
          <button
            onClick={toggle}
            className="mt-3 pt-3 border-t w-full flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {loading ? (
              "Loading..."
            ) : (
              <>
                {open ? "Hide" : "Show"} all predictions
                {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </>
            )}
          </button>
        )}
        {open && others && others.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {others.map((o) => (
              <div
                key={o.userId}
                className="text-xs px-2 py-1.5 rounded-md bg-muted/40 space-y-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium truncate max-w-[140px]">{o.userName}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono tabular-nums">
                      {o.homeScore} – {o.awayScore}
                    </span>
                    {isFinished && o.scoringBreakdown && o.scoringBreakdown.length > 0 && (
                      <ScoringBreakdown rules={o.scoringBreakdown} />
                    )}
                    {isFinished && (
                      <span
                        className={`font-medium ${
                          (o.pointsAwarded ?? 0) > 0 ? "text-green-500" : "text-muted-foreground"
                        }`}
                      >
                        +{o.pointsAwarded ?? 0} pts
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {open && others && others.length === 0 && (
          <p className="mt-2 text-xs text-muted-foreground text-center">No other predictions.</p>
        )}
      </CardContent>
    </Card>
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

  const page    = filtered.slice(0, visible);
  const hasMore = visible < filtered.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => setWeekOffset(o => o - 1)}
          className="p-1.5 rounded-md hover:bg-accent transition-colors"
          aria-label="Previous week"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-medium tabular-nums">{weekLabel}</span>
        <button
          onClick={() => setWeekOffset(o => o + 1)}
          className="p-1.5 rounded-md hover:bg-accent transition-colors"
          aria-label="Next week"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <p className="text-muted-foreground text-sm">No predictions for this period.</p>
        ) : (
          <>
            {page.map((pred) => <PredictionCard key={pred._id} pred={pred} />)}
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
