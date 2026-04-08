interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  staleAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();
const refreshing = new Set<string>();

export function getCached<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  // Hard expired (5x TTL) - truly stale
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.data as T;
}

export function setCache<T>(key: string, data: T, ttlMs: number): void {
  store.set(key, {
    data,
    staleAt: Date.now() + ttlMs,
    expiresAt: Date.now() + ttlMs * 5,
  });
}

export function isStale(key: string): boolean {
  const entry = store.get(key);
  if (!entry) return true;
  return Date.now() > entry.staleAt;
}

export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const existing = getCached<T>(key);

  if (existing !== null) {
    // Serve stale data immediately, refresh in background
    if (isStale(key) && !refreshing.has(key)) {
      refreshing.add(key);
      fn().then(data => {
        setCache(key, data, ttlMs);
      }).catch(() => {}).finally(() => {
        refreshing.delete(key);
      });
    }
    return existing;
  }

  // No data at all - must wait
  const data = await fn();
  setCache(key, data, ttlMs);
  return data;
}


export function invalidateCache(key: string): void {
  store.delete(key);
}

// Wave 5 fix #22 (plan: reactive-frolicking-cupcake): operator-facing flush.
// Use when a stale cache is blocking a real state change and you want to force
// a fresh read without restarting the process.
export function clearAllCache(): number {
  const n = store.size;
  store.clear();
  return n;
}

// Pre-warm: call on startup to populate cache
const warmupFns: Array<() => Promise<void>> = [];

export function registerWarmup(fn: () => Promise<void>): void {
  warmupFns.push(fn);
}

export async function warmupAll(): Promise<void> {
  await Promise.allSettled(warmupFns.map(fn => fn()));
}
