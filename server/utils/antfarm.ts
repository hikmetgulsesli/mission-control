import { config } from '../config.js';

const BASE = config.antfarmUrl;

async function antfarmFetch<T = unknown>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`Antfarm ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

export async function getWorkflows() {
  return antfarmFetch('/api/workflows');
}

export async function getRuns() {
  return antfarmFetch('/api/runs');
}

export async function getStories() {
  return antfarmFetch('/api/stories');
}

export async function getEvents(runId?: string) {
  const path = runId ? `/api/events?runId=${runId}` : '/api/events';
  return antfarmFetch(path);
}
