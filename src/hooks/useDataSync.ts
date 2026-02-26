import { useEffect, useRef } from 'react';
import { useAppStore } from '../store/appStore';
import { api } from '../lib/api';

const KEYS = [
  'overview', 'system', 'agents', 'pipeline',
  'activity', 'wfAgents', 'alerts', 'workflows',
  'runs', 'sessions',
] as const;

const FETCHERS = [
  api.overview, api.system, api.agents, api.setfarmPipeline,
  api.setfarmActivity, api.setfarmAgents, api.setfarmAlerts, api.workflows,
  api.runs, api.sessions,
];

export function useDataSync(intervalMs = 15_000) {
  const firstRef = useRef(true);

  useEffect(() => {
    let mounted = true;

    async function poll() {
      const results = await Promise.allSettled(FETCHERS.map(fn => fn()));
      if (!mounted) return;

      const update: Record<string, any> = {};
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') update[KEYS[i]] = r.value;
      });

      if (firstRef.current) {
        update.initialLoading = false;
        firstRef.current = false;
      }

      useAppStore.setState(update);
    }

    poll();
    const id = setInterval(poll, intervalMs);
    return () => { mounted = false; clearInterval(id); };
  }, [intervalMs]);
}
