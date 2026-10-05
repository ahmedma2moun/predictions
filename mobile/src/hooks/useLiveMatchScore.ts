import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { AppState } from 'react-native';
import { ApiError, apiRequest } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import type { MatchListItem, MatchStatus } from '@/types/api';

type LiveScore = {
  status: MatchStatus;
  homeScore: number | null;
  awayScore: number | null;
};

export function useLiveMatchScore(match: MatchListItem) {
  const { token } = useAuth();
  const [score, setScore] = useState<LiveScore | null>(null);
  const { _id: matchId, externalId, status } = match;

  useFocusEffect(useCallback(() => {
    if (!token || externalId == null || status !== 'live') return;

    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function fetchScore() {
      let shouldPoll = true;
      try {
        if (AppState.currentState !== 'active') return;
        const data = await apiRequest<LiveScore>(`/api/mobile/matches/${matchId}/live`, {
          token,
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        if (typeof data.homeScore === 'number' && typeof data.awayScore === 'number') {
          setScore(data);
        }
        shouldPoll = data.status === 'live' || data.status === 'scheduled';
      } catch (error) {
        // Preserve the last score and retry transient failures.
        if (error instanceof ApiError && [400, 401, 403, 404].includes(error.status)) {
          shouldPoll = false;
        }
      } finally {
        if (!controller.signal.aborted && shouldPoll) {
          timer = setTimeout(fetchScore, 60_000);
        }
      }
    }

    void fetchScore();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [token, matchId, externalId, status]));

  return score ?? (match.result ? { ...match.result, status } : null);
}
