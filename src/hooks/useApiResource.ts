"use client";
import { useCallback, useEffect, useState } from "react";

/**
 * Wraps the fetch → loading → error → setState cycle that admin pages were
 * each hand-rolling independently. Pass a stable loader (wrap it in
 * useCallback) and it runs on mount, and again whenever the loader's
 * identity changes.
 */
export function useApiResource<T>(
  loader: () => Promise<T>,
  initial: T,
  errorMessage = "Failed to load. Please refresh.",
) {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await loader());
    } catch {
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [loader, errorMessage]);

  useEffect(() => { load(); }, [load]);

  return { data, setData, loading, error, reload: load };
}
