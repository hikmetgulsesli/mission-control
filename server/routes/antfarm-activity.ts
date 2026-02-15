import { Router } from 'express';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { cached } from '../utils/cache.js';
import { createProjectProgrammatic, updateProjectById } from './projects.js';
import { getRuns, getRunStories, getAntfarmActivity, getAntfarmAgentStats, getAntfarmAlerts, getStories } from '../utils/antfarm.js';

const router = Router();

// Recent activity events (last 50, reverse chronological)
router.get('/antfarm/activity', async (_req, res) => {
  try {
    const limit = Math.min(parseInt(_req.query.limit as string) || 50, 200);
    const data = await cached(`af-activity-${limit}`, 10_000, () => getAntfarmActivity(limit));
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Activity fetch failed' });
  }
});

// Workflow agent statistics
router.get('/antfarm/agents', async (_req, res) => {
  try {
    const data = await cached('af-agents', 30_000, getAntfarmAgentStats);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Agent stats failed' });
  }
});

// Alerts: timeout + failed + abandoned
router.get('/antfarm/alerts', async (_req, res) => {
  try {
    const data = await cached('af-alerts', 15_000, getAntfarmAlerts);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Alerts fetch failed' });
  }
});

// Active run pipeline state
router.get('/antfarm/pipeline', async (_req, res) => {
  try {
    const data = await cached('af-pipeline', 10_000, async () => {
      const allRuns = (await getRuns()) as any[];
      const running = allRuns.filter((r: any) => r.status === 'running');
      const recent = allRuns
        .filter((r: any) => r.status !== 'running')
        .sort((a: any, b: any) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        .slice(0, 3);
      // Auto-sync: check for newly completed runs
      const completedIds = new Set(allRuns.filter((r: any) => r.status === 'completed').map((r: any) => r.id));
      const newlyCompleted = [...completedIds].filter(id => !lastSeenCompletedIds.has(id));
      if (newlyCompleted.length > 0 && lastSeenCompletedIds.size > 0) {
        syncProjectsFromRuns().catch(() => {});
      }
      lastSeenCompletedIds = completedIds;

      return Promise.all([...running, ...recent].map(async (r: any) => {
        let storyProgress = { completed: 0, total: 0 };
        try {
          const stories = await getRunStories(r.id);
          if (stories && stories.length > 0) {
            const done = stories.filter((s: any) => s.status === 'done').length;
            storyProgress = { completed: done, total: stories.length };
          }
        } catch {}
        return {
          id: r.id,
          workflow: r.workflow_id,
          task: r.task,
          status: r.status,
          updatedAt: r.updated_at,
          createdAt: r.created_at,
          steps: (r.steps || []).map((s: any) => ({
            stepId: s.step_id,
            agent: s.agent_id,
            status: s.status,
            retryCount: s.retry_count || 0,
            type: s.type,
            currentStoryId: s.current_story_id,
            abandonedCount: s.abandoned_count || 0,
          })),
          storyProgress,
        };
      }));
    });
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Pipeline fetch failed' });
  }
});

// GET /antfarm/runs/:id/stories — Stories for a specific run
router.get('/antfarm/runs/:id/stories', async (req, res) => {
  try {
    const stories = await getRunStories(req.params.id);
    res.json(stories || []);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Stories fetch failed' });
  }
});

// GET /antfarm/runs/:id/plan — PRD/Plan document for a run
router.get('/antfarm/runs/:id/plan', async (req, res) => {
  try {
    const allRuns = (await getRuns()) as any[];
    const run = allRuns.find((r: any) => r.id === req.params.id);
    if (!run) { res.status(404).json({ error: 'Run not found' }); return; }

    const planStep = (run.steps || []).find((s: any) => s.step_id === 'plan' && s.status === 'done');
    if (!planStep || !planStep.output) {
      res.json({ prd: '', stories: [], rawOutput: '' });
      return;
    }

    const rawOutput = planStep.output;
    let prd = rawOutput;
    let stories: any[] = [];

    // Parse STORIES_JSON marker
    const marker = 'STORIES_JSON:';
    const idx = rawOutput.indexOf(marker);
    if (idx !== -1) {
      prd = rawOutput.slice(0, idx).trim();
      const jsonPart = rawOutput.slice(idx + marker.length).trim();
      try { stories = JSON.parse(jsonPart); } catch {}
    }

    // Fallback: try to get stories from API
    if (stories.length === 0) {
      try {
        const runStories = await getRunStories(req.params.id);
        if (runStories && runStories.length > 0) stories = runStories;
      } catch {}
    }

    res.json({ prd, stories, rawOutput });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Plan fetch failed' });
  }
});


// Track last seen completed run IDs for auto-sync
let lastSeenCompletedIds = new Set<string>();

function extractProjectName(task: string): string {
  const firstLine = task.split('\n')[0].replace(/^#+\s*/, '').trim();
  const buildMatch = firstLine.match(/(?:Build|Create|Implement|Add|Make|Develop)\s+(?:a\s+)?(.+?)(?:\s+(?:web\s+)?(?:app(?:lication)?|project|service|tool|system|api|dashboard|page|site|feature))?\s*\.?$/i);
  if (buildMatch) return buildMatch[1].trim();
  return firstLine.replace(/\.$/, '').slice(0, 60);
}

function detectStack(repo: string): string[] {
  try {
    const pkgPath = join(repo, 'package.json');
    if (!existsSync(pkgPath)) return [];
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    const stack: string[] = [];
    if (deps['react']) stack.push('React');
    if (deps['vue']) stack.push('Vue');
    if (deps['next']) stack.push('Next.js');
    if (deps['express']) stack.push('Express');
    if (deps['vite']) stack.push('Vite');
    if (deps['typescript'] || deps['ts-node']) stack.push('TypeScript');
    if (deps['tailwindcss']) stack.push('Tailwind CSS');
    return stack;
  } catch {
    return [];
  }
}


const TUNNEL_ID = '92d8df83-3623-4850-ba41-29126106d020';

function detectPort(repo: string, task: string): number | null {
  try {
    const vitePath = join(repo, 'vite.config.ts');
    if (existsSync(vitePath)) {
      const vite = readFileSync(vitePath, 'utf-8');
      const m = vite.match(/port\s*:\s*(\d+)/);
      if (m) return parseInt(m[1]);
    }
  } catch {}
  const taskMatch = task.match(/[Pp]ort\s*:\s*(\d+)/);
  if (taskMatch) return parseInt(taskMatch[1]);
  return null;
}

function detectStartCmd(repo: string, port: number): string | null {
  const SERVE_BIN = '/home/setrox/.npm-global/bin/serve';
  try {
    const pkg = JSON.parse(readFileSync(join(repo, 'package.json'), 'utf-8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    // Static SPA (Vite/React/Vue) — use serve for zero node_modules dependency
    if (existsSync(join(repo, 'dist', 'index.html'))) {
      return `${SERVE_BIN} dist -l ${port} -s`;
    }
    // Next.js
    if (deps['next'] && existsSync(join(repo, '.next'))) {
      return `/usr/bin/npx next start -p ${port}`;
    }
    // Express / generic Node with start script
    if (pkg.scripts?.start) return `/usr/bin/npm start`;
  } catch {}
  return null;
}

function patchVitePreview(repo: string, port: number): void {
  const vitePath = join(repo, 'vite.config.ts');
  if (!existsSync(vitePath)) return;
  let vite = readFileSync(vitePath, 'utf-8');
  if (vite.includes('preview:') || vite.includes('allowedHosts')) return;
  // Add preview block before server block
  vite = vite.replace(
    /(\s+server\s*:\s*\{)/,
    `  preview: {\n    port: ${port},\n    host: true,\n    allowedHosts: true,\n  },\n$1`
  );
  writeFileSync(vitePath, vite);
}

function autoDeployProject(projectId: string, projectName: string, repo: string, task: string): { deployed: boolean; port?: number; domain?: string; service?: string; error?: string } {
  if (!repo || !existsSync(repo)) return { deployed: false, error: 'no repo' };

  const port = detectPort(repo, task);
  if (!port) return { deployed: false, error: 'no port detected' };

  const startCmd = detectStartCmd(repo, port);
  if (!startCmd) return { deployed: false, error: 'no start command' };

  const serviceName = projectId + '.service';
  const domain = projectId + '.setrox.com.tr';

  try {
    const unit = [
      '[Unit]',
      `Description=${projectName} (Auto-deployed)`,
      'After=network.target',
      'StartLimitBurst=5',
      'StartLimitIntervalSec=60',
      '',
      '[Service]',
      'Type=simple',
      'User=setrox',
      `WorkingDirectory=${repo}`,
      `ExecStart=${startCmd}`,
      'Restart=on-failure',
      'RestartSec=5',
      'Environment=NODE_ENV=production',
      `Environment=PORT=${port}`,
      '',
      '[Install]',
      'WantedBy=multi-user.target',
    ].join('\n');

    writeFileSync('/tmp/' + serviceName, unit);
    execSync(`sudo cp /tmp/${serviceName} /etc/systemd/system/${serviceName}`, { timeout: 5000 });
    execSync('sudo systemctl daemon-reload', { timeout: 5000 });
    // Kill any dev server (vite, webpack, etc.) occupying the port
    try { execSync(`fuser -k ${port}/tcp 2>/dev/null || true`, { timeout: 5000 }); } catch {}
    execSync(`sudo systemctl enable --now ${serviceName}`, { timeout: 10000 });

    // Add to Cloudflare tunnel
    try {
      const cfgPath = '/etc/cloudflared/config.yml';
      const cfg = readFileSync(cfgPath, 'utf-8');
      if (!cfg.includes(domain)) {
        const entry = `  - hostname: ${domain}\n    service: http://127.0.0.1:${port}\n`;
        const updated = cfg.replace('  - service: http_status:404', entry + '  - service: http_status:404');
        writeFileSync('/tmp/cloudflared-config.yml', updated);
        execSync(`sudo cp /tmp/cloudflared-config.yml ${cfgPath}`, { timeout: 5000 });
        execSync('sudo systemctl restart cloudflared', { timeout: 15000 });
        execSync(`sudo cloudflared tunnel route dns ${TUNNEL_ID} ${domain}`, { timeout: 15000 });
      }
    } catch (err: any) {
      console.error('Tunnel setup warning:', err.message);
    }

    return { deployed: true, port, domain, service: serviceName };
  } catch (err: any) {
    return { deployed: false, error: err.message };
  }
}

async function syncProjectsFromRuns(): Promise<{ synced: any[]; skipped: string[] }> {
  const allRuns = (await getRuns()) as any[];
  const completed = allRuns.filter((r: any) => r.status === 'completed');
  const synced: any[] = [];
  const skipped: string[] = [];

  for (const run of completed) {
    if (!run.task) { skipped.push(run.id + ': no task'); continue; }

    const name = extractProjectName(run.task);
    if (!name || name.length < 2) { skipped.push(run.id + ': name too short'); continue; }

    let repo = '';
    try {
      const ctx = typeof run.context === 'string' ? JSON.parse(run.context) : run.context;
      repo = ctx?.repo || '';
    } catch {}

    const stack = repo ? detectStack(repo) : [];

    const result = createProjectProgrammatic({
      name,
      repo,
      stack,
      emoji: '\u{1F527}',
      createdBy: 'antfarm-workflow',
      antfarmRunId: run.id,
      task: run.task.split('\n').slice(0, 3).join(' ').slice(0, 200),
    });

    const needsDeploy = result.created || (result.reason === 'exists' && !result.project?.service);
    if (needsDeploy && repo) {
      const deploy = autoDeployProject(result.project.id, result.project.name, repo, run.task);
      if (deploy.deployed) {
        updateProjectById(result.project.id, {
          ports: { frontend: deploy.port },
          domain: deploy.domain,
          service: deploy.service,
          serviceStatus: 'active',
          repo,
          stack,
        });
        result.project.deployed = true;
        result.project.port = deploy.port;
        result.project.domain = deploy.domain;
      } else {
        result.project.deployed = false;
        result.project.deployError = deploy.error;
      }
    }
    if (result.created) {
      synced.push(result.project);
    } else {
      skipped.push(run.id + ': exists' + (needsDeploy ? ' (deploy retried)' : ''));
    }
  }

  return { synced, skipped };
}

// POST /antfarm/sync-projects - manual trigger
router.post('/antfarm/sync-projects', async (_req, res) => {
  try {
    const result = await syncProjectsFromRuns();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Sync failed' });
  }
});

export default router;
