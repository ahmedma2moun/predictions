import { cn } from "@/lib/utils";
import type { AccuracyStats } from "@/lib/services/prediction-service";

type Props = {
  stats: AccuracyStats;
  weekPoints: number;
  recentPoints: number[];
};

function Sparkline({ points }: { points: number[] }) {
  const max = Math.max(...points, 1);
  return (
    <div className="flex items-end gap-[3px] h-9">
      {points.map((p, i) => {
        const pct = Math.max(4, Math.round((p / max) * 100));
        const fill =
          p >= 6
            ? "bg-primary"
            : p >= 1
            ? "bg-primary/33"
            : "bg-border";
        return (
          <div
            key={i}
            className={cn("w-[6px] rounded-[2px]", fill)}
            style={{ height: `${pct}%` }}
          />
        );
      })}
    </div>
  );
}

export function AccuracyStatsCard({ stats, weekPoints, recentPoints }: Props) {
  return (
    <div className="rounded-[14px] border border-border bg-card overflow-hidden">
      {/* Top section */}
      <div className="p-4 border-b border-border">
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground mb-2">
          THIS WEEK
        </p>
        <div className="flex items-end justify-between gap-3">
          <span className="text-[44px] font-bold font-mono-nums text-primary leading-none">
            {weekPoints}
            <span className="text-base font-semibold text-muted-foreground ml-1">pts</span>
          </span>
          {recentPoints.length > 0 && <Sparkline points={recentPoints} />}
        </div>
      </div>

      {/* Bottom stats strip */}
      <div className="grid grid-cols-3 divide-x divide-border">
        <div className="py-[14px] px-3 flex flex-col items-center gap-0.5">
          <span className="text-xl font-bold font-mono-nums">{stats.overallAccuracy}%</span>
          <span className="text-[11px] text-muted-foreground">Outcome</span>
        </div>
        <div className="py-[14px] px-3 flex flex-col items-center gap-0.5">
          <span className="text-xl font-bold font-mono-nums text-primary">{stats.exactScorePct}%</span>
          <span className="text-[11px] text-muted-foreground">Exact</span>
        </div>
        <div className="py-[14px] px-3 flex flex-col items-center gap-0.5">
          <span className="text-xl font-bold font-mono-nums text-warning">{stats.currentStreak}</span>
          <span className="text-[11px] text-muted-foreground">Streak</span>
        </div>
      </div>
    </div>
  );
}
