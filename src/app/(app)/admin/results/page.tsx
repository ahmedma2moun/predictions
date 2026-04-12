"use client";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KickoffTime } from "@/components/KickoffTime";

type RuleBreakdown = { ruleName: string; pointsAwarded: number; matched: boolean };

type PredictionRow = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  homeScore: number;
  awayScore: number;
  pointsAwarded: number;
  scoringBreakdown: RuleBreakdown[] | null;
};

type MatchRow = {
  id: string;
  homeTeamName: string;
  awayTeamName: string;
  kickoffTime: string;
  resultHomeScore: number;
  resultAwayScore: number;
  resultPenaltyHomeScore: number | null;
  resultPenaltyAwayScore: number | null;
  predictions: PredictionRow[];
};

export default function AdminResultsPage() {
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/admin/results")
      .then((r) => r.json())
      .then((data) => {
        setMatches(data.matches || []);
        setLoading(false);
      });
  }, []);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Past Match Results & Predictions</h2>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : matches.length === 0 ? (
        <p className="text-muted-foreground">No finished matches yet.</p>
      ) : (
        <div className="space-y-3">
          {matches.map((match) => {
            const isOpen = expanded.has(match.id);
            const totalPredictions = match.predictions.length;
            return (
              <Card key={match.id}>
                <CardContent className="pt-4 space-y-3">
                  {/* Match header */}
                  <button
                    className="w-full text-left"
                    onClick={() => toggleExpand(match.id)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">
                          {match.homeTeamName} vs {match.awayTeamName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          <KickoffTime date={match.kickoffTime} />
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right">
                          <Badge variant="secondary" className="text-sm font-bold tabular-nums">
                            {match.resultHomeScore} – {match.resultAwayScore}
                          </Badge>
                          {match.resultPenaltyHomeScore != null && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Pen: {match.resultPenaltyHomeScore} – {match.resultPenaltyAwayScore}
                            </p>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {totalPredictions} prediction{totalPredictions !== 1 ? "s" : ""}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {isOpen ? "▲" : "▼"}
                        </span>
                      </div>
                    </div>
                  </button>

                  {/* Predictions table */}
                  {isOpen && (
                    <div className="border-t pt-3">
                      {totalPredictions === 0 ? (
                        <p className="text-xs text-muted-foreground">No predictions for this match.</p>
                      ) : (
                        <div className="space-y-1">
                          {/* Header row */}
                          <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-2 pb-1">
                            <span className="text-xs font-medium text-muted-foreground">User</span>
                            <span className="text-xs font-medium text-muted-foreground text-center">Prediction</span>
                            <span className="text-xs font-medium text-muted-foreground text-right">Points</span>
                          </div>
                          {match.predictions.map((pred) => (
                            <div
                              key={pred.id}
                              className="px-2 py-1.5 rounded-md bg-accent space-y-1"
                            >
                              <div className="grid grid-cols-[1fr_auto_auto] gap-2 items-center">
                                <div className="min-w-0">
                                  <p className="text-sm font-medium truncate">{pred.userName}</p>
                                  <p className="text-xs text-muted-foreground truncate">{pred.userEmail}</p>
                                </div>
                                <span className="text-sm tabular-nums font-semibold">
                                  {pred.homeScore} – {pred.awayScore}
                                </span>
                                <Badge
                                  variant={pred.pointsAwarded > 0 ? "default" : "secondary"}
                                  className="text-xs justify-self-end"
                                >
                                  +{pred.pointsAwarded} pts
                                </Badge>
                              </div>
                              {pred.scoringBreakdown && (
                                <div className="flex flex-wrap gap-x-3 gap-y-0.5 pl-0.5">
                                  {pred.scoringBreakdown.map((rule) => (
                                    <span
                                      key={rule.ruleName}
                                      className={`text-xs ${rule.matched ? "text-green-500 font-medium" : "text-muted-foreground line-through"}`}
                                    >
                                      {rule.ruleName} +{rule.pointsAwarded}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
