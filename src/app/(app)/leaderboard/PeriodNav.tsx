"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Period } from "@/lib/period-filter";

type Props = {
  period: Period;
  setPeriod: (v: Period) => void;
  weekOffset: number;
  setWeekOffset: React.Dispatch<React.SetStateAction<number>>;
  monthOffset: number;
  setMonthOffset: React.Dispatch<React.SetStateAction<number>>;
  weekLabel: string;
  monthLabel: string;
};

const PERIODS: { value: Period; label: string }[] = [
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "all", label: "All Time" },
];

export function PeriodNav({
  period, setPeriod,
  setWeekOffset,
  setMonthOffset,
  weekLabel, monthLabel,
}: Props) {
  return (
    <>
      {/* Segmented control */}
      <div className="bg-card-elevated border border-border rounded-[14px] p-1 grid grid-cols-3">
        {PERIODS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setPeriod(value)}
            className={cn(
              "py-1.5 text-sm rounded-[10px] transition-colors",
              period === value
                ? "bg-primary text-primary-foreground font-semibold"
                : "text-muted-foreground font-medium hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Week offset nav */}
      {period === "week" && (
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => setWeekOffset(o => o - 1)}
            className="h-8 w-8 flex items-center justify-center rounded-full bg-card-elevated border border-border hover:border-border/80 transition-colors"
            aria-label="Previous week"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold font-mono-nums">{weekLabel}</span>
          <button
            onClick={() => setWeekOffset(o => o + 1)}
            className="h-8 w-8 flex items-center justify-center rounded-full bg-card-elevated border border-border hover:border-border/80 transition-colors"
            aria-label="Next week"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Month offset nav */}
      {period === "month" && (
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => setMonthOffset(o => o - 1)}
            className="h-8 w-8 flex items-center justify-center rounded-full bg-card-elevated border border-border hover:border-border/80 transition-colors"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold font-mono-nums">{monthLabel}</span>
          <button
            onClick={() => setMonthOffset(o => o + 1)}
            className="h-8 w-8 flex items-center justify-center rounded-full bg-card-elevated border border-border hover:border-border/80 transition-colors"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </>
  );
}
