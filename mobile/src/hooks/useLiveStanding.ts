import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import type { LeaderboardGroup, LiveGroupStanding } from '@/types/api';

const POLL_INTERVAL_MS = 60_000;

export function useLiveStanding() {
  const { token, user } = useAuth();

  const [groups, setGroups]           = useState<LeaderboardGroup[]>([]);
  const [groupId, setGroupId]         = useState<string | null>(null);
  const [groupsReady, setGroupsReady] = useState(false);

  const [data, setData]               = useState<LiveGroupStanding | null>(null);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  // Groups fetch — same ordering as the leaderboard: custom groups first
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

  // Switching group shows the loader instead of the previous group's rows
  useEffect(() => {
    setData(null);
    setLoading(true);
  }, [groupId]);

  // Fetch + poll the live standing; background refresh every minute
  useEffect(() => {
    if (!token || !groupsReady) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function load() {
      let url = '/api/mobile/leaderboard/live';
      if (groupId) url += `?groupId=${encodeURIComponent(groupId)}`;
      try {
        const result = await apiRequest<LiveGroupStanding>(url, { token });
        if (cancelled) return;
        setData(result);
        setLastUpdated(new Date());
      } catch {
        // keep previous data on transient errors
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
          timer = setTimeout(load, POLL_INTERVAL_MS);
        }
      }
    }

    load();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [token, groupsReady, groupId, refreshTick]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setRefreshTick(t => t + 1);
  }, []);

  return {
    myId: user?.id,
    groups,
    groupId,
    setGroupId,
    data,
    loading,
    refreshing,
    onRefresh,
    lastUpdated,
  };
}
