"use client";
import { useState, useRef, useEffect } from "react";
import { Info } from "lucide-react";

export type RuleBreakdown = { ruleName: string; pointsAwarded: number; matched: boolean };

export function ScoringBreakdown({ rules }: { rules: RuleBreakdown[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const matched = rules.filter((r) => r.matched);

  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative flex items-center flex-wrap gap-x-2 gap-y-1">
      {matched.map((r) => (
        <span key={r.ruleName} className="text-xs text-green-500 font-medium">
          {r.ruleName} +{r.pointsAwarded}
        </span>
      ))}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Full scoring breakdown"
      >
        <Info className="h-3 w-3" />
      </button>
      {open && (
        <div className="absolute bottom-full left-0 mb-2 z-30 bg-popover border rounded-lg shadow-lg p-3 min-w-[200px]">
          <p className="text-xs font-semibold mb-2">Scoring breakdown</p>
          <div className="space-y-1.5">
            {rules.map((r) => (
              <div key={r.ruleName} className="flex items-center justify-between gap-4">
                <span
                  className={`text-xs ${
                    r.matched ? "text-green-500 font-medium" : "text-muted-foreground line-through"
                  }`}
                >
                  {r.ruleName}
                </span>
                <span
                  className={`text-xs ${
                    r.matched ? "text-green-500 font-medium" : "text-muted-foreground"
                  }`}
                >
                  +{r.pointsAwarded}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
