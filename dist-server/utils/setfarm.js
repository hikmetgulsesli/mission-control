import { config } from '../config.js';
import { readFile } from "fs/promises";
const BASE = config.setfarmUrl;
async function setfarmFetch(path) {
    const res = await fetch(`${BASE}${path}`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok)
        throw new Error(`Setfarm ${res.status}: ${path}`);
    return res.json();
}
export async function getWorkflows() {
    return setfarmFetch('/api/workflows');
}
export async function getRuns() {
    return setfarmFetch('/api/runs');
}
export async function getStories() {
    return setfarmFetch('/api/stories');
}
export async function getRunStories(runId) {
    return setfarmFetch('/api/runs/' + runId + '/stories');
}
export async function getEvents(runId) {
    const path = runId ? `/api/events?runId=${runId}` : '/api/events';
    return setfarmFetch(path);
}
const EVENTS_PATH = '/home/setrox/.openclaw/setfarm/events.jsonl';
function parseEventsFile(content) {
    return content.trim().split('\n').filter(Boolean).map(line => {
        try {
            return JSON.parse(line);
        }
        catch {
            return null;
        }
    }).filter(Boolean);
}
export async function getSetfarmActivity(limit = 50) {
    try {
        const content = await readFile(EVENTS_PATH, 'utf-8');
        const events = parseEventsFile(content);
        return events.slice(-limit).reverse();
    }
    catch {
        return [];
    }
}
export async function getSetfarmAgentStats() {
    try {
        const content = await readFile(EVENTS_PATH, 'utf-8');
        const events = parseEventsFile(content);
        const stats = {};
        const stepAgent = {};
        const stepStart = {};
        for (const e of events) {
            if (e.event === 'step.running' && e.agentId && e.stepId) {
                const agent = e.agentId.split('/').pop() || e.agentId;
                stepAgent[e.stepId] = agent;
                if (!stats[agent])
                    stats[agent] = { runs: 0, done: 0, failed: 0, timeout: 0, lastActive: '', durations: [] };
                stats[agent].runs++;
                stats[agent].lastActive = e.ts;
                stepStart[e.stepId] = e.ts;
            }
            if (e.event === 'step.done' && e.stepId) {
                const agent = e.agentId?.split('/').pop() || stepAgent[e.stepId];
                if (agent) {
                    if (!stats[agent])
                        stats[agent] = { runs: 0, done: 0, failed: 0, timeout: 0, lastActive: '', durations: [] };
                    stats[agent].done++;
                    stats[agent].lastActive = e.ts;
                    if (stepStart[e.stepId]) {
                        const dur = (new Date(e.ts).getTime() - new Date(stepStart[e.stepId]).getTime()) / 1000;
                        if (dur > 0)
                            stats[agent].durations.push(dur);
                    }
                }
            }
            if (e.event === 'step.failed' && e.stepId) {
                const agent = e.agentId?.split('/').pop() || stepAgent[e.stepId];
                if (agent) {
                    if (!stats[agent])
                        stats[agent] = { runs: 0, done: 0, failed: 0, timeout: 0, lastActive: '', durations: [] };
                    stats[agent].failed++;
                    stats[agent].lastActive = e.ts;
                }
            }
            if (e.event === 'step.timeout' && e.stepId) {
                const agent = e.agentId?.split('/').pop() || stepAgent[e.stepId];
                if (agent) {
                    if (!stats[agent])
                        stats[agent] = { runs: 0, done: 0, failed: 0, timeout: 0, lastActive: '', durations: [] };
                    stats[agent].timeout++;
                    stats[agent].lastActive = e.ts;
                }
            }
        }
        return Object.entries(stats).map(([name, s]) => ({
            name,
            runs: s.runs,
            successRate: s.runs > 0 ? Math.min(100, Math.round((s.done / s.runs) * 100)) : 0,
            failed: s.failed,
            timeout: s.timeout,
            avgDuration: s.durations.length > 0 ? Math.round(s.durations.reduce((a, b) => a + b, 0) / s.durations.length) : 0,
            lastActive: s.lastActive,
        }));
    }
    catch {
        return [];
    }
}
export async function getSetfarmAlerts() {
    try {
        const content = await readFile(EVENTS_PATH, 'utf-8');
        const events = parseEventsFile(content);
        const counts = {
            abandoned: events.filter(e => e.detail?.includes('abandoned')).length,
            timeout: events.filter(e => e.event === 'step.timeout').length,
            failed: events.filter(e => e.event === 'step.failed' || e.event === 'run.failed').length,
        };
        const recent = events
            .filter(e => ['step.timeout', 'step.failed', 'run.failed'].includes(e.event))
            .slice(-20)
            .reverse();
        return { counts, recent };
    }
    catch {
        return { counts: { abandoned: 0, timeout: 0, failed: 0 }, recent: [] };
    }
}
