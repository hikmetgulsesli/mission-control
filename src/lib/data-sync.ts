/** Shared shell/route HTTP receipts, separate from canonical run authority. */
export const DATA_SYNC_KEYS = ['overview', 'system', 'agents', 'pipeline', 'activity', 'wfAgents', 'alerts', 'workflows', 'runs', 'sessions'] as const;
export type DataSyncKey = typeof DATA_SYNC_KEYS[number];
export interface DataSyncMetadata {
  lastAttemptAt: number | null;
  /** Accepted HTTP payload receipt time, not upstream source generation time. */
  observedAt: number | null;
  errorAt: number | null;
  errorCode: 'FETCH_FAILED' | null;
  inFlight: boolean;
  stale: boolean;
  ownership: 'active' | 'paused' | 'unselected';
}
export type DataSyncState = Record<DataSyncKey, DataSyncMetadata>;
export function initialDataSyncState(): DataSyncState {
  return Object.fromEntries(DATA_SYNC_KEYS.map(key => [key, {
    lastAttemptAt: null, observedAt: null, errorAt: null, errorCode: null,
    inFlight: false, stale: true, ownership: 'unselected',
  }])) as DataSyncState;
}
export function dataSyncKeysForPath(pathname: string): DataSyncKey[] {
  const path = pathname.split(/[?#]/, 1)[0].replace(/\/$/, '') || '/';
  const shared: DataSyncKey[] = ['overview', 'system', 'pipeline'];
  if (path === '/setfarm') return [...shared, 'agents', 'activity', 'wfAgents', 'alerts', 'workflows', 'sessions'];
  if (path === '/workflows') return [...shared, 'workflows', 'runs'];
  return shared;
}

/** Fixed UI copy: never expose a raw upstream exception/body. */
export function dataSyncMessage(meta?: DataSyncMetadata): string {
  if (!meta || meta.observedAt === null) return meta?.errorCode ? 'Unavailable (FETCH_FAILED)' : 'Loading / unknown';
  const receipt = `Last HTTP receipt ${new Date(meta.observedAt).toLocaleTimeString()}`;
  if (meta.stale) return `Stale${meta.errorCode ? ' (FETCH_FAILED)' : meta.ownership === 'paused' ? ' (paused)' : meta.ownership === 'unselected' ? ' (not selected)' : ''} · ${receipt}`;
  return `${meta.inFlight ? 'Refreshing · ' : ''}${receipt}`;
}

type Values = Record<DataSyncKey, unknown>;
type Update<V extends Values> = Partial<V> & { sync: DataSyncState; initialLoading?: boolean };
interface Options<V extends Values> {
  fetchers: { [K in DataSyncKey]: () => Promise<V[K]> };
  onUpdate: (patch: Update<V>) => void;
  intervalMs?: number;
  now?: () => number;
  initialSync?: DataSyncState;
  setTimeout?: (callback: () => void, ms: number) => unknown;
  clearTimeout?: (id: unknown) => void;
  setInterval?: (callback: () => void, ms: number) => unknown;
  clearInterval?: (id: unknown) => void;
}
export type DataSyncOwner<V extends Values = Values> = ReturnType<typeof createDataSync<V>>;

/** One owner, independent settlements, one current flight per key, fenced obsolete work. */
export function createDataSync<V extends Values>(options: Options<V>) {
  const cadence = options.intervalMs ?? 15_000;
  const now = options.now ?? Date.now;
  let sync = initialDataSyncState();
  if (options.initialSync) {
    sync = Object.fromEntries(DATA_SYNC_KEYS.map(key => [key, { ...options.initialSync![key], inFlight: false, stale: true, ownership: 'unselected' }])) as DataSyncState;
  }
  const expiry = new Map<DataSyncKey, unknown>();
  const scheduleExpiry = options.setTimeout ?? ((fn: () => void, ms: number) => setTimeout(fn, ms));
  const cancelExpiry = options.clearTimeout ?? (id => clearTimeout(id as ReturnType<typeof setTimeout>));
  function clearExpiry(key: DataSyncKey) {
    if (expiry.has(key)) cancelExpiry(expiry.get(key));
    expiry.delete(key);
  }
  const generation = Object.fromEntries(DATA_SYNC_KEYS.map(key => [key, 0])) as Record<DataSyncKey, number>;
  let disposed = false;
  let first = true;
  function emit(values: Partial<V> = {}) {
    if (!disposed) options.onUpdate({ ...values, sync } as Update<V>);
  }
  function metadata(key: DataSyncKey, patch: Partial<DataSyncMetadata>) {
    sync = { ...sync, [key]: { ...sync[key], ...patch } };
  }
  function invalidate(key: DataSyncKey) {
    generation[key]++;
    metadata(key, { inFlight: false });
  }
  function finishFirst() {
    if (!first) return;
    first = false;
    options.onUpdate({ sync, initialLoading: false } as Update<V>);
  }
  function commit<K extends DataSyncKey>(key: K, value: V[K]) {
    metadata(key, { observedAt: now(), errorAt: null, errorCode: null, inFlight: false, stale: sync[key].ownership !== 'active' });
    clearExpiry(key);
    if (sync[key].ownership === 'active') {
      expiry.set(key, scheduleExpiry(() => {
        if (disposed || sync[key].ownership !== 'active') return;
        metadata(key, { stale: true });
        emit();
      }, cadence * 2));
    }
    emit({ [key]: value } as Partial<V>);
    finishFirst();
  }
  async function poll(key: DataSyncKey) {
    if (disposed || sync[key].ownership !== 'active' || sync[key].inFlight) return;
    const epoch = ++generation[key];
    metadata(key, { lastAttemptAt: now(), inFlight: true });
    emit();
    try {
      const value = await options.fetchers[key]();
      if (disposed || generation[key] !== epoch) return;
      commit(key, value);
    } catch {
      if (disposed || generation[key] !== epoch) return;
      metadata(key, { errorAt: now(), errorCode: 'FETCH_FAILED', inFlight: false, stale: true });
      emit();
      finishFirst();
    }
  }
  const timer = (options.setInterval ?? ((fn, ms) => setInterval(fn, ms)))(() => {
    if (disposed) return;
    for (const key of DATA_SYNC_KEYS) {
      const meta = sync[key];
      if (meta.ownership !== 'active') continue;
      if (meta.observedAt !== null && now() - meta.observedAt >= cadence * 2 && !meta.stale) {
        metadata(key, { stale: true });
        emit();
      }
      void poll(key);
    }
  }, cadence);
  return {
    setContext(pathname: string, visible: boolean) {
      if (disposed) return;
      const selected = new Set(dataSyncKeysForPath(pathname));
      const start: DataSyncKey[] = [];
      for (const key of DATA_SYNC_KEYS) {
        const ownership = selected.has(key) ? visible ? 'active' : 'paused' : 'unselected';
        if (sync[key].ownership === ownership) continue;
        clearExpiry(key);
        invalidate(key);
        // Resumption never promotes a retained receipt to current evidence.
        metadata(key, { ownership, stale: true });
        if (ownership === 'active') start.push(key);
      }
      emit();
      start.forEach(key => { void poll(key); });
    },
    async refresh(key: DataSyncKey) {
      if (disposed) return;
      invalidate(key);
      metadata(key, { stale: true });
      emit();
      await poll(key);
    },
    /** Successful acknowledged mutation (e.g. activity clear); not a failure fallback. */
    accept<K extends DataSyncKey>(key: K, value: V[K]) {
      if (disposed) return;
      invalidate(key);
      commit(key, value);
    },
    dispose() {
      if (disposed) return;
      // Release this owner's observations without changing retained data.
      for (const key of DATA_SYNC_KEYS) {
        clearExpiry(key);
        invalidate(key);
        metadata(key, { ownership: sync[key].ownership === 'active' ? 'paused' : sync[key].ownership, stale: true });
      }
      emit();
      disposed = true;
      (options.clearInterval ?? (id => clearInterval(id as ReturnType<typeof setInterval>)))(timer);
    },
  };
}
