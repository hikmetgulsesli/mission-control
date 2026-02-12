import { config } from '../config.js';
const BASE = config.antfarmUrl;
async function antfarmFetch(path) {
    const res = await fetch(`${BASE}${path}`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok)
        throw new Error(`Antfarm ${res.status}: ${path}`);
    return res.json();
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
export async function getEvents(runId) {
    const path = runId ? `/api/events?runId=${runId}` : '/api/events';
    return antfarmFetch(path);
}
