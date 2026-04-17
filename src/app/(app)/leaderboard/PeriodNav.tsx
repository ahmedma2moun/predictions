"use client";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  period: string;
  setPeriod: (v: string) => void;
  weekOffset: number;
  setWeekOffset: React.Dispatch<React.SetStateAction<number>>;
  monthOffset: number;
  setMonthOffset: React.Dispatch<React.SetStateAction<number>>;
  weekLabel: string;
  monthLabel: string;
};

export function PeriodNav({
  period, setPeriod,
  weekOffset, setWeekOffset,
  monthOffset, setMonthOffset,
  weekLabel, monthLabel,
}: Props) {
  return (
    <>
      <Tabs value={period} onValueChange={setPeriod}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all">All Time</TabsTrigger>
          <TabsTrigger value="month">Month</TabsTrigger>
          <TabsTrigger value="week">Week</TabsTrigger>
        </TabsList>
      </Tabs>

      {period === "week" && (
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => setWeekOffset(o => o - 1)}
            className="p-1.5 rounded-md hover:bg-accent transition-colors"
            aria-label="Previous week"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium tabular-nums">{weekLabel}</span>
          <button
            onClick={() => setWeekOffset(o => o + 1)}
            className="p-1.5 rounded-md hover:bg-accent transition-colors"
            aria-label="Next week"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {period === "month" && (
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => setMonthOffset(o => o - 1)}
            className="p-1.5 rounded-md hover:bg-accent transition-colors"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium">{monthLabel}</span>
          <button
            onClick={() => setMonthOffset(o => o + 1)}
            className="p-1.5 rounded-md hover:bg-accent transition-colors"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </>
  );
}
