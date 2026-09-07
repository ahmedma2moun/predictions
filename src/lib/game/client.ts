'use client';
import { useCallback, useEffect, useState } from 'react';

export async function gameRequest<T>(url: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { method: body === undefined ? 'GET' : 'POST', headers: body === undefined ? undefined : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal, cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? 'Please try again');
  return data as T;
}

export function useGameResource<T>(url: string) {
  const [state, setState] = useState<{ url: string; data: T } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    gameRequest<T>(url, undefined, controller.signal).then(data => { if (!controller.signal.aborted) { setState({ url, data }); setError(null); } }).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [url, tick]);
  const replace = useCallback((data: T) => setState({ url, data }), [url]);
  return { data: state?.url === url ? state.data : null, error, replace, refresh: () => { setError(null); setTick(t => t + 1); } };
}
