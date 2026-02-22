import express from 'express';
import helmet from 'helmet';
import { createServer } from 'http';
import { resolve, join } from 'path';
import { existsSync } from 'fs';
import { config } from './config.js';
import { warmupAll } from './utils/cache.js';
import { setupWsProxy } from './ws-proxy.js';
import { getStuckRuns, unstickRun, diagnoseStuckStep, tryAutoFix, getLimboRuns, resumeLimboRun, detectInfiniteLoop, checkMissingInput, failEntireRun, STUCK_THRESHOLD_MS } from './utils/setfarm-db.js';
import overviewRouter from './routes/overview.js';
import agentsRouter from './routes/agents.js';
import sessionsRouter from './routes/sessions.js';
import cronRouter from './routes/cron.js';
import workflowsRouter from './routes/workflows.js';
import runsRouter from './routes/runs.js';
import systemRouter from './routes/system.js';
import costsRouter from './routes/costs.js';
import notificationsRouter from './routes/notifications.js';
import performanceRouter from './routes/performance.js';
import modelLimitsRouter from './routes/model-limits.js';
import quotaRouter from './routes/quota.js';
import tasksRouter from './routes/tasks.js';
import approvalsRouter from './routes/approvals.js';
import projectsRouter from "./routes/projects.js";
import setfarmActivityRouter from "./routes/setfarm-activity.js";
import officeRouter from "./routes/office.js";
import terminalRouter from "./routes/terminal.js";
import filesRouter from "./routes/files.js";
import discordNotifyRouter from "./routes/discord-notify.js";
const app = express();
app.use(express.json({ limit: "2mb" }));
app.use(helmet({ contentSecurityPolicy: false }));
// API routes
app.use('/api', overviewRouter);
app.use('/api', agentsRouter);
app.use('/api', sessionsRouter);
app.use('/api', cronRouter);
app.use('/api', workflowsRouter);
app.use('/api', runsRouter);
app.use('/api', systemRouter);
app.use('/api', costsRouter);
app.use('/api', notificationsRouter);
app.use('/api', performanceRouter);
app.use('/api', modelLimitsRouter);
app.use('/api', quotaRouter);
app.use('/api', tasksRouter);
app.use('/api', approvalsRouter);
app.use("/api", projectsRouter);
app.use("/api", setfarmActivityRouter);
app.use("/api", officeRouter);
app.use("/api", terminalRouter);
app.use("/api", filesRouter);
app.use("/api", discordNotifyRouter);
// Serve avatars
if (existsSync(config.avatarsDir)) {
    app.use('/avatars', express.static(config.avatarsDir));
}
// Serve uploads (task images)
const uploadsDir = resolve(import.meta.dirname || __dirname, '..', 'uploads');
app.use('/uploads', express.static(uploadsDir));
// API 404 handler - must be before SPA catch-all
app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
});
// Serve built frontend
const distDir = resolve(import.meta.dirname || __dirname, '..', 'dist');
if (existsSync(distDir)) {
    // Hashed assets get long cache, HTML always fresh
    app.use('/assets', express.static(join(distDir, 'assets'), { maxAge: '1y', immutable: true }));
    app.use(express.static(distDir, {
        maxAge: 0,
        etag: false,
        setHeaders: (res, filePath) => {
            if (filePath.endsWith('.html')) {
                res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
                res.set('Pragma', 'no-cache');
            }
        },
    }));
    app.get('/{*splat}', (_req, res) => {
        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
        res.sendFile(join(distDir, 'index.html'));
    });
}
// Global error handler
app.use((err, _req, res, _next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});
const server = createServer(app);
setupWsProxy(server);
server.listen(config.port, '127.0.0.1', () => {
    console.log(`Mission Control running on http://127.0.0.1:${config.port}`);
    // Pre-warm cache so first request is instant
    warmupAll().then(() => console.log('Cache pre-warmed')).catch(() => { });
});
// Medic cron v4: diagnose -> LOOP CHECK -> MISSING CHECK -> auto-fix -> unstick
const MEDIC_INTERVAL_MS = 5 * 60 * 1000;
setInterval(async () => {
    try {
        const stuckRuns = await getStuckRuns(STUCK_THRESHOLD_MS);
        for (const run of stuckRuns) {
            // A) Check for infinite loop (claim count >= 5)
            const loopCheck = await detectInfiniteLoop(run.id);
            if (loopCheck.isLooping) {
                console.warn(`[MEDIC] INFINITE LOOP detected: run=${run.id} step=${loopCheck.stepName} claims=${loopCheck.claimCount}`);
                await failEntireRun(run.id, `Infinite loop: ${loopCheck.reason}`);
                continue; // Skip to next run, this one is dead
            }
            // B) Check for missing input variables ([missing: X])
            const missingCheck = await checkMissingInput(run.id);
            if (missingCheck.hasMissing) {
                console.warn(`[MEDIC] MISSING INPUT detected: run=${run.id} step=${missingCheck.stepName} var=${missingCheck.missingVar}`);
                await failEntireRun(run.id, `Missing input: ${missingCheck.reason}`);
                continue; // Skip to next run
            }
            for (const step of run.stuckSteps) {
                // C) Diagnose and auto-fix (existing logic)
                const diagnosis = await diagnoseStuckStep(run.id, step.id);
                console.warn(`[MEDIC] Diagnosed: run=${run.id} step=${step.name} cause=${diagnosis.cause} fixable=${diagnosis.fixable} retries=${step.abandonResets}`);
                if (diagnosis.fixable) {
                    const fixResult = await tryAutoFix(run.id, diagnosis.cause, diagnosis.storyId);
                    console.warn(`[MEDIC] Auto-fix ${diagnosis.cause}: ${fixResult.success ? 'OK' : 'FAILED'} - ${fixResult.message}`);
                    if (fixResult.success)
                        continue;
                }
                // D) Unstick and retry
                console.warn(`[MEDIC] Auto-unstick: run=${run.id} step=${step.name} stuck=${step.stuckMinutes}min retries=${step.abandonResets} cause=${diagnosis.cause}`);
                await unstickRun(run.id, step.id);
            }
        }
        // E) Check for limbo runs: running but no active steps
        const limboRuns = await getLimboRuns();
        for (const limbo of limboRuns) {
            console.warn(`[MEDIC] Limbo run detected: ${limbo.run_id} (${limbo.done_steps} done, ${limbo.failed_steps} failed, 0 running) - auto-resuming from ${limbo.first_failed_step}`);
            const result = await resumeLimboRun(limbo.run_id);
            console.warn(`[MEDIC] Limbo resume: ${result.success ? 'OK' : 'FAILED'} - ${result.message}`);
        }
    }
    catch (err) {
        console.error('[MEDIC] Stuck check failed:', err.message);
    }
}, MEDIC_INTERVAL_MS);
