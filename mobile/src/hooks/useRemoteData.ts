import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Generic data-fetching hook. Handles loading, refreshing, error, and
 * AbortController cleanup automatically. Re-fetches whenever deps change.
 * Call refresh() for pull-to-refresh (sets refreshing instead of loading).
 *
 * Pass enabled=false to hold the fetch until preconditions are met — loading
 * stays true until the first successful fetch.
 */
export function useRemoteData<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  deps: unknown[],
  options?: { enabled?: boolean },
): {
  data: T | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refresh: () => void;
} {
  const enabled = options?.enabled !== false;

  const [data, setData]             = useState<T | null>(null);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [tick, setTick]             = useState(0);

  const isRefreshRef = useRef(false);
  // always-current fetcher ref avoids stale closures without adding fetcher to deps
  const fetcherRef   = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    if (!enabled) return;

    const isRefresh = isRefreshRef.current;
    isRefreshRef.current = false;

    if (!isRefresh) setLoading(true);
    setError(null);

    const controller = new AbortController();

    fetcherRef.current(controller.signal)
      .then(result => {
        if (!controller.signal.aborted) {
          setData(result);
          setLoading(false);
          setRefreshing(false);
        }
      })
      .catch((e: any) => {
        if (!controller.signal.aborted) {
          setError(e?.message ?? 'Something went wrong');
          setLoading(false);
          setRefreshing(false);
        }
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick, enabled]);

  const refresh = useCallback(() => {
    isRefreshRef.current = true;
    setRefreshing(true);
    setTick(t => t + 1);
  }, []);

  return { data, loading, refreshing, error, refresh };
}
