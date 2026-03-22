"use client";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatKickoff } from "@/lib/utils";

export default function PredictionsPage() {
  const [predictions, setPredictions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/predictions")
      .then(r => r.json())
      .then(data => { setPredictions(data); setLoading(false); });
  }, []);

  const totalPoints = predictions.reduce((sum, p) => sum + (p.pointsAwarded || 0), 0);

  if (loading) return <div className="flex items-center justify-center min-h-[50vh]"><div className="animate-spin text-4xl">⚽</div></div>;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Predictions</h1>
        <Badge variant="outline" className="text-base px-3 py-1">{totalPoints} pts total</Badge>
      </div>

      {predictions.length === 0 ? (
        <p className="text-muted-foreground">No predictions yet. Go predict some matches!</p>
      ) : (
        predictions.map(pred => {
          const match = pred.matchId;
          if (!match) return null;
          const isFinished = match.status === "finished";
          return (
            <Card key={pred._id} className={isFinished && pred.pointsAwarded > 0 ? "border-green-500/30" : ""}>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">{formatKickoff(match.kickoffTime)}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant={isFinished ? "secondary" : "outline"} className="text-xs">
                      {match.status.toUpperCase()}
                    </Badge>
                    {isFinished && (
                      <Badge variant={pred.pointsAwarded > 0 ? "default" : "secondary"} className="text-xs">
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
                    <p className="font-bold text-lg">{pred.homeScore} – {pred.awayScore}</p>
                    {isFinished && match.result && (
                      <p className="text-xs text-muted-foreground">Actual: {match.result.homeScore} – {match.result.awayScore}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Away</p>
                    <p className="font-medium text-sm">{match.awayTeam?.name}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
