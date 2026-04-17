import { apiRequest } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import type { MatchListItem } from '@/types/api';
import { useRemoteData } from './useRemoteData';

export function useMatches() {
  const { token } = useAuth();

  const { data, loading, refreshing, error, refresh } = useRemoteData<MatchListItem[]>(
    async (signal) => {
      const [scheduled, live] = await Promise.all([
        apiRequest<MatchListItem[]>('/api/mobile/matches?status=scheduled', { token: token!, signal }),
        apiRequest<MatchListItem[]>('/api/mobile/matches?status=live', { token: token!, signal }),
      ]);
      return [...live, ...scheduled].sort(
        (a, b) => new Date(a.kickoffTime).getTime() - new Date(b.kickoffTime).getTime(),
      );
    },
    [token],
    { enabled: !!token },
  );

  return {
    matches: data ?? [],
    loading,
    refreshing,
    error,
    onRefresh: refresh,
  };
}
