import { useCallback, useState } from 'react';
import { apiRequest } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import type { ChampionBonusState } from '@/types/api';
import { useRemoteData } from './useRemoteData';

export function useChampionBonus() {
  const { token } = useAuth();
  const [picking, setPicking] = useState<string | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);

  const { data, loading, refreshing, error, refresh } = useRemoteData<ChampionBonusState>(
    (signal) => apiRequest<ChampionBonusState>('/api/mobile/champion-bonus', { token: token!, signal }),
    [token],
    { enabled: !!token },
  );

  const pick = useCallback(async (teamId: string) => {
    if (!token) return;
    setPicking(teamId);
    setPickError(null);
    try {
      await apiRequest('/api/mobile/champion-bonus/pick', {
        method: 'POST',
        token,
        body: { teamId: Number(teamId) },
      });
      refresh();
    } catch (e: any) {
      setPickError(e?.message ?? 'Failed to pick');
    } finally {
      setPicking(null);
    }
  }, [token, refresh]);

  return {
    state: data,
    loading,
    refreshing,
    error,
    onRefresh: refresh,
    picking,
    pickError,
    pick,
  };
}
