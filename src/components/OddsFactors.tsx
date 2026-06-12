import { cn } from "@/lib/utils";

export type MatchOddsFactors = { homeWin: number; draw: number; awayWin: number };

/**
 * Compact 1/X/2 odds factors shown next to a finished match's result.
 * `picked` highlights the outcome the user predicted.
 */
export function OddsFactors({
  odds,
  picked,
  className,
}: {
  odds: MatchOddsFactors;
  picked?: "homeWin" | "draw" | "awayWin";
  className?: string;
}) {
  const cells = [
    { key: "homeWin" as const, label: "1", value: odds.homeWin },
    { key: "draw" as const,    label: "X", value: odds.draw },
    { key: "awayWin" as const, label: "2", value: odds.awayWin },
  ];
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap", className)}>
      {cells.map(({ key, label, value }) => (
        <span
          key={key}
          className={cn(
            "font-mono-nums text-[10.5px]",
            picked === key ? "text-warning font-semibold" : "text-muted-foreground",
          )}
        >
          {label} {value.toFixed(2)}
        </span>
      ))}
    </span>
  );
}

export function getPredictedOutcome(homeScore: number, awayScore: number): "homeWin" | "draw" | "awayWin" {
  if (homeScore > awayScore) return "homeWin";
  if (awayScore > homeScore) return "awayWin";
  return "draw";
}
