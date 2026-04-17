import { useMemo } from 'react';
import { apiRequest } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import type { PredictionHistoryItem } from '@/types/api';
import { isMatchLocked } from '@/utils/format';
import { useRemoteData } from './useRemoteData';

export function usePredictions() {
  const { token } = useAuth();

  const { data, loading, refreshing, error, refresh } = useRemoteData<PredictionHistoryItem[]>(
    (signal) => apiRequest<PredictionHistoryItem[]>('/api/mobile/predictions', { token: token!, signal }),
    [token],
    { enabled: !!token },
  );

  const predictions = data ?? [];

  const { futurePreds, pastPreds, totalPoints } = useMemo(() => {
    const future: PredictionHistoryItem[] = [];
    const past: PredictionHistoryItem[]   = [];
    let total = 0;
    for (const p of predictions) {
      total += p.pointsAwarded ?? 0;
      if (isMatchLocked(p.match.kickoffTime)) past.push(p);
      else future.push(p);
    }
    future.sort((a, b) => new Date(a.match.kickoffTime).getTime() - new Date(b.match.kickoffTime).getTime());
    past.sort((a, b)   => new Date(b.match.kickoffTime).getTime() - new Date(a.match.kickoffTime).getTime());
    return { futurePreds: future, pastPreds: past, totalPoints: total };
  }, [predictions]);

  return {
    predictions,
    loading,
    refreshing,
    error,
    onRefresh: refresh,
    futurePreds,
    pastPreds,
    totalPoints,
  };
}
