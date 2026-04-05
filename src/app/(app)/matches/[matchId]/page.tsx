"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatKickoff, isMatchLocked } from "@/lib/utils";
import { toast } from "sonner";
import { ChevronLeft, Minus, Plus, Lock } from "lucide-react";

function ScoreInput({ value, onChange, disabled }: { value: number; onChange: (v: number) => void; disabled: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-12 w-12 rounded-full"
        onClick={() => onChange(Math.max(0, value - 1))}
        disabled={disabled || value <= 0}
      >
        <Minus className="h-4 w-4" />
      </Button>
      <span className="text-3xl font-bold tabular-nums w-12 text-center">{value}</span>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-12 w-12 rounded-full"
        onClick={() => onChange(value + 1)}
        disabled={disabled}
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default function MatchPredictionPage() {
  const { matchId } = useParams();
  const router = useRouter();
  const [match, setMatch] = useState<any>(null);
  const [allPredictions, setAllPredictions] = useState<any[] | null>(null);
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/matches/${matchId}`)
      .then(r => r.json())
      .then(data => {
        setMatch(data);
        setAllPredictions(data.allPredictions ?? null);
        if (data.prediction) {
          setHomeScore(data.prediction.homeScore);
          setAwayScore(data.prediction.awayScore);
        }
        setLoading(false);
      });
  }, [matchId]);

  if (loading) return <div className="flex items-center justify-center min-h-[50vh]"><div className="animate-spin text-4xl">⚽</div></div>;
  if (!match) return <div className="p-4">Match not found</div>;

  const locked = isMatchLocked(match.kickoffTime);
  const isAdmin = match.isAdmin as boolean;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (locked || isAdmin) return;
    setSaving(true);
    const res = await fetch("/api/predictions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchId, homeScore, awayScore }),
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Prediction saved!");
      router.push("/matches");
    } else {
      const err = await res.json();
      toast.error(err.error || "Failed to save");
    }
  }

  const winner = homeScore > awayScore ? match.homeTeam.name : awayScore > homeScore ? match.awayTeam.name : "Draw";

  return (
    <div className="max-w-md mx-auto px-4 py-6 space-y-4">
      <Button variant="ghost" onClick={() => router.back()} className="gap-2 pl-0">
        <ChevronLeft className="h-4 w-4" /> Back
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{isAdmin ? "Match Details" : "Predict Score"}</CardTitle>
            <Badge variant={match.status === "live" ? "destructive" : locked ? "secondary" : "outline"}>
              {locked ? <span className="flex items-center gap-1"><Lock className="h-3 w-3" /> Locked</span> : match.status.toUpperCase()}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{formatKickoff(match.kickoffTime)}</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 flex flex-col items-center gap-3">
                {match.homeTeam.logo && <img src={match.homeTeam.logo} alt="" className="h-16 w-16 object-contain" />}
                <p className="font-semibold text-center text-sm">{match.homeTeam.name}</p>
                {!isAdmin && <ScoreInput value={homeScore} onChange={setHomeScore} disabled={locked} />}
              </div>
              <div className="text-muted-foreground font-bold text-xl">–</div>
              <div className="flex-1 flex flex-col items-center gap-3">
                {match.awayTeam.logo && <img src={match.awayTeam.logo} alt="" className="h-16 w-16 object-contain" />}
                <p className="font-semibold text-center text-sm">{match.awayTeam.name}</p>
                {!isAdmin && <ScoreInput value={awayScore} onChange={setAwayScore} disabled={locked} />}
              </div>
            </div>

            {!isAdmin && !locked && (
              <div className="text-center text-sm text-muted-foreground">
                Predicted outcome: <span className="text-foreground font-medium">{winner}</span>
              </div>
            )}

            {match.result && (
              <div className="bg-accent rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">Final Result</p>
                <p className="text-2xl font-bold">{match.result.homeScore} – {match.result.awayScore}</p>
                {!isAdmin && match.prediction && (
                  <p className="text-sm mt-1">
                    <span className="text-yellow-500 font-bold">+{match.prediction.pointsAwarded} pts</span>
                  </p>
                )}
              </div>
            )}

            {!isAdmin && (
              !locked ? (
                <form onSubmit={handleSubmit}>
                  <Button type="submit" className="w-full" disabled={saving}>
                    {saving ? "Saving..." : match.prediction ? "Update Prediction" : "Save Prediction"}
                  </Button>
                </form>
              ) : (
                <p className="text-center text-sm text-muted-foreground">Predictions are locked for this match</p>
              )
            )}
          </div>
        </CardContent>
      </Card>

      {(locked || isAdmin) && allPredictions && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">All Predictions</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {allPredictions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No predictions submitted.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Player</th>
                    <th className="text-center px-4 py-2 font-medium text-muted-foreground">Prediction</th>
                    {match.result && (
                      <th className="text-right px-4 py-2 font-medium text-muted-foreground">Pts</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {allPredictions.map((p: any) => (
                    <tr key={p.userId} className="border-b last:border-0">
                      <td className="px-4 py-3 font-medium">{p.userName}</td>
                      <td className="px-4 py-3 text-center tabular-nums">
                        {p.homeScore} – {p.awayScore}
                      </td>
                      {match.result && (
                        <td className="px-4 py-3 text-right">
                          {p.pointsAwarded > 0 ? (
                            <span className="text-yellow-500 font-bold">+{p.pointsAwarded}</span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
