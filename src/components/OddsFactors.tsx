"use client";
import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { BarChart2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type MatchOddsFactors = { homeWin: number; draw: number; awayWin: number };

type AnchorPos = { x: number; top?: number; bottom?: number };

const BASE_CELLS = [
  { key: "homeWin" as const },
  { key: "draw"    as const },
  { key: "awayWin" as const },
];

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
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap", className)}>
      {BASE_CELLS.map(({ key }) => (
        <span
          key={key}
          className={cn(
            "font-mono-nums text-[10.5px] rounded px-1 py-0.5",
            picked === key
              ? "bg-warning/20 text-warning font-semibold"
              : "text-foreground/70",
          )}
        >
          {key === "homeWin" ? "1" : key === "draw" ? "X" : "2"} {odds[key].toFixed(2)}
        </span>
      ))}
    </span>
  );
}

/** Icon button that opens a popup showing all 3 odds, with the applied outcome highlighted. */
export function OddsPopover({
  odds,
  picked,
  homeTeamName,
  awayTeamName,
  className,
}: {
  odds: MatchOddsFactors;
  picked?: "homeWin" | "draw" | "awayWin";
  homeTeamName?: string;
  awayTeamName?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<AnchorPos | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const cells = [
    { key: "homeWin" as const, label: homeTeamName ? `${homeTeamName} won` : "Home won" },
    { key: "draw"    as const, label: "Draw" },
    { key: "awayWin" as const, label: awayTeamName ? `${awayTeamName} won` : "Away won" },
  ];

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      const x = Math.max(110, Math.min(r.left + r.width / 2, window.innerWidth - 110));
      setAnchor(r.top > 160
        ? { x, bottom: window.innerHeight - r.top + 8 }
        : { x, top: r.bottom + 8 },
      );
    }
    setOpen(v => !v);
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleClick}
        className={cn("inline-flex items-center gap-0.5 rounded px-1 py-0.5 bg-warning/15 text-warning hover:bg-warning/25 transition-colors", className)}
        aria-label="View match odds"
      >
        <BarChart2 className="h-3 w-3" />
      </button>
      {open && anchor && createPortal(
        <>
          <div className="fixed inset-0 z-40" onMouseDown={() => setOpen(false)} />
          <div
            className="fixed z-50 bg-popover border rounded-lg shadow-lg p-3 min-w-[160px]"
            style={{ left: anchor.x, transform: 'translateX(-50%)', top: anchor.top, bottom: anchor.bottom }}
            onMouseDown={e => e.stopPropagation()}
          >
            <p className="text-xs font-semibold mb-1.5 text-foreground">Match odds</p>
            <div className="space-y-1">
              {cells.map(({ key, label }) => {
                const isPicked = picked === key;
                return (
                  <div
                    key={key}
                    className={cn(
                      "flex items-center justify-between gap-6 rounded px-1.5 py-0.5",
                      isPicked && "bg-warning/15",
                    )}
                  >
                    <span className={cn(
                      "text-xs font-medium",
                      isPicked ? "text-warning font-semibold" : "text-foreground",
                    )}>
                      {label}
                    </span>
                    <span className={cn(
                      "text-xs font-mono-nums",
                      isPicked ? "text-warning font-semibold" : "text-muted-foreground",
                    )}>
                      {odds[key].toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </>,
        document.body,
      )}
    </>
  );
}

export function getPredictedOutcome(homeScore: number, awayScore: number): "homeWin" | "draw" | "awayWin" {
  if (homeScore > awayScore) return "homeWin";
  if (awayScore > homeScore) return "awayWin";
  return "draw";
}
