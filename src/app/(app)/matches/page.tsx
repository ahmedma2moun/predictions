"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatKickoff, isMatchLocked } from "@/lib/utils";
import { Lock, CheckCircle } from "lucide-react";

export default function MatchesPage() {
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/matches?status=scheduled")
      .then(r => r.json())
      .then(data => { setMatches(data); setLoading(false); });
  }, []);

  if (loading) return <div className="flex items-center justify-center min-h-[50vh]"><div className="animate-spin text-4xl">⚽</div></div>;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <h1 className="text-2xl font-bold">Upcoming Matches</h1>
      {matches.length === 0 ? (
        <p className="text-muted-foreground">No upcoming matches available.</p>
      ) : (
        matches.map(match => {
          const locked = isMatchLocked(match.kickoffTime);
          const hasPrediction = !!match.prediction;
          return (
            <Link key={match._id} href={`/matches/${match._id}`}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer mb-3">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground">{formatKickoff(match.kickoffTime)}</span>
                    <div className="flex items-center gap-2">
                      {locked && <Lock className="h-3 w-3 text-muted-foreground" />}
                      {hasPrediction && <CheckCircle className="h-3 w-3 text-green-500" />}
                      <Badge variant={match.status === "live" ? "destructive" : "outline"} className="text-xs">
                        {match.status.toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex-1 text-center">
                      <p className="font-semibold text-sm">{match.homeTeam.name}</p>
                      {match.homeTeam.logo && <img src={match.homeTeam.logo} alt="" className="h-8 w-8 mx-auto mt-1 object-contain" />}
                    </div>
                    <div className="px-4 text-center">
                      {match.prediction ? (
                        <div className="text-lg font-bold tabular-nums">
                          {match.prediction.homeScore} – {match.prediction.awayScore}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">vs</span>
                      )}
                    </div>
                    <div className="flex-1 text-center">
                      <p className="font-semibold text-sm">{match.awayTeam.name}</p>
                      {match.awayTeam.logo && <img src={match.awayTeam.logo} alt="" className="h-8 w-8 mx-auto mt-1 object-contain" />}
                    </div>
                  </div>
                  {match.prediction && (
                    <p className="text-xs text-center text-muted-foreground mt-2">Your prediction ✓</p>
                  )}
                </CardContent>
              </Card>
            </Link>
          );
        })
      )}
    </div>
  );
}
