const store = new Map();
const refreshing = new Set();
export function getCached(key) {
    const entry = store.get(key);
    if (!entry)
        return null;
    // Hard expired (5x TTL) - truly stale
    if (Date.now() > entry.expiresAt) {
        store.delete(key);
        return null;
    }
    return entry.data;
}
export function setCache(key, data, ttlMs) {
    store.set(key, {
        data,
        staleAt: Date.now() + ttlMs,
        expiresAt: Date.now() + ttlMs * 5,
    });
}
export function isStale(key) {
    const entry = store.get(key);
    if (!entry)
        return true;
    return Date.now() > entry.staleAt;
}
export async function cached(key, ttlMs, fn) {
    const existing = getCached(key);
    if (existing !== null) {
        // Serve stale data immediately, refresh in background
        if (isStale(key) && !refreshing.has(key)) {
            refreshing.add(key);
            fn().then(data => {
                setCache(key, data, ttlMs);
            }).catch(() => { }).finally(() => {
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
export function invalidateCache(key) {
    store.delete(key);
}
// Pre-warm: call on startup to populate cache
const warmupFns = [];
export function registerWarmup(fn) {
    warmupFns.push(fn);
}
export async function warmupAll() {
    await Promise.allSettled(warmupFns.map(fn => fn()));
}
