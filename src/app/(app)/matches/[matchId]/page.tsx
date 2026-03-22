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
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/matches/${matchId}`)
      .then(r => r.json())
      .then(data => {
        setMatch(data);
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (locked) return;
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
            <CardTitle className="text-lg">Predict Score</CardTitle>
            <Badge variant={match.status === "live" ? "destructive" : locked ? "secondary" : "outline"}>
              {locked ? <span className="flex items-center gap-1"><Lock className="h-3 w-3" /> Locked</span> : match.status.toUpperCase()}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{formatKickoff(match.kickoffTime)}</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 flex flex-col items-center gap-3">
                {match.homeTeam.logo && <img src={match.homeTeam.logo} alt="" className="h-16 w-16 object-contain" />}
                <p className="font-semibold text-center text-sm">{match.homeTeam.name}</p>
                <ScoreInput value={homeScore} onChange={setHomeScore} disabled={locked} />
              </div>
              <div className="text-muted-foreground font-bold text-xl">–</div>
              <div className="flex-1 flex flex-col items-center gap-3">
                {match.awayTeam.logo && <img src={match.awayTeam.logo} alt="" className="h-16 w-16 object-contain" />}
                <p className="font-semibold text-center text-sm">{match.awayTeam.name}</p>
                <ScoreInput value={awayScore} onChange={setAwayScore} disabled={locked} />
              </div>
            </div>

            {!locked && (
              <div className="text-center text-sm text-muted-foreground">
                Predicted outcome: <span className="text-foreground font-medium">{winner}</span>
              </div>
            )}

            {match.result && (
              <div className="bg-accent rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">Final Result</p>
                <p className="text-2xl font-bold">{match.result.homeScore} – {match.result.awayScore}</p>
                {match.prediction && (
                  <p className="text-sm mt-1">
                    <span className="text-yellow-500 font-bold">+{match.prediction.pointsAwarded} pts</span>
                  </p>
                )}
              </div>
            )}

            {!locked ? (
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? "Saving..." : match.prediction ? "Update Prediction" : "Save Prediction"}
              </Button>
            ) : (
              <p className="text-center text-sm text-muted-foreground">Predictions are locked for this match</p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
