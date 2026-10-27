import { useState, useEffect, useCallback, useRef } from 'react';

export function usePolling<T>(
  fetcher: () => Promise<T>,
  intervalMs: number = 30000,
  key?: string,
) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const lifecycleRef = useRef<{ active: boolean; request: number } | null>(null);

  const refresh = useCallback(async () => {
    const lifecycle = lifecycleRef.current;
    if (!lifecycle?.active) return;
    const request = ++lifecycle.request;
    const ownsRequest = () => lifecycle.active && lifecycleRef.current === lifecycle && lifecycle.request === request;
    try {
      const result = await fetcherRef.current();
      if (!ownsRequest()) return;
      setData(result);
      setError(null);
    } catch (err: any) {
      if (ownsRequest()) setError(err.message);
    } finally {
      if (ownsRequest()) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const lifecycle = { active: true, request: 0 };
    lifecycleRef.current = lifecycle;
    setData(null);
    setError(null);
    setLoading(true);
    refresh();
    const id = setInterval(() => {
      // A queued timer from a replaced lifecycle cannot borrow its successor.
      if (lifecycle.active && lifecycleRef.current === lifecycle) refresh();
    }, intervalMs);
    return () => {
      lifecycle.active = false;
      if (lifecycleRef.current === lifecycle) lifecycleRef.current = null;
      clearInterval(id);
    };
  }, [key, intervalMs, refresh]);

  return { data, error, loading, refresh };
}
