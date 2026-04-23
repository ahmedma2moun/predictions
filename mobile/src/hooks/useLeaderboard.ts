import { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import type {
  LeaderboardEntry,
  LeaderboardGroup,
  LeaderboardLeague,
  LeaderboardUserPrediction,
} from '@/types/api';
import { useRemoteData } from './useRemoteData';
import { usePeriodFilter } from './usePeriodFilter';

export type { Period } from './usePeriodFilter';

export function useLeaderboard() {
  const { token, user } = useAuth();

  const {
    period, setPeriod,
    weekOffset, setWeekOffset,
    monthOffset, setMonthOffset,
    weekLabel, monthLabel,
    dateRange,
  } = usePeriodFilter();

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
  }, [dateRange, groupId, selectedLeagues]);

  // Board entries via useRemoteData
  const { data: rawEntries, loading, refreshing, refresh: onRefresh } = useRemoteData<LeaderboardEntry[]>(
    (signal) => {
      let url = '/api/mobile/leaderboard?_=1';
      if (dateRange) {
        url += `&from=${encodeURIComponent(dateRange.from.toISOString())}`;
        url += `&to=${encodeURIComponent(dateRange.to.toISOString())}`;
      }
      if (groupId) url += `&groupId=${encodeURIComponent(groupId)}`;
      for (const lid of selectedLeagues) url += `&leagueId=${encodeURIComponent(lid)}`;
      return apiRequest<LeaderboardEntry[]>(url, { token: token!, signal });
    },
    [token, groupsReady, dateRange, groupId, selectedLeagues],
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
      dateRange?.from.toISOString() ?? '',
      dateRange?.to.toISOString() ?? '',
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
    if (dateRange) {
      url += `&from=${encodeURIComponent(dateRange.from.toISOString())}`;
      url += `&to=${encodeURIComponent(dateRange.to.toISOString())}`;
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
  }, [expandedUserId, token, dateRange, selectedLeagues]);

  const isCurrentPeriod = !dateRange || dateRange.to > new Date();

  return {
    myId: user?.id,
    isCurrentPeriod,
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
