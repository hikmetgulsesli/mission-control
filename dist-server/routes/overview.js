import { Router } from 'express';
import { readFileSync } from 'fs';
import { config } from '../config.js';
import { cached, registerWarmup } from '../utils/cache.js';
import { runCliJson } from '../utils/cli.js';
import { getSystemMetrics } from '../utils/prometheus.js';
import { getRuns } from '../utils/antfarm.js';
const router = Router();
const REAL_AGENTS = ['main', 'koda', 'kaan', 'atlas', 'defne', 'sinan', 'elif', 'deniz', 'onur', 'mert'];
// Cache fetchers (reusable for warmup + requests)
const fetchAgents = () => runCliJson('openclaw', ['agents', 'list', '--json']);
const fetchCrons = () => runCliJson('openclaw', ['cron', 'list', '--json']);
const fetchSystem = () => getSystemMetrics();
const fetchRuns = () => getRuns();
const fetchData = async () => {
    const raw = readFileSync(config.dataJson, 'utf-8');
    return JSON.parse(raw);
};
// TTLs: CLI commands (slow) get longer TTL, fast sources shorter
const CLI_TTL = 60000; // 60s for CLI (agents, crons)
const FAST_TTL = 15000; // 15s for prometheus, antfarm, file
// Pre-warm cache on startup
registerWarmup(async () => {
    await Promise.allSettled([
        cached('agents', CLI_TTL, fetchAgents),
        cached('cronlist', CLI_TTL, fetchCrons),
        cached('system', FAST_TTL, fetchSystem),
        cached('runs', FAST_TTL, fetchRuns),
        cached('datafile', FAST_TTL, fetchData),
    ]);
});
router.get('/overview', async (_req, res) => {
    try {
        const [agents, system, runs, dataFile, cronList] = await Promise.allSettled([
            cached('agents', CLI_TTL, fetchAgents),
            cached('system', FAST_TTL, fetchSystem),
            cached('runs', FAST_TTL, fetchRuns),
            cached('datafile', FAST_TTL, fetchData),
            cached('cronlist', CLI_TTL, fetchCrons),
        ]);
        const agentList = agents.status === 'fulfilled'
            ? (Array.isArray(agents.value) ? agents.value : agents.value?.agents || []).filter((a) => REAL_AGENTS.includes(a.id))
            : [];
        const runList = runs.status === 'fulfilled' ? runs.value : [];
        const activeRuns = runList
            .filter((r) => r.status === 'running' || r.status === 'pending')
            .map((r) => {
            const steps = r.steps || [];
            const pendingStep = steps.find((s) => s.status === 'pending');
            const runningStep = steps.find((s) => s.status === 'running');
            return {
                id: r.id,
                workflow: r.workflow_id,
                status: r.status,
                currentStep: runningStep?.step_id || pendingStep?.step_id || null,
                task: r.task,
                startedAt: r.created_at ? new Date(r.created_at).getTime() : undefined,
            };
        });
        const data = dataFile.status === 'fulfilled' ? dataFile.value : {};
        const cronJobs = data.crons || [];
        const activeCrons = Array.isArray(cronJobs) ? cronJobs.filter((c) => c.enabled !== false).length : 0;
        const crons = cronList.status === 'fulfilled'
            ? ((Array.isArray(cronList.value) ? cronList.value : cronList.value?.jobs) || []).map((c) => ({
                id: c.id,
                name: c.name,
                status: c.state?.lastStatus || 'idle',
                lastRunAt: c.state?.lastRunAtMs || null,
                nextRunAt: c.state?.nextRunAtMs || null,
                lastDuration: c.state?.lastDurationMs || null,
                lastError: c.state?.lastError || null,
            }))
            : [];
        const sessions = data.sessions || [];
        const activeSessions = sessions.filter((s) => {
            const agentId = s.agent || s.key?.split(':')?.[1];
            return REAL_AGENTS.includes(agentId);
        });
        const agentLastActive = {};
        for (const s of sessions) {
            const agentId = s.agent || s.key?.split(':')?.[1];
            if (!agentId)
                continue;
            const ts = s.updatedAt || s.lastActivity ? new Date(s.lastActivity || s.updatedAt).getTime() : 0;
            if (ts > (agentLastActive[agentId] || 0)) {
                agentLastActive[agentId] = ts;
            }
        }
        res.json({
            agents: agentList,
            agentCount: agentList.length,
            activeRuns,
            activeRunCount: activeRuns.length,
            cronCount: activeCrons,
            crons,
            costToday: data.totalCostToday || 0,
            costAllTime: data.totalCostAllTime || 0,
            system: system.status === 'fulfilled' ? system.value : null,
            gateway: data.gateway || null,
            sessions: activeSessions.slice(0, 20),
            agentLastActive,
            alerts: data.alerts || [],
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
export default router;
