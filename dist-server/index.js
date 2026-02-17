import express from 'express';
import { createServer } from 'http';
import { resolve, join } from 'path';
import { existsSync } from 'fs';
import { config } from './config.js';
import { warmupAll } from './utils/cache.js';
import { setupWsProxy } from './ws-proxy.js';
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
import antfarmActivityRouter from "./routes/antfarm-activity.js";
import officeRouter from "./routes/office.js";
import terminalRouter from "./routes/terminal.js";
import filesRouter from "./routes/files.js";
import discordNotifyRouter from "./routes/discord-notify.js";
const app = express();
app.use(express.json({ limit: "2mb" }));
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
app.use("/api", antfarmActivityRouter);
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
const server = createServer(app);
setupWsProxy(server);
server.listen(config.port, '127.0.0.1', () => {
    console.log(`Mission Control running on http://127.0.0.1:${config.port}`);
    // Pre-warm cache so first request is instant
    warmupAll().then(() => console.log('Cache pre-warmed')).catch(() => { });
});
