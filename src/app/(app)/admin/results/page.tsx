"use client";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KickoffTime } from "@/components/KickoffTime";
import { Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import type { RuleBreakdown } from "@/components/ScoringBreakdown";

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

type EditState = {
  matchId: string;
  home: string;
  away: string;
  penHome: string;
  penAway: string;
};

export default function AdminResultsPage() {
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);

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

  function startEdit(match: MatchRow) {
    setEditing({
      matchId: match.id,
      home: String(match.resultHomeScore),
      away: String(match.resultAwayScore),
      penHome: match.resultPenaltyHomeScore != null ? String(match.resultPenaltyHomeScore) : "",
      penAway: match.resultPenaltyAwayScore != null ? String(match.resultPenaltyAwayScore) : "",
    });
  }

  async function handleSave() {
    if (!editing) return;
    const homeScore = parseInt(editing.home, 10);
    const awayScore = parseInt(editing.away, 10);
    if (isNaN(homeScore) || isNaN(awayScore) || homeScore < 0 || awayScore < 0) {
      toast.error("Invalid scores");
      return;
    }
    const penaltyHomeScore = editing.penHome !== "" ? parseInt(editing.penHome, 10) : null;
    const penaltyAwayScore = editing.penAway !== "" ? parseInt(editing.penAway, 10) : null;

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/results/${editing.matchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ homeScore, awayScore, penaltyHomeScore, penaltyAwayScore }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to update");
      }
      const data = await res.json();
      setMatches((prev) =>
        prev.map((m) =>
          m.id === editing.matchId
            ? {
                ...m,
                resultHomeScore: homeScore,
                resultAwayScore: awayScore,
                resultPenaltyHomeScore: penaltyHomeScore,
                resultPenaltyAwayScore: penaltyAwayScore,
                predictions: data.predictions,
              }
            : m
        )
      );
      toast.success(`Result updated — ${data.emailsSent} correction email${data.emailsSent !== 1 ? "s" : ""} sent`);
      setEditing(null);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to update result");
    } finally {
      setSaving(false);
    }
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
            const isEditingThis = editing?.matchId === match.id;
            const totalPredictions = match.predictions.length;
            return (
              <Card key={match.id}>
                <CardContent className="pt-4 space-y-3">
                  {/* Match header */}
                  <div className="flex items-center justify-between gap-3">
                    <button
                      className="flex-1 text-left min-w-0"
                      onClick={() => !isEditingThis && toggleExpand(match.id)}
                    >
                      <p className="font-semibold text-sm">
                        {match.homeTeamName} vs {match.awayTeamName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <KickoffTime date={match.kickoffTime} />
                      </p>
                    </button>

                    <div className="flex items-center gap-2 shrink-0">
                      {isEditingThis ? (
                        /* Inline edit form */
                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <Input
                            type="number"
                            min={0}
                            value={editing.home}
                            onChange={(e) => setEditing({ ...editing, home: e.target.value })}
                            className="w-14 h-8 text-center text-sm font-bold tabular-nums px-1"
                          />
                          <span className="text-muted-foreground font-bold">–</span>
                          <Input
                            type="number"
                            min={0}
                            value={editing.away}
                            onChange={(e) => setEditing({ ...editing, away: e.target.value })}
                            className="w-14 h-8 text-center text-sm font-bold tabular-nums px-1"
                          />
                          {/* Penalty inputs — only shown if the match already had penalties */}
                          {(match.resultPenaltyHomeScore != null || editing.penHome !== "" || editing.penAway !== "") && (
                            <>
                              <span className="text-xs text-muted-foreground">Pen:</span>
                              <Input
                                type="number"
                                min={0}
                                placeholder="–"
                                value={editing.penHome}
                                onChange={(e) => setEditing({ ...editing, penHome: e.target.value })}
                                className="w-12 h-8 text-center text-xs tabular-nums px-1"
                              />
                              <span className="text-muted-foreground">–</span>
                              <Input
                                type="number"
                                min={0}
                                placeholder="–"
                                value={editing.penAway}
                                onChange={(e) => setEditing({ ...editing, penAway: e.target.value })}
                                className="w-12 h-8 text-center text-xs tabular-nums px-1"
                              />
                            </>
                          )}
                          <Button
                            size="icon"
                            variant="default"
                            className="h-8 w-8"
                            onClick={handleSave}
                            disabled={saving}
                          >
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => setEditing(null)}
                            disabled={saving}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <>
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
                          <button
                            onClick={() => startEdit(match)}
                            className="p-1.5 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                            aria-label="Edit result"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <span className="text-xs text-muted-foreground">
                            {totalPredictions} prediction{totalPredictions !== 1 ? "s" : ""}
                          </span>
                          <button
                            onClick={() => toggleExpand(match.id)}
                            className="text-xs text-muted-foreground"
                          >
                            {isOpen ? "▲" : "▼"}
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Predictions table */}
                  {isOpen && !isEditingThis && (
                    <div className="border-t pt-3">
                      {totalPredictions === 0 ? (
                        <p className="text-xs text-muted-foreground">No predictions for this match.</p>
                      ) : (
                        <div className="space-y-1">
                          <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-2 pb-1">
                            <span className="text-xs font-medium text-muted-foreground">User</span>
                            <span className="text-xs font-medium text-muted-foreground text-center">Prediction</span>
                            <span className="text-xs font-medium text-muted-foreground text-right">Points</span>
                          </div>
                          {match.predictions.map((pred) => (
                            <div key={pred.id} className="px-2 py-1.5 rounded-md bg-accent space-y-1">
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
