import { config } from '../config.js';
import { sql } from './pg.js';

const USE_PG = process.env.DB_BACKEND === 'postgres';
import { readFile } from "fs/promises";
const BASE = config.setfarmUrl;
async function setfarmFetch(path: string): Promise<any> {
    const res = await fetch(`${BASE}${path}`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok)
        throw new Error(`Setfarm ${res.status}: ${path}`);
    return res.json();
}
export async function getWorkflows() {
    if (USE_PG) {
        // Workflows are defined in YAML files, not DB. Return static list.
        return [{ id: 'feature-dev', name: 'Feature Development' }, { id: 'bug-fix', name: 'Bug Fix' }, { id: 'daily-standup', name: 'Daily Standup' }, { id: 'security-audit', name: 'Security Audit' }, { id: 'ui-refactor', name: 'UI Refactor' }];
    }
    return setfarmFetch('/api/workflows');
}
export async function getRuns() {
    if (USE_PG) {
        return sql`SELECT id, workflow_id, task, status, created_at, updated_at, run_number, meta FROM runs ORDER BY created_at DESC LIMIT 50`;
    }
    return setfarmFetch('/api/runs');
}
export async function getStories() {
    if (USE_PG) {
        return sql`SELECT * FROM stories ORDER BY created_at DESC LIMIT 200`;
    }
    return setfarmFetch('/api/stories');
}
export async function getRunStories(runId: string) {
    if (USE_PG) {
        return sql`SELECT * FROM stories WHERE run_id = ${runId} ORDER BY story_index`;
    }
    return setfarmFetch('/api/runs/' + runId + '/stories');
}
export async function getEvents(runId?: string) {
    if (USE_PG) {
        if (runId) {
            return sql`SELECT * FROM live_events WHERE project = ${runId} OR detail LIKE ${'%' + runId + '%'} ORDER BY ts DESC LIMIT 100`;
        }
        return sql`SELECT * FROM live_events ORDER BY ts DESC LIMIT 100`;
    }
    const path = runId ? `/api/events?runId=${runId}` : '/api/events';
    return setfarmFetch(path);
}
const EVENTS_PATH = '/home/setrox/.openclaw/setfarm/events.jsonl';
function parseEventsFile(content: string) {
    return content.trim().split('\n').filter(Boolean).map((line: string) => {
        try {
            return JSON.parse(line);
        }
        catch {
            return null;
        }
    }).filter(Boolean);
}
export async function getSetfarmActivity(limit = 50) {
    if (USE_PG) {
        try {
            const rows = await sql`SELECT * FROM live_events ORDER BY ts DESC LIMIT ${limit}`;
            return rows;
        } catch {
            // fall through to JSONL
        }
    }
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
    if (USE_PG) {
        try {
            // Build agent stats from live_events table
            const events = await sql`SELECT action, agent, ts, detail FROM live_events WHERE action IN ('step.running','step.done','step.failed','step.timeout') ORDER BY ts ASC`;
            const stats: Record<string, any> = {};
            const stepStart: Record<string, string> = {};

            for (const e of events) {
                const agent = e.agent ? (e.agent.includes('/') ? e.agent.split('/').pop() : e.agent) : null;
                if (!agent) continue;

                if (e.action === 'step.running') {
                    if (!stats[agent]) stats[agent] = { runs: 0, done: 0, failed: 0, timeout: 0, lastActive: '', durations: [] };
                    stats[agent].runs++;
                    stats[agent].lastActive = e.ts;
                    // Use agent+ts as key for duration tracking
                    const key = agent + ':' + e.ts;
                    stepStart[key] = e.ts;
                }
                if (e.action === 'step.done') {
                    if (!stats[agent]) stats[agent] = { runs: 0, done: 0, failed: 0, timeout: 0, lastActive: '', durations: [] };
                    stats[agent].done++;
                    stats[agent].lastActive = e.ts;
                }
                if (e.action === 'step.failed') {
                    if (!stats[agent]) stats[agent] = { runs: 0, done: 0, failed: 0, timeout: 0, lastActive: '', durations: [] };
                    stats[agent].failed++;
                    stats[agent].lastActive = e.ts;
                }
                if (e.action === 'step.timeout') {
                    if (!stats[agent]) stats[agent] = { runs: 0, done: 0, failed: 0, timeout: 0, lastActive: '', durations: [] };
                    stats[agent].timeout++;
                    stats[agent].lastActive = e.ts;
                }
            }

            // Also get duration stats from step_metrics if available
            try {
                const metrics = await sql`SELECT agent_id, AVG(duration_ms) as avg_dur FROM step_metrics GROUP BY agent_id`;
                for (const m of metrics) {
                    const agent = m.agent_id ? (m.agent_id.includes('/') ? m.agent_id.split('/').pop() : m.agent_id) : null;
                    if (agent && stats[agent]) {
                        stats[agent].avgDurationOverride = Math.round((m.avg_dur || 0) / 1000);
                    }
                }
            } catch { /* step_metrics may not have data */ }

            return Object.entries(stats).map(([name, s]) => ({
                name,
                runs: s.runs,
                successRate: s.runs > 0 ? Math.min(100, Math.round((s.done / s.runs) * 100)) : 0,
                failed: s.failed,
                timeout: s.timeout,
                avgDuration: s.avgDurationOverride || (s.durations.length > 0 ? Math.round(s.durations.reduce((a: number, b: number) => a + b, 0) / s.durations.length) : 0),
                lastActive: s.lastActive,
            }));
        } catch {
            // fall through to JSONL
        }
    }
    try {
        const content = await readFile(EVENTS_PATH, 'utf-8');
        const events = parseEventsFile(content);
        const stats: Record<string, any> = {};
        const stepAgent: Record<string, string> = {};
        const stepStart: Record<string, string> = {};
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
            avgDuration: s.durations.length > 0 ? Math.round(s.durations.reduce((a: number, b: number) => a + b, 0) / s.durations.length) : 0,
            lastActive: s.lastActive,
        }));
    }
    catch {
        return [];
    }
}
export async function getSetfarmAlerts() {
    if (USE_PG) {
        try {
            const abandoned = await sql`SELECT COUNT(*) as cnt FROM live_events WHERE detail LIKE '%abandoned%'`;
            const timeout = await sql`SELECT COUNT(*) as cnt FROM live_events WHERE action = 'step.timeout'`;
            const failed = await sql`SELECT COUNT(*) as cnt FROM live_events WHERE action IN ('step.failed','run.failed')`;
            const recent = await sql`SELECT * FROM live_events WHERE action IN ('step.timeout','step.failed','run.failed') ORDER BY ts DESC LIMIT 20`;

            return {
                counts: {
                    abandoned: Number(abandoned[0]?.cnt || 0),
                    timeout: Number(timeout[0]?.cnt || 0),
                    failed: Number(failed[0]?.cnt || 0),
                },
                recent,
            };
        } catch {
            // fall through to JSONL
        }
    }
    try {
        const content = await readFile(EVENTS_PATH, 'utf-8');
        const events = parseEventsFile(content);
        const counts = {
            abandoned: events.filter((e: any) => e.detail?.includes('abandoned')).length,
            timeout: events.filter((e: any) => e.event === 'step.timeout').length,
            failed: events.filter((e: any) => e.event === 'step.failed' || e.event === 'run.failed').length,
        };
        const recent = events
            .filter((e: any) => ['step.timeout', 'step.failed', 'run.failed'].includes(e.event))
            .slice(-20)
            .reverse();
        return { counts, recent };
    }
    catch {
        return { counts: { abandoned: 0, timeout: 0, failed: 0 }, recent: [] };
    }
}
