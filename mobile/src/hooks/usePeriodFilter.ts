import { useMemo, useState } from 'react';
import {
  computeWeekLabel,
  computeMonthLabel,
  getWeekBounds,
  getMonthBounds,
} from '@/utils/leaderboard-dates';

export type Period = 'all' | 'month' | 'week';

export function usePeriodFilter() {
  const [period, setPeriod]           = useState<Period>('all');
  const [weekOffset, setWeekOffset]   = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);

  const dateRange = useMemo<{ from: Date; to: Date } | null>(() => {
    if (period === 'week')  return getWeekBounds(weekOffset);
    if (period === 'month') return getMonthBounds(monthOffset);
    return null;
  }, [period, weekOffset, monthOffset]);

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
