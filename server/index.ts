import express from 'express';
import { readFileSync } from 'fs';
import helmet from 'helmet';
import { createServer } from 'http';
import os from 'os';
import { resolve, join } from 'path';
import { existsSync } from 'fs';
import { config, PATHS } from './config.js';
import { warmupAll } from './utils/cache.js';
import { setupWsProxy } from './ws-proxy.js';
import { assertProjectsJsonLockCapability } from './services/projects-json-repository.js';
import { SingleFlightBackgroundIntervalOwner } from './services/background-interval-owner.js';

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
import kimiQuotaRouter from './routes/kimi-quota.js';
import tasksRouter from './routes/tasks.js';
import approvalsRouter from './routes/approvals.js';
import projectsRouter from "./routes/projects.js";
import setfarmActivityRouter, { syncIncrementalV3ProjectTransfers } from "./routes/setfarm-activity.js";
import officeRouter from "./routes/office.js";
import terminalRouter from "./routes/terminal.js";
import filesRouter from "./routes/files.js";
import prdGeneratorRouter from "./routes/prd-generator.js";
import discordNotifyRouter from "./routes/discord-notify.js";
import scrapeRouter from "./routes/scrape.js";
import rulesRouter from "./routes/rules.js";
import liveFeedRouter from "./routes/live-feed.js";
import telemetryRouter from "./routes/telemetry.js";
import changelogRouter from "./routes/changelog.js";
import changelogPageRouter from "./routes/changelog-page.js";
import setfarmOperationalRouter from "./routes/setfarm-operational.js";
import { authMiddleware } from './middleware/auth.js';
import rateLimit from 'express-rate-limit';

// projects.json writes require Node's kernel-backed SQLite transaction mutex.
// There is deliberately no unsafe PID-file fallback on unsupported runtimes.
assertProjectsJsonLockCapability();

const app = express();
app.use(express.json({ limit: "2mb" }));
// Stitch static files — moved after auth middleware (see below)

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      connectSrc: ["'self'", "ws:", "wss:", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "blob:", "https://cdn.simpleicons.org", "https://*.mzstatic.com", "https://*.googleusercontent.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
    }
  }
}));


// Health check endpoint (before auth)
app.get('/api/health', async (_req, res) => {
  const checks: Record<string, { status: string; detail?: string }> = {};
  
  // 1. Gateway check. Gateway is optional in local Mission Control development;
  // server deployments can attach it for live chat/agent control.
  try {
    const gatewayUrl = config.gatewayWs.replace(/^ws/, 'http').replace(/\/?$/, '/health');
    const gwRes = await fetch(gatewayUrl, { signal: AbortSignal.timeout(2000) });
    checks.gateway = { status: gwRes.ok ? 'up' : 'down', detail: `${gwRes.status}` };
  } catch (e: any) {
    checks.gateway = { status: 'optional', detail: e?.message || 'unreachable' };
  }
  
  // 2. Setfarm DB check
  try {
    const { sql } = await import('./utils/pg.js');
    const rows = await sql`SELECT COUNT(*)::int AS count FROM runs`;
    checks.database = { status: 'up', detail: `${rows[0]?.count || 0} runs` };
  } catch (e: any) { checks.database = { status: 'down', detail: e.message }; }
  
  // 3. Disk space
  try {
    const { execSync } = await import('child_process');
    const df = execSync('df -k /', { timeout: 3000 }).toString().trim().split(/\r?\n/).pop() || '';
    const parts = df.split(/\s+/);
    const pctText = parts[4] || '';
    const pct = parseInt(pctText.replace('%', ''), 10);
    checks.disk = { status: Number.isFinite(pct) && pct < 90 ? 'up' : 'warning', detail: pctText || df };
  } catch { checks.disk = { status: 'unknown' }; }
  
  // 4. Memory
  try {
    const total = os.totalmem();
    const used = total - os.freemem();
    const pct = total > 0 ? Math.round((used / total) * 100) : 0;
    checks.memory = { status: pct < 90 ? 'up' : 'warning', detail: `${pct}%` };
  } catch { checks.memory = { status: 'unknown' }; }
  
  const requiredUp = Object.entries(checks)
    .filter(([name]) => name !== 'gateway')
    .every(([, c]) => c.status !== 'down');
  const gatewayUp = checks.gateway?.status === 'up';
  res.status(requiredUp ? 200 : 503).json({ status: requiredUp && gatewayUp ? 'healthy' : 'degraded', checks, timestamp: new Date().toISOString() });
});

// Public changelog page (no auth — mount BEFORE authMiddleware)
app.use('/', changelogPageRouter);

// Auth middleware
app.use('/api', authMiddleware);
app.use('/stitch-cache', authMiddleware);
app.use('/projects-stitch', authMiddleware);

// Stitch static files (behind auth)
const stitchCacheDir = join(PATHS.setfarmDir, "stitch-cache");
const stitchProjectRoots = [...new Set([
  PATHS.projectsDir,
  process.env.SETFARM_PROJECTS_DIR || "",
  process.env.OPENCLAW_PROJECTS_DIR || "",
].filter(Boolean))];
const stitchStaticOptions = {
  index: false,
  setHeaders: (_res: express.Response, filePath: string) => {
    // Only allow Stitch-related static artifacts.
    if (!filePath.includes('/stitch/') && !filePath.endsWith('.html') && !filePath.endsWith('.png') && !filePath.endsWith('.css')) {
      _res.status(403).end();
    }
  },
};
app.use("/stitch-cache", express.static(stitchCacheDir));
for (const root of stitchProjectRoots) {
  app.use("/projects-stitch", express.static(root, stitchStaticOptions));
}

// Rate limiting
// Mission Control keeps several read-only panels polling while a run page is open.
// Do not count those GET refreshes against the mutation/API abuse limiter; otherwise
// normal dashboard use trips 429s.
app.use('/api', rateLimit({
  windowMs: 60000,
  max: 240,
  standardHeaders: true,
  skip: (req) => req.method === 'GET',
}));
app.use('/api/terminal', rateLimit({ windowMs: 60000, max: 20 }));
app.use('/api/files/write', rateLimit({ windowMs: 60000, max: 30 }));
app.use('/api/files/delete', rateLimit({ windowMs: 60000, max: 10 }));

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
app.use('/api', kimiQuotaRouter);
app.use('/api', tasksRouter);
app.use('/api', approvalsRouter);
app.use("/api", projectsRouter);
app.use("/api", setfarmActivityRouter);
app.use("/api", officeRouter);
app.use("/api", terminalRouter);
app.use("/api", filesRouter);
app.use("/api", discordNotifyRouter);
app.use("/api", prdGeneratorRouter);
app.use("/api", scrapeRouter);
app.use("/api", rulesRouter);
app.use("/api", liveFeedRouter);
app.use("/api", telemetryRouter);
app.use("/api", changelogRouter);
app.use("/api", setfarmOperationalRouter);

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
    try {
      let html = readFileSync(join(distDir, 'index.html'), 'utf-8');
      if (config.authToken) {
        html = html.replace('</head>', `<meta name="mc-token" content="${config.authToken}"></head>`);
      }
      res.type('html').send(html);
    } catch {
      res.sendFile(join(distDir, 'index.html'));
    }
  });
}

// Global error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const server = createServer(app);
setupWsProxy(server);
const v3ProjectTransferOwner = new SingleFlightBackgroundIntervalOwner({
  intervalMs: 30_000,
  async run() {
    const result = await syncIncrementalV3ProjectTransfers();
    if (result.skipped.length > 0) {
      console.warn(`[MC] v3 project transfer skipped ${result.skipped.length} run(s)`);
    }
  },
  onError(error) {
    console.error('[MC] v3 project transfer background tick failed:', error);
  },
});

server.listen(config.port, config.host, () => {
  const displayHost = config.host === '0.0.0.0' ? 'localhost' : config.host;
  const displayUrl = config.publicOrigin || `http://${displayHost}:${config.port}`;
  console.log(`Mission Control running on ${displayUrl}`);
  v3ProjectTransferOwner.start();
  // Pre-warm cache so first request is instant
  warmupAll().then(() => console.log('Cache pre-warmed')).catch(() => {});
});

// Unhandled rejection handler
process.on('unhandledRejection', (reason) => {
  console.error('[MC] Unhandled rejection:', reason);
});

// Graceful shutdown — release port on SIGTERM/SIGINT
let shutdownStarted = false;
function shutdown(signal: string) {
  if (shutdownStarted) return;
  shutdownStarted = true;
  console.log(`[${signal}] Shutting down gracefully...`);
  const serverClosed = new Promise<void>((resolve) => {
    server.close(() => {
      console.log('Server closed');
      resolve();
    });
  });
  void Promise.allSettled([serverClosed, v3ProjectTransferOwner.stop()])
    .then(() => process.exit(0));
  // Force exit after 5s if connections hang
  setTimeout(() => {
    console.warn('Forced exit after timeout');
    process.exit(1);
  }, 5000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
