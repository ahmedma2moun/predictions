import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiRequest } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { fmtDate, fmtMonthYear, getMonthBounds, getWeekBounds } from '@/utils/leaderboard-dates';
import type {
  LeaderboardEntry,
  LeaderboardGroup,
  LeaderboardLeague,
  LeaderboardUserPrediction,
} from '@/types/api';
import { useRemoteData } from './useRemoteData';

export type Period = 'all' | 'month' | 'week';

export function useLeaderboard() {
  const { token, user } = useAuth();

  const [period, setPeriod]           = useState<Period>('all');
  const [weekOffset, setWeekOffset]   = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);

  const [groups, setGroups]               = useState<LeaderboardGroup[]>([]);
  const [groupId, setGroupId]             = useState<string | null>(null);
  const [groupsReady, setGroupsReady]     = useState(false);

  const [leagues, setLeagues]                       = useState<LeaderboardLeague[]>([]);
  const [selectedLeagues, setSelectedLeagues]       = useState<string[]>([]);
  const [leagueDropdownOpen, setLeagueDropdownOpen] = useState(false);

  const [expandedUserId, setExpandedUserId]   = useState<string | null>(null);
  const [expandedLoading, setExpandedLoading] = useState(false);
  const expandedCache = useRef<Record<string, LeaderboardUserPrediction[]>>({});
  const [expandedData, setExpandedData] = useState<LeaderboardUserPrediction[] | null>(null);

  const range = useMemo<{ from: Date; to: Date } | null>(() => {
    if (period === 'week')  return getWeekBounds(weekOffset);
    if (period === 'month') return getMonthBounds(monthOffset);
    return null;
  }, [period, weekOffset, monthOffset]);

  // Fire-once groups fetch with AbortController cleanup
  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    apiRequest<LeaderboardGroup[]>('/api/mobile/groups', { token, signal: controller.signal })
      .then(data => {
        const sorted = [...data.filter(g => !g.isDefault), ...data.filter(g => g.isDefault)];
        setGroups(sorted);
        if (sorted.length > 0) setGroupId(sorted[0].id);
      })
      .catch(() => {})
      .finally(() => setGroupsReady(true));
    return () => controller.abort();
  }, [token]);

  // Fire-once leagues fetch with AbortController cleanup
  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    apiRequest<LeaderboardLeague[]>('/api/mobile/leagues', { token, signal: controller.signal })
      .then(setLeagues)
      .catch(() => {});
    return () => controller.abort();
  }, [token]);

  // Reset expansion whenever filters change
  useEffect(() => {
    setExpandedUserId(null);
    setExpandedData(null);
  }, [period, weekOffset, monthOffset, groupId, selectedLeagues]);

  // Board entries via useRemoteData — AbortController and retry handled automatically.
  // enabled=false until groupsReady so loading stays true during the groups bootstrap.
  const { data: rawEntries, loading, refreshing, refresh: onRefresh } = useRemoteData<LeaderboardEntry[]>(
    (signal) => {
      let url = '/api/mobile/leaderboard?_=1';
      if (range) {
        url += `&from=${encodeURIComponent(range.from.toISOString())}`;
        url += `&to=${encodeURIComponent(range.to.toISOString())}`;
      }
      if (groupId) url += `&groupId=${encodeURIComponent(groupId)}`;
      for (const lid of selectedLeagues) url += `&leagueId=${encodeURIComponent(lid)}`;
      return apiRequest<LeaderboardEntry[]>(url, { token: token!, signal });
    },
    [token, groupsReady, range, groupId, selectedLeagues],
    { enabled: !!token && groupsReady },
  );

  const entries = rawEntries ?? [];

  const toggleExpand = useCallback(async (userId: string) => {
    if (expandedUserId === userId) {
      setExpandedUserId(null);
      setExpandedData(null);
      return;
    }
    if (!token) return;

    const key = [
      userId,
      range?.from.toISOString() ?? '',
      range?.to.toISOString() ?? '',
      selectedLeagues.slice().sort().join(','),
    ].join(':');

    setExpandedUserId(userId);
    if (expandedCache.current[key]) {
      setExpandedData(expandedCache.current[key]);
      return;
    }
    setExpandedLoading(true);
    setExpandedData(null);

    let url = `/api/mobile/leaderboard/user-predictions?userId=${encodeURIComponent(userId)}`;
    if (range) {
      url += `&from=${encodeURIComponent(range.from.toISOString())}`;
      url += `&to=${encodeURIComponent(range.to.toISOString())}`;
    }
    for (const lid of selectedLeagues) url += `&leagueId=${encodeURIComponent(lid)}`;

    try {
      const data = await apiRequest<LeaderboardUserPrediction[]>(url, { token });
      const cacheKeys = Object.keys(expandedCache.current);
      if (cacheKeys.length >= 20) {
        delete expandedCache.current[cacheKeys[0]];
      }
      expandedCache.current[key] = data;
      setExpandedData(data);
    } catch {
      setExpandedData([]);
    } finally {
      setExpandedLoading(false);
    }
  }, [expandedUserId, token, range, selectedLeagues]);

  const weekLabel = useMemo(() => {
    const { from, to } = getWeekBounds(weekOffset);
    const thursdayEnd = new Date(to);
    thursdayEnd.setDate(to.getDate() - 1);
    return `${fmtDate(from)} – ${fmtDate(thursdayEnd)}`;
  }, [weekOffset]);

  const monthLabel = useMemo(() => fmtMonthYear(getMonthBounds(monthOffset).from), [monthOffset]);

  return {
    myId: user?.id,
    period, setPeriod,
    weekOffset, setWeekOffset,
    monthOffset, setMonthOffset,
    groups,
    groupId, setGroupId,
    leagues,
    selectedLeagues, setSelectedLeagues,
    leagueDropdownOpen, setLeagueDropdownOpen,
    entries,
    loading,
    refreshing,
    onRefresh,
    expandedUserId,
    expandedLoading,
    expandedData,
    toggleExpand,
    weekLabel,
    monthLabel,
  };
}
