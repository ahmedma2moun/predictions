import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import type { AccuracyStats } from "@/lib/services/prediction-service";

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-0.5 py-2">
      <div className="h-7 flex items-center justify-center">
        {typeof value === "string" ? (
          <span className="text-lg font-bold tabular-nums leading-tight">{value}</span>
        ) : value}
      </div>
      <span className="text-xs text-muted-foreground text-center leading-tight">{label}</span>
    </div>
  );
}

export function AccuracyStatsCard({ stats }: { stats: AccuracyStats }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <div className="grid grid-cols-3 gap-x-2">
          <Stat label="Accuracy" value={`${stats.overallAccuracy}%`} />
          <Stat label="Correct Winner" value={`${stats.correctWinnerPct}%`} />
          <Stat label="Exact Score" value={`${stats.exactScorePct}%`} />
          <Stat label="Total Points" value={`${stats.totalPoints}`} />
          <Stat
            label="Best League"
            value={
              stats.bestLeagueLogo
                ? <img src={stats.bestLeagueLogo} alt={stats.bestLeagueName ?? "Best League"} className="h-7 w-7 object-contain" />
                : (stats.bestLeagueName ?? "—")
            }
          />
          <Stat
            label="Current Streak"
            value={stats.currentStreak > 0 ? `${stats.currentStreak}` : "—"}
          />
        </div>
        <p className="text-xs text-muted-foreground text-center mt-2">
          Based on {stats.totalFinished} finished match{stats.totalFinished !== 1 ? "es" : ""}
        </p>
      </CardContent>
    </Card>
  );
}
