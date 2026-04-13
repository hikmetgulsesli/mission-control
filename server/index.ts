import express from 'express';
import { readFileSync } from 'fs';
import helmet from 'helmet';
import { homedir } from 'os';
import { createServer } from 'http';
import { resolve, join } from 'path';
import { existsSync } from 'fs';
import { config } from './config.js';
import { warmupAll } from './utils/cache.js';
import { setupWsProxy } from './ws-proxy.js';
import { getStuckRuns, unstickRun, diagnoseStuckStep, tryAutoFix, skipStory, getLimboRuns, resumeLimboRun, detectInfiniteLoop, checkMissingInput, failEntireRun, STUCK_THRESHOLD_MS, MAX_AUTO_UNSTICK } from './utils/setfarm-db.js';

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
import setfarmActivityRouter from "./routes/setfarm-activity.js";
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
import { authMiddleware } from './middleware/auth.js';
import rateLimit from 'express-rate-limit';

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
  
  // 1. Gateway check
  try {
    const gwRes = await fetch(config.gatewayWs.replace('ws', 'http').replace(':18789', ':18789'));
    checks.gateway = { status: 'up' };
  } catch {
    try {
      const { execSync } = await import('child_process');
      const result = execSync('systemctl --user is-active openclaw-gateway', { timeout: 3000 }).toString().trim();
      checks.gateway = { status: result === 'active' ? 'up' : 'down', detail: result };
    } catch { checks.gateway = { status: 'down' }; }
  }
  
  // 2. Setfarm DB check
  try {
    const { execSync } = await import('child_process');
    const usePg = true; // Faz7: PG-only
    let result: string;
    if (usePg) {
      result = execSync('psql -h localhost -U setrox -d setfarm -t -c "SELECT COUNT(*) FROM runs"', { timeout: 3000 }).toString().trim();
    } else {
      const dbPath = join(homedir(), '.openclaw', 'setfarm', 'setfarm.db');
      result = execSync(`sqlite3 "${dbPath}" "SELECT COUNT(*) FROM runs"`, { timeout: 3000 }).toString().trim();
    }
    checks.database = { status: 'up', detail: `${result} runs` };
  } catch (e: any) { checks.database = { status: 'down', detail: e.message }; }
  
  // 3. Disk space
  try {
    const { execSync } = await import('child_process');
    const df = execSync('df -h / --output=pcent | tail -1', { timeout: 3000 }).toString().trim();
    const pct = parseInt(df);
    checks.disk = { status: pct < 90 ? 'up' : 'warning', detail: df };
  } catch { checks.disk = { status: 'unknown' }; }
  
  // 4. Memory
  try {
    const { execSync } = await import('child_process');
    const mem = execSync("free -m | awk '/Mem:/{printf \"%.0f%%\", $3/$2*100}'", { timeout: 3000 }).toString().trim();
    checks.memory = { status: 'up', detail: mem };
  } catch { checks.memory = { status: 'unknown' }; }
  
  const allUp = Object.values(checks).every(c => c.status !== 'down');
  res.status(allUp ? 200 : 503).json({ status: allUp ? 'healthy' : 'degraded', checks, timestamp: new Date().toISOString() });
});

// Auth middleware
app.use('/api', authMiddleware);
app.use('/stitch-cache', authMiddleware);
app.use('/projects-stitch', authMiddleware);

// Stitch static files (behind auth)
const stitchCacheDir = join(homedir(), ".openclaw", "setfarm", "stitch-cache");
app.use("/stitch-cache", express.static(stitchCacheDir));
app.use("/projects-stitch", express.static("/home/setrox/projects", {
  index: false,
  setHeaders: (_res, filePath) => {
    // Only allow stitch-related files
    if (!filePath.includes('/stitch/') && !filePath.endsWith('.html') && !filePath.endsWith('.png') && !filePath.endsWith('.css')) {
      _res.status(403).end();
    }
  },
}));

// Rate limiting
app.use('/api', rateLimit({ windowMs: 60000, max: 200, standardHeaders: true }));
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

server.listen(config.port, '127.0.0.1', () => {
  console.log(`Mission Control running on http://127.0.0.1:${config.port}`);
  // Pre-warm cache so first request is instant
  warmupAll().then(() => console.log('Cache pre-warmed')).catch(() => {});
});

// Medic cron v4: diagnose -> LOOP CHECK -> MISSING CHECK -> auto-fix -> unstick
const MEDIC_INTERVAL_MS = 5 * 60 * 1000;
// P1-07: MC medic disabled — all stuck detection delegated to Setfarm medic
const MC_MEDIC_DISABLED = true;
if (!MC_MEDIC_DISABLED) setInterval(async () => {
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
          if (fixResult.success) continue;
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
  } catch (err: any) {
    console.error('[MEDIC] Stuck check failed:', err.message);
  }
}, MEDIC_INTERVAL_MS);



// Unhandled rejection handler
process.on('unhandledRejection', (reason) => {
  console.error('[MC] Unhandled rejection:', reason);
});

// Graceful shutdown — release port on SIGTERM/SIGINT
function shutdown(signal: string) {
  console.log(`[${signal}] Shutting down gracefully...`);
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
  // Force exit after 5s if connections hang
  setTimeout(() => {
    console.warn('Forced exit after timeout');
    process.exit(1);
  }, 5000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
