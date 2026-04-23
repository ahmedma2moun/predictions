import { apiRequest } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import type { AccuracyStats } from '@/types/api';
import { useRemoteData } from './useRemoteData';

export function useAccuracyStats() {
  const { token } = useAuth();
  return useRemoteData<AccuracyStats>(
    (signal) => apiRequest<AccuracyStats>('/api/mobile/predictions/stats', { token: token!, signal }),
    [token],
    { enabled: !!token },
  );
}
