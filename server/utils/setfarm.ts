import { config } from '../config.js';
import { sql } from './pg.js';

const USE_PG = true; // Faz7: PG-only
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
      try {
        const runs = await sql`SELECT * FROM runs ORDER BY created_at DESC LIMIT 50`;
        // Attach steps and story progress to each run (frontend expects run.steps array)
        if (runs.length > 0) {
            const runIds = runs.map((r: any) => r.id);
            const steps = await sql`SELECT * FROM steps WHERE run_id = ANY(${runIds}) ORDER BY step_index`;
            const stories = await sql`SELECT run_id, status, COUNT(*)::int as cnt FROM stories WHERE run_id = ANY(${runIds}) GROUP BY run_id, status`;

            const stepMap: Record<string, any[]> = {};
            for (const s of steps) {
                if (!stepMap[s.run_id]) stepMap[s.run_id] = [];
                stepMap[s.run_id].push(s);
            }

            // Wave 2 fix #5 (plan: reactive-frolicking-cupcake): storyMap previously only
            // tracked { total, done, verified, running } and conflated done+verified into
            // the `done` counter. Frontend code accessed sp.skipped / sp.failed which came
            // back undefined and broke progress bars. Align the shape with getBatchStoryProgress
            // so both code paths return identical data, and expose hasFailures for the UI.
            const storyMap: Record<string, any> = {};
            for (const s of stories) {
                if (!storyMap[s.run_id]) storyMap[s.run_id] = { total: 0, completed: 0, done: 0, verified: 0, skipped: 0, running: 0, pending: 0, failed: 0 };
                storyMap[s.run_id].total += s.cnt;
                if (s.status === 'verified') { storyMap[s.run_id].verified += s.cnt; storyMap[s.run_id].completed += s.cnt; }
                else if (s.status === 'done') storyMap[s.run_id].done += s.cnt;
                else if (s.status === 'skipped') { storyMap[s.run_id].skipped += s.cnt; storyMap[s.run_id].completed += s.cnt; }
                else if (s.status === 'running') storyMap[s.run_id].running += s.cnt;
                else if (s.status === 'pending') storyMap[s.run_id].pending += s.cnt;
                else if (s.status === 'failed') storyMap[s.run_id].failed += s.cnt;
            }

            for (const r of runs) {
                (r as any).steps = stepMap[r.id] || [];
                const sp = storyMap[r.id] || { total: 0, completed: 0, done: 0, verified: 0, skipped: 0, running: 0, pending: 0, failed: 0 };
                (r as any).storyProgress = sp;
                (r as any).hasFailures = (sp.failed || 0) > 0;
            }
        }
        return runs;
      } catch (e: any) {
        console.error('[getRuns PG error]', e.message);
        // Fall through to HTTP
      }
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
    // Always read from events.jsonl — these are pipeline events (run.started, step.done, story.started)
    // live_events table has agent tool calls (bash, read, write) which are noise
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
    // Use events.jsonl for pipeline agent stats (not live_events which has tool calls)
    {
        try {
            const content = await readFile(EVENTS_PATH, 'utf-8');
            const events = parseEventsFile(content).filter((e: any) => ['step.running','step.done','step.failed','step.timeout'].includes(e.event || e.action));
            const stats: Record<string, any> = {};
            const stepStart: Record<string, string> = {};

            for (const e of events) {
                // Map agentId or stepId to agent name
                const STEP_TO_AGENT: Record<string, string> = {
                    plan: 'planner', design: 'designer', stories: 'planner',
                    'setup-repo': 'setup-repo', 'setup-build': 'setup-build',
                    implement: 'developer', verify: 'reviewer',
                    'security-gate': 'security-gate', 'qa-test': 'qa-tester',
                    'final-test': 'tester', deploy: 'deployer',
                    collect: 'collector', report: 'reporter',
                };
                let rawAgent = e.agentId || e.agent || null;
                if (!rawAgent && e.stepId) rawAgent = STEP_TO_AGENT[e.stepId] || e.stepId;
                const agent = rawAgent ? (rawAgent.includes('/') ? rawAgent.split('/').pop() : rawAgent.includes('_') ? rawAgent.split('_').pop() : rawAgent) : null;
                if (!agent) continue;

                if ((e.event || e.action) === 'step.running') {
                    if (!stats[agent]) stats[agent] = { runs: 0, done: 0, failed: 0, timeout: 0, lastActive: '', durations: [] };
                    stats[agent].runs++;
                    stats[agent].lastActive = e.ts;
                    // Use agent+ts as key for duration tracking
                    const key = agent + ':' + e.ts;
                    stepStart[key] = e.ts;
                }
                if ((e.event || e.action) === 'step.done') {
                    if (!stats[agent]) stats[agent] = { runs: 0, done: 0, failed: 0, timeout: 0, lastActive: '', durations: [] };
                    stats[agent].done++;
                    stats[agent].lastActive = e.ts;
                }
                if ((e.event || e.action) === 'step.failed') {
                    if (!stats[agent]) stats[agent] = { runs: 0, done: 0, failed: 0, timeout: 0, lastActive: '', durations: [] };
                    stats[agent].failed++;
                    stats[agent].lastActive = e.ts;
                }
                if ((e.event || e.action) === 'step.timeout') {
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

            const KNOWN_AGENTS = new Set(['planner','designer','setup','developer','reviewer','security-gate','tester','deployer','collector','reporter','setup-repo','setup-build','qa-tester']);
            return Object.entries(stats)
                .filter(([name]) => KNOWN_AGENTS.has(name))
                .map(([name, s]) => ({
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
    // Use events.jsonl for pipeline alerts (not live_events which has tool calls)
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
