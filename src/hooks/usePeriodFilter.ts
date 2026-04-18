"use client";
import { useMemo, useState } from "react";
import {
  computeWeekLabel,
  computeMonthLabel,
  getDateRange,
  type Period,
} from "@/lib/period-filter";

export type { Period };

export function usePeriodFilter() {
  const [period, setPeriod]           = useState<Period>("all");
  const [weekOffset, setWeekOffset]   = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);

  const dateRange = useMemo(
    () => getDateRange(period, weekOffset, monthOffset),
    [period, weekOffset, monthOffset],
  );

  const weekLabel  = useMemo(() => computeWeekLabel(weekOffset),  [weekOffset]);
  const monthLabel = useMemo(() => computeMonthLabel(monthOffset), [monthOffset]);

  return {
    period, setPeriod,
    weekOffset, setWeekOffset,
    monthOffset, setMonthOffset,
    weekLabel, monthLabel,
    dateRange,
  };
}
