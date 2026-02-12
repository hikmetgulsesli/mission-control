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

const app = express();
app.use(express.json());

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
  app.use(express.static(distDir));
  app.get('/{*splat}', (_req, res) => {
    res.sendFile(join(distDir, 'index.html'));
  });
}

const server = createServer(app);
setupWsProxy(server);

server.listen(config.port, '127.0.0.1', () => {
  console.log(`Mission Control running on http://127.0.0.1:${config.port}`);
  // Pre-warm cache so first request is instant
  warmupAll().then(() => console.log('Cache pre-warmed')).catch(() => {});
});
