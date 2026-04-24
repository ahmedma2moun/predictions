"use client";
import { useState } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";

export type RuleBreakdown = { ruleName: string; pointsAwarded: number; matched: boolean };

/** Icon-only trigger — click opens a centered overlay listing only matched scoring rules. */
export function ScoringBreakdown({ rules }: { rules: RuleBreakdown[] }) {
  const [open, setOpen] = useState(false);
  const matched = rules.filter((r) => r.matched);

  if (matched.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="text-muted-foreground hover:text-foreground transition-colors"
        aria-label="View scoring breakdown"
      >
        <Info className="h-3 w-3" />
      </button>
      {open && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onMouseDown={() => setOpen(false)}
        >
          <div
            className="bg-popover border rounded-lg shadow-lg p-3 min-w-[180px]"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <p className="text-xs font-semibold mb-1.5 text-foreground">Rules matched</p>
            <div className="space-y-1">
              {matched.map((r) => (
                <div key={r.ruleName} className="flex items-center justify-between gap-4">
                  <span className="text-xs text-green-500 font-medium">{r.ruleName}</span>
                  <span className="text-xs text-green-500 font-medium">+{r.pointsAwarded}</span>
                </div>
              ))}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
