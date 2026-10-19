import { useEffect, useRef } from 'react';
import { useAppStore } from '../store/appStore';
import { api } from '../lib/api';
import { createDataSync, type DataSyncKey, type DataSyncOwner } from '../lib/data-sync';

const FETCHERS = {
  overview: api.overview, system: api.system, agents: api.agents, pipeline: api.setfarmPipeline,
  activity: api.setfarmActivity, wfAgents: api.setfarmAgents, alerts: api.setfarmAlerts,
  workflows: api.workflows, runs: api.runs, sessions: api.sessions,
};
type Values = { [K in DataSyncKey]: Awaited<ReturnType<typeof FETCHERS[K]>> };
let activeOwner: DataSyncOwner<Values> | null = null;

/** Mutations share the polling owner's epoch; old polls cannot resurrect old data. */
export async function refreshDataSync(key: DataSyncKey) {
  await activeOwner?.refresh(key);
}
export function acceptDataSync<K extends DataSyncKey>(key: K, value: Values[K]) {
  activeOwner?.accept(key, value);
}

export function useDataSync(pathname: string, intervalMs = 15_000) {
  const pathRef = useRef(pathname);
  pathRef.current = pathname;
  const ownerRef = useRef<DataSyncOwner<Values> | null>(null);
  useEffect(() => {
    const owner = createDataSync<Values>({ fetchers: FETCHERS, intervalMs, initialSync: useAppStore.getState().sync, onUpdate: patch => useAppStore.setState(patch) });
    ownerRef.current = owner;
    activeOwner = owner;
    const visibility = () => owner.setContext(pathRef.current, document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', visibility);
    visibility();
    return () => {
      document.removeEventListener('visibilitychange', visibility);
      owner.dispose();
      ownerRef.current = null;
      if (activeOwner === owner) activeOwner = null;
    };
  }, [intervalMs]);
  useEffect(() => {
    ownerRef.current?.setContext(pathname, document.visibilityState === 'visible');
  }, [pathname]);
}
