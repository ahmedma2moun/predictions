"use client";
import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";

export type RuleBreakdown = { ruleName: string; pointsAwarded: number; matched: boolean };

type AnchorPos = { x: number; top?: number; bottom?: number };

/** Icon-only trigger — click opens a popup above the trigger listing only matched scoring rules. */
export function ScoringBreakdown({ rules }: { rules: RuleBreakdown[] }) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<AnchorPos | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const matched = rules.filter((r) => r.matched);

  if (matched.length === 0) return null;

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      const x = Math.max(98, Math.min(r.left + r.width / 2, window.innerWidth - 98));
      setAnchor(r.top > 160
        ? { x, bottom: window.innerHeight - r.top + 8 }
        : { x, top: r.bottom + 8 },
      );
    }
    setOpen((v) => !v);
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleClick}
        className="text-muted-foreground hover:text-foreground transition-colors"
        aria-label="View scoring breakdown"
      >
        <Info className="h-3 w-3" />
      </button>
      {open && anchor && createPortal(
        <>
          <div className="fixed inset-0 z-40" onMouseDown={() => setOpen(false)} />
          <div
            className="fixed z-50 bg-popover border rounded-lg shadow-lg p-3 min-w-[180px]"
            style={{ left: anchor.x, transform: 'translateX(-50%)', top: anchor.top, bottom: anchor.bottom }}
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
        </>,
        document.body,
      )}
    </>
  );
}
