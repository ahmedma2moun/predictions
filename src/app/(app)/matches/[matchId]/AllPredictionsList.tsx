"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScoringBreakdown } from "@/components/ScoringBreakdown";
import type { RuleBreakdown } from "@/components/ScoringBreakdown";

export type PredictionRow = {
  userId: number;
  userName: string | null;
  homeScore: number;
  awayScore: number;
  pointsAwarded: number | null;
  scoringBreakdown: RuleBreakdown[] | null;
};

export function AllPredictionsList({
  predictions,
  hasResult,
  isKnockout,
}: {
  predictions: PredictionRow[];
  hasResult: boolean;
  isKnockout: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">All Predictions</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {predictions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No predictions submitted.</p>
        ) : (
          <div className="divide-y">
            {predictions.map((p) => (
              <div key={p.userId} className="px-4 py-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{p.userName}</span>
                  <div className="flex items-center gap-2">
                    <span className="tabular-nums text-sm">{p.homeScore} – {p.awayScore}</span>
                    {!isKnockout && hasResult && p.scoringBreakdown && p.scoringBreakdown.length > 0 && (
                      <ScoringBreakdown rules={p.scoringBreakdown} />
                    )}
                    {!isKnockout && hasResult && (
                      (p.pointsAwarded ?? 0) > 0
                        ? <span className="text-yellow-500 font-bold text-sm">+{p.pointsAwarded} pts</span>
                        : <span className="text-muted-foreground text-sm">0 pts</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
