import { Router } from 'express';
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';
import { execSync, execFileSync } from 'child_process';
import { cached } from '../utils/cache.js';
import { PATHS } from '../config.js';
import { readFileSync as readSync, writeFileSync as writeSync, renameSync } from 'fs';
import { tmpdir } from 'os';
import { createProjectProgrammatic, updateProjectById } from './projects.js';
import { getRuns, getRunStories, getSetfarmActivity, getSetfarmAgentStats, getSetfarmAlerts, getStories } from '../utils/setfarm.js';
import { ensureAgentFeedTable, insertFeedEntry, getAgentFeed as getAgentFeedFromDb, pruneAgentFeed, clearAgentFeed } from "../utils/setfarm-db.js";

// ── Service imports (extracted from this file) ──────────────────────
import {
  autoDeployProject,
  detectPort,
  detectStartCmd,
  detectBackend,
  detectStack,
  runBuild,
  healthCheck,
  findExistingService,
  slugify,
  allocatePort,
  updatePortRegistry,
} from '../services/auto-deploy.js';

import { getAgentFeed as getAgentFeedService } from '../services/agent-feed.js';

/** Detect if a task describes a mobile app */
function isMobileProject(task: string, repo: string): boolean {
  const mobileKeywords = [
    'react native', 'expo', 'mobil uygulama', 'mobile app',
    'android', 'ios app', 'flutter', 'swift', 'kotlin'
  ];
  const lower = (task + ' ' + repo).toLowerCase();
  if (repo && repo.includes('/mobile/')) return true;
  return mobileKeywords.some(kw => lower.includes(kw));
}

let syncInProgress = false;
const router = Router();

// Recent activity events (last 50, reverse chronological)
router.get('/setfarm/activity', async (_req, res) => {
  try {
    const limit = Math.min(parseInt(_req.query.limit as string) || 50, 200);
    const data = await cached(`af-activity-${limit}`, 10_000, () => getSetfarmActivity(limit));
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Activity fetch failed' });
  }
});

// Workflow agent statistics
router.get('/setfarm/agents', async (_req, res) => {
  try {
    const data = await cached('af-agents', 30_000, getSetfarmAgentStats);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Agent stats failed' });
  }
});

// Alerts: timeout + failed + abandoned
router.get('/setfarm/alerts', async (_req, res) => {
  try {
    const data = await cached('af-alerts', 15_000, getSetfarmAlerts);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Alerts fetch failed' });
  }
});

// Active run pipeline state
router.get('/setfarm/pipeline', async (_req, res) => {
  try {
    const data = await cached('af-pipeline', 10_000, async () => {
      const allRuns = (await getRuns()) as any[];
      const running = allRuns.filter((r: any) => r.status === 'running');
      const recent = allRuns
        .filter((r: any) => r.status !== 'running' && r.workflow_id !== 'daily-standup')
        .sort((a: any, b: any) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        .slice(0, 20);
      // Auto-sync: check for newly finished runs (completed, failed, cancelled)
      const finishedIds = new Set(allRuns.filter((r: any) => r.status !== 'running' && r.status !== 'pending').map((r: any) => r.id));
      const newlyFinished = [...finishedIds].filter(id => !lastSeenFinishedIds.has(id));
      if (newlyFinished.length > 0 && lastSeenFinishedIds.size > 0) {
        if (!syncInProgress) { syncInProgress = true; syncProjectsFromRuns().catch(() => {}).finally(() => { syncInProgress = false; }); }
      }
      lastSeenFinishedIds = finishedIds;

      // Auto-create: detect newly started runs and create 'building' project cards
      const runningIds = new Set(running.map((r: any) => r.id));
      const newlyStarted = running.filter((r: any) => !lastSeenRunningIds.has(r.id));
      if (newlyStarted.length > 0 && lastSeenRunningIds.size > 0) {
        for (const run of newlyStarted) {
          createBuildingProject(run).catch(() => {});
        }
      }
      lastSeenRunningIds = runningIds;
      saveSyncState(lastSeenFinishedIds, lastSeenRunningIds);

      return Promise.all([...running, ...recent].map(async (r: any) => {
        let storyProgress: any = { completed: 0, total: 0, verified: 0, skipped: 0, running: 0, pending: 0, done: 0 };
        try {
          const stories = await getRunStories(r.id);
          if (stories && stories.length > 0) {
            const done = r.status === 'completed' ? stories.length : stories.filter((s: any) => ['done', 'verified', 'skipped'].includes(s.status)).length;
            const v = stories.filter((s: any) => s.status === "verified").length;
            const sk = stories.filter((s: any) => s.status === "skipped").length;
            const ru = stories.filter((s: any) => s.status === "running").length;
            const pe = stories.filter((s: any) => s.status === "pending").length;
            const dn = stories.filter((s: any) => s.status === "done").length;
            storyProgress = { completed: done, total: stories.length, verified: v, skipped: sk, running: ru, pending: pe, done: dn };
          }
        } catch (e: any) { console.warn('getRunStories failed:', e?.message || e); }
        return {
          id: r.id,
          runNumber: r.run_number,
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

// GET /setfarm/runs/:id/stories — Stories for a specific run
router.get('/setfarm/runs/:id/stories', async (req, res) => {
  try {
    const stories = await getRunStories(req.params.id);
    res.json(stories || []);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Stories fetch failed' });
  }
});

// GET /setfarm/runs/:id/plan — PRD/Plan document for a run
router.get('/setfarm/runs/:id/plan', async (req, res) => {
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
      try { stories = JSON.parse(jsonPart); } catch { /* malformed STORIES_JSON */ }
    }

    // Fallback: try to get stories from API
    if (stories.length === 0) {
      try {
        const runStories = await getRunStories(req.params.id);
        if (runStories && runStories.length > 0) stories = runStories;
      } catch { /* stories fallback failed */ }
    }

    // Extract project_memory from run context
    let projectMemory = '';
    try {
      const ctx = typeof run.context === 'string' ? JSON.parse(run.context) : run.context;
      projectMemory = ctx.project_memory || '';
    } catch { /* context parse failed */ }

    res.json({ prd, stories, rawOutput, projectMemory });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Plan fetch failed' });
  }
});

// GET /setfarm/runs/:id/design — Stitch design screens with local screenshots
router.get('/setfarm/runs/:id/design', async (req, res) => {
  try {
    const allRuns = (await getRuns()) as any[];
    const run = allRuns.find((r: any) => r.id === req.params.id);
    if (!run) { res.status(404).json({ error: 'Run not found' }); return; }

    const designStep = (run.steps || []).find((s: any) => s.step_id === 'design' && s.status === 'done');
    if (!designStep || !designStep.output) {
      res.json({ screens: [], projectId: null, designSystem: null });
      return;
    }

    const output = designStep.output as string;

    // Parse STITCH_PROJECT_ID
    const pidMatch = output.match(/STITCH_PROJECT_ID:\s*(\S+)/);
    const projectId = pidMatch ? pidMatch[1] : null;

    // Parse SCREEN_MAP JSON
    let screenMap: any[] = [];
    const smMatch = output.match(/SCREEN_MAP:\s*\n(\[[\s\S]*?\n\])/);
    if (smMatch) {
      try { screenMap = JSON.parse(smMatch[1]); } catch { /* malformed SCREEN_MAP JSON */ }
    }

    // Parse DESIGN_SYSTEM
    let designSystem: any = null;
    const dsMatch = output.match(/DESIGN_SYSTEM:\s*\n((?:\s+\w+:.*\n)+)/);
    if (dsMatch) {
      designSystem = {};
      for (const line of dsMatch[1].split('\n')) {
        const kv = line.trim().match(/^(\w+):\s*(.+)$/);
        if (kv) designSystem[kv[1]] = kv[2];
      }
    }

    // Parse DESIGN_NOTES
    const notesMatch = output.match(/DESIGN_NOTES:\s*(.+)/);
    const designNotes = notesMatch ? notesMatch[1] : '';

    // ENRICH: If screenMap exists but lacks htmlFile, merge from DESIGN_MANIFEST.json
    if (screenMap.length > 0 && projectId) {
      try {
        const ctx0 = JSON.parse(run.context || '{}');
        const repo0 = ctx0.repo || '';
        if (repo0) {
          const mp = join(repo0, 'stitch', 'DESIGN_MANIFEST.json');
          if (existsSync(mp)) {
            const mf = JSON.parse(readFileSync(mp, 'utf-8'));
            if (Array.isArray(mf)) {
              const byId = new Map(mf.map((s: any) => [s.screenId, s]));
              screenMap = screenMap.map((s: any) => {
                const m = byId.get(s.screenId);
                return m ? { ...s, htmlFile: m.htmlFile || null, title: m.title || s.name } : s;
              });
            }
          }
        }
      } catch { /* enrich failed */ }
    }

    // FALLBACK 1: Read from DESIGN_MANIFEST.json (design step writes this to repo)
    if (screenMap.length === 0 && projectId) {
      try {
        const ctx = JSON.parse(run.context || '{}');
        const repo = ctx.repo || '';
        if (repo) {
          const manifestPath = join(repo, 'stitch', 'DESIGN_MANIFEST.json');
          if (existsSync(manifestPath)) {
            const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
            if (Array.isArray(manifest)) {
              screenMap = manifest.map((s: any) => ({
                screenId: s.screenId || s.id || (s.name || 'screen').replace(/\s+/g, '-').toLowerCase(),
                name: s.title || s.name || s.screenName || 'Screen',
                description: s.description || '',
                type: s.type || s.category || s.deviceType?.toLowerCase() || 'page',
                htmlFile: s.htmlFile || null
              }));
            }
          }
        }
      } catch { /* manifest read failed */ }
    }

    const STITCH_SCRIPT_EARLY = join(PATHS.setfarmRepoDir, 'scripts/stitch-api.mjs');

    // FALLBACK 2: list-screens from Stitch API
    if (screenMap.length === 0 && projectId) {
      try {
        const listResult = execFileSync('node', [STITCH_SCRIPT_EARLY, 'list-screens', projectId],
          { timeout: 15_000, stdio: 'pipe' }).toString().trim();
        const screens = JSON.parse(listResult);
        if (Array.isArray(screens)) {
          screenMap = screens.map((s: any) => ({
            screenId: ((s.name || '').replace(/^projects\/\d+\/screens\//, '') || s.id || s.screenId || ''),
            name: s.name || 'Screen',
            description: s.description || '',
            type: s.type || 'page'
          }));
        }
      } catch { /* list-screens failed */ }
    }

    // FALLBACK 3: Scan repo stitch/ dir for .html+.png files directly
    if (screenMap.length === 0) {
      try {
        const ctx3 = JSON.parse(run.context || '{}');
        const repo3 = ctx3.repo || '';
        if (repo3) {
          const stitchDir3 = join(repo3, 'stitch');
          if (existsSync(stitchDir3)) {
            const htmlFiles = readdirSync(stitchDir3).filter((f: string) => f.endsWith('.html') && f !== 'DESIGN_MANIFEST.json');
            screenMap = htmlFiles.map((f: string) => {
              const screenId = f.replace('.html', '');
              return { screenId, name: 'Screen', description: '', type: 'page', htmlFile: f };
            });
          }
        }
      } catch { /* stitch dir scan failed */ }
    }


    // Only return empty if we truly have no data
    if (!projectId || screenMap.length === 0) {
      res.json({ screens: screenMap, projectId, designSystem, designNotes });
      return;
    }

    // Cache dir for this project's screenshots

    const cacheDir = join(import.meta.dirname || __dirname, '..', 'stitch-cache', projectId);
    mkdirSync(cacheDir, { recursive: true });

    const STITCH_SCRIPT = join(PATHS.setfarmRepoDir, 'scripts/stitch-api.mjs');

    // Fix C: skip populate-cache if PNGs already exist in cacheDir
    const { readdirSync: _rds } = await import('fs');
    const existingPngs: string[] = (() => { try { return (_rds(cacheDir) as string[]).filter((f: string) => f.endsWith('.png')); } catch { return []; } })();

    if (existingPngs.length === 0) {
      // Populate cache from repo's stitch/ dir (eager-downloaded during design step)
      // Stitch API deletes screens after hours, so repo-local files are the only reliable source
      try {
        const ctx = JSON.parse(run.context || '{}');
        const repo = ctx.repo || '';
        if (repo) {
          const repoStitchDir = join(repo, 'stitch');
          if (existsSync(repoStitchDir)) {
            execFileSync('node', [STITCH_SCRIPT, 'populate-cache', repoStitchDir, cacheDir], { timeout: 15_000, stdio: 'pipe' });
          }
        }
      } catch { /* best effort */ }

      // Fix B: if cacheDir still has no PNGs (completed run, worktree deleted), fallback to Stitch API
      const pngsAfterCopy: string[] = (() => { try { return (_rds(cacheDir) as string[]).filter((f: string) => f.endsWith('.png')); } catch { return []; } })();
      if (pngsAfterCopy.length === 0 && projectId) {
        try {
          const listOut = execFileSync('node', [STITCH_SCRIPT, 'list-screens', projectId], { timeout: 60_000, stdio: 'pipe' }).toString().trim();
          const remoteScreens: any[] = JSON.parse(listOut);
          for (const rs of remoteScreens) {
            const sid: string = ((rs.name || '').replace(/^projects\/\d+\/screens\//, '') || rs.id || rs.screenId || '');
            if (!sid) continue;
            const screenshotUrl: string | null = rs.screenshotUrl || rs.screenshot?.downloadUrl || rs.screenshot?.download_url || null;
            const htmlDownloadUrl: string | null = rs.htmlUrl || rs.htmlCode?.downloadUrl || rs.html_code?.download_url || null;
            if (screenshotUrl) {
              try { execFileSync('node', [STITCH_SCRIPT, 'download', screenshotUrl, join(cacheDir, sid + '.png')], { timeout: 60_000, stdio: 'pipe' }); } catch { /* best effort */ }
            }
            if (htmlDownloadUrl) {
              try { execFileSync('node', [STITCH_SCRIPT, 'download', htmlDownloadUrl, join(cacheDir, sid + '.html')], { timeout: 60_000, stdio: 'pipe' }); } catch { /* best effort */ }
            }
          }
        } catch { /* list-screens failed or Stitch API unavailable */ }
      }
    }

    const screens = screenMap.map((screen: any) => {
      // Try screenId-based files first, then htmlFile from manifest
      const screenshotPath = join(cacheDir, screen.screenId + '.png');
      const htmlById = join(cacheDir, screen.screenId + '.html');
      const htmlByName = screen.htmlFile ? join(cacheDir, screen.htmlFile) : '';

      const hasScreenshot = existsSync(screenshotPath);
      const htmlPath = existsSync(htmlById) ? htmlById : (htmlByName && existsSync(htmlByName) ? htmlByName : '');
      const htmlFileName = htmlPath ? htmlPath.split('/').pop() : null;

      return {
        ...screen,
        screenshotUrl: hasScreenshot ? `/stitch-cache/${projectId}/${screen.screenId}.png` : null,
        htmlUrl: htmlFileName ? `/stitch-cache/${projectId}/${htmlFileName}` : null,
      };
    });

    res.json({ screens, projectId, designSystem, designNotes });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Design fetch failed' });
  }
});


// Track last seen completed run IDs for auto-sync — persisted to disk
const MC_SYNC_STATE_PATH = join(PATHS.setfarmDir, 'mc-sync-state.json');

function loadSyncState(): { finished: Set<string>; running: Set<string> } {
  try {
    const data = JSON.parse(readSync(MC_SYNC_STATE_PATH, 'utf-8'));
    return {
      finished: new Set(data.finishedIds || []),
      running: new Set(data.runningIds || []),
    };
  } catch {
    return { finished: new Set(), running: new Set() };
  }
}

function saveSyncState(finished: Set<string>, running: Set<string>): void {
  try {
    const data = JSON.stringify({
      finishedIds: [...finished],
      runningIds: [...running],
      savedAt: new Date().toISOString(),
    });
    // Atomic write: write to tmp file, then rename
    const tmpPath = MC_SYNC_STATE_PATH + '.tmp';
    writeSync(tmpPath, data);
    renameSync(tmpPath, MC_SYNC_STATE_PATH);
  } catch (err: any) {
    console.error('[mc-sync] Failed to save sync state:', err.message);
  }
}

// Load persisted state on startup
const _initialState = loadSyncState();
let lastSeenFinishedIds = _initialState.finished;
let lastSeenRunningIds = _initialState.running;

async function createBuildingProject(run: any): Promise<void> {
  // Skip non-feature workflows — only feature-dev creates new projects
  // bug-fix and ui-refactor work on EXISTING projects, no new project creation needed
  const allowedWorkflows = ["feature-dev"];
  if (!allowedWorkflows.includes(run.workflow_id)) return;
  if (!run.task) return;
  const name = extractProjectName(run.task);
  if (!name || name.length < 2) return;

  // Quality gate: reject generic/short names that are clearly not project names
  const rejectNames = ['projects', 'sabah', 'aksam', 'rapor', 'standup', 'report', 'test', 'debug', 'fix', 'update', 'cleanup'];
  const nameLower = name.toLowerCase();
  if (rejectNames.some(r => nameLower === r || nameLower === r + 's')) {
    console.log('[lifecycle] Rejected generic name:', name);
    return;
  }

  let repo = '';
  try {
    const ctx = typeof run.context === 'string' ? JSON.parse(run.context) : run.context;
    repo = ctx?.repo || '';
  } catch { /* context parse failed */ }

  // Fallback: extract repo from task string when context is empty
  if (!repo) {
    const flagMatch = run.task.match(/--repo\s+(\/\S+)/i);
    if (flagMatch) repo = flagMatch[1].replace(/\/+$/, '');
    else {
      const labelMatch = run.task.match(/REPO:\s*(\/\S+)/i);
      if (labelMatch) repo = labelMatch[1].replace(/\/+$/, '');
    }
  }

  // Get next available port
  let port: number | null = null;
  try {
    const res = await fetch('http://127.0.0.1:3080/api/projects/next-port');
    const data = await res.json() as any;
    port = data.port || null;
  } catch (e: any) { console.warn('next-port fetch failed:', e?.message || e); }

  const stack = repo ? detectStack(repo) : [];

  const result = createProjectProgrammatic({
    name,
    repo,
    stack,
    emoji: '🏗',
    createdBy: 'setfarm-workflow',
    setfarmRunId: run.id,
    task: run.task.split('\n').slice(0, 3).join(' ').slice(0, 200),
    status: 'building',
    port: port || undefined,
  });

  if (result.created) {
    console.log('[lifecycle] Created building project:', name, 'port:', port);
  }
}

function extractProjectName(task: string): string {
  // Priority 1: Explicit Domain field (most reliable — user specified the exact slug)
  const domainMatch = task.match(/Domain:\s*([a-z0-9-]+)\.setrox\.com\.tr/i);
  if (domainMatch) return domainMatch[1];

  // Priority 2a: --repo flag format (CLI-style task strings)
  const repoFlagMatch = task.match(/--repo\s+\/home\/setrox\/([a-z0-9-]+)/i);
  if (repoFlagMatch) return repoFlagMatch[1];

  // Priority 2b: Repo directory name (second most reliable — kebab-case project name)
  const repoMatch = task.match(/Repo:\s*\/home\/setrox\/([a-z0-9-]+)/i);
  if (repoMatch) return repoMatch[1];

  const firstLine = task.split('\n')[0].replace(/^#+\s*/, '').trim();

  // Pattern 1: "Build/Create X app/project/tool"
  const buildMatch = firstLine.match(/(?:Build|Create|Implement|Add|Make|Develop)\s+(?:(?:a|an|the)\s+)?(.+?)\s+(?:web\s+)?(?:app(?:lication)?|project|service|tool|system|api|dashboard|page|site|feature)/i)
  if (buildMatch) return stripArticles(buildMatch[1]).replace(/[:\-\u2013]+$/, '').trim();

  // Pattern 2: "ProjectName - feature description" or "ProjectName — description"
  const separatorMatch = firstLine.match(/^(.+?)\s+[\-\u2013\u2014:]{1,3}\s+/);
  if (separatorMatch) {
    const candidate = separatorMatch[1]
      .replace(/^(?:Build|Create|Implement|Add|Make|Develop)\s+(?:(?:a|an|the)\s+)?/i, '')
      .replace(/\s+(?:web\s+)?(?:app(?:lication)?|project|service|tool|system|api|dashboard|page|site|feature)$/i, '')
      .replace(/[:\-\u2013.]+$/, '')
      .trim();
    if (candidate.length >= 2 && candidate.length <= 40) {
      return stripArticles(candidate);
    }
  }

  // Pattern 3: Fallback — strip verbs and suffixes
  const clean = firstLine
    .replace(/^(?:Build|Create|Implement|Add|Make|Develop)\s+(?:(?:a|an|the)\s+)?/i, '')
    .replace(/\s+(?:web\s+)?(?:app(?:lication)?|project|service|tool|system|api|dashboard|page|site|feature).*/i, '')
    .replace(/[:\-\u2013.]+$/, '')
    .trim();
  return stripArticles(clean).slice(0, 40) || firstLine.slice(0, 40);
}

/** Strip leading English articles (a, an, the) from project names */
function stripArticles(name: string): string {
  return name.replace(/^(?:a|an|the)\s+/i, '').trim();
}

function autoUpdateChecklist(project: any) {
  if (!project.checklist) return;
  const checks: Record<string, boolean> = {
    'task-received': true,
    'github-repo': !!(project.github || project.repo),
    'added-to-projects': true,
    'ports-assigned': !!(project.ports?.frontend || project.ports?.backend),
    'setup-run': (project.setfarmRunIds?.length || 0) > 0,
    'dev-started': (project.stories?.done || 0) > 0,
    'dns-setup': (() => {
      if (!project.domain) return false;
      try {
        const cfg = readFileSync('/etc/cloudflared/config.yml', 'utf-8');
        return cfg.includes(project.domain);
      } catch { return false; }
    })(),
    'test-review': (project.stories?.done === project.stories?.total && project.stories?.total > 0),
  };
  for (const [itemId, completed] of Object.entries(checks)) {
    if (completed) {
      const item = project.checklist.find((c: any) => c.id === itemId);
      if (item && !item.completed) {
        item.completed = true;
        item.completedAt = new Date().toISOString();
      }
    }
  }
}

async function syncProjectsFromRuns(): Promise<{ synced: any[]; skipped: string[] }> {
  const allRuns = (await getRuns()) as any[];
  // Deploy completed runs AND failed/cancelled runs that have a built dist
  // Only feature-dev creates deployable projects
  const allowedDeployWorkflows = new Set(["feature-dev"]);
  const deployable = allRuns.filter((r: any) => {
    if (r.status === 'completed') return allowedDeployWorkflows.has(r.workflow_id);
    if ((r.status === 'failed' || r.status === 'cancelled') && allowedDeployWorkflows.has(r.workflow_id)) {
      try {
        const ctx = typeof r.context === 'string' ? JSON.parse(r.context) : r.context;
        const repo = ctx?.repo || '';
        if (repo && existsSync(join(repo, 'dist', 'index.html'))) return true;
      } catch { /* context parse failed */ }
    }
    return false;
  });
  const synced: any[] = [];
  const skipped: string[] = [];

  for (const run of deployable) {
    if (!run.task) { skipped.push(run.id + ': no task'); continue; }

    const name = extractProjectName(run.task);
    if (!name || name.length < 2) { skipped.push(run.id + ': name too short'); continue; }

    let repo = '';
    try {
      const ctx = typeof run.context === 'string' ? JSON.parse(run.context) : run.context;
      repo = ctx?.repo || '';
    } catch { /* context parse failed */ }
    // Fallback: extract repo from task string when context is empty
    if (!repo) {
      const flagMatch = run.task.match(/--repo\s+(\/\S+)/i);
      if (flagMatch) repo = flagMatch[1].replace(/\/+$/, '');
      else {
        const labelMatch = run.task.match(/REPO:\s*(\/\S+)/i);
        if (labelMatch) repo = labelMatch[1].replace(/\/+$/, '');
      }
    }

    // Repo validation: only ~/projects/ and ~/mobile/
    if (repo) {
      const validPrefixes = [PATHS.projectsDir + '/', PATHS.mobileDir + '/'];
      if (!validPrefixes.some(prefix => repo.startsWith(prefix))) {
        skipped.push(run.id + ': non-project repo ' + repo);
        continue;
      }
    }

    // Name quality gate
    const rejectNames2 = ['projects', 'sabah', 'aksam', 'rapor', 'standup', 'report', 'test', 'debug', 'fix', 'update', 'cleanup'];
    if (rejectNames2.some(r => name.toLowerCase() === r || name.toLowerCase() === r + 's')) {
      skipped.push(run.id + ': generic name ' + name);
      continue;
    }

    const stack = repo ? detectStack(repo) : [];
    const mobile = isMobileProject(run.task, repo);

    const result = createProjectProgrammatic({
      name,
      repo,
      stack,
      emoji: mobile ? '\u{1F4F1}' : '\u{1F527}',
      createdBy: 'setfarm-workflow',
      setfarmRunId: run.id,
      task: run.task.split('\n').slice(0, 3).join(' ').slice(0, 200),
      type: mobile ? 'mobile' : 'web',
    });

    // Skip deleted projects — don't update or sync them
    if (result.reason === 'deleted') {
      skipped.push(run.id + ': deleted project ' + name);
      continue;
    }

    // B2: Re-detect stack if project exists but stack is empty
    if (!result.created && result.project && (!result.project.stack || result.project.stack.length === 0) && stack.length > 0) {
      updateProjectById(result.project.id, { stack });
    }

    // Detect backend port for existing projects
    if (!result.created && result.project && repo) {
      const backend = detectBackend(repo);
      if (backend?.hasBackend && backend.port && !result.project.ports?.backend) {
        updateProjectById(result.project.id, {
          ports: { ...(result.project.ports || {}), backend: backend.port },
        });
      }
    }

    const needsDeploy = !mobile && (result.created || (result.reason === 'exists' && !result.project?.service));
    if (needsDeploy && repo) {
      const deploy = autoDeployProject(result.project.id, result.project.name, repo, run.task);
      if (deploy.deployed) {
        updateProjectById(result.project.id, {
          // Detect backend service port
          ports: (() => {
            const bp = repo ? detectBackend(repo) : null;
            return { frontend: deploy.port, ...(bp?.port ? { backend: bp.port } : {}) };
          })(),
          domain: deploy.domain,
          service: deploy.service,
          serviceStatus: 'active',
          status: 'active',
          emoji: '🚀',
          repo,
          stack,
        });
        // Update stories and completion date
        try {
          const stories = await getRunStories(run.id);
          if (stories && stories.length > 0) {
            const done = run.status === 'completed' ? stories.length : stories.filter((s: any) => ['done', 'verified', 'skipped'].includes(s.status)).length;
            updateProjectById(result.project.id, {
              stories: { total: stories.length, done },
              completedAt: run.updated_at || new Date().toISOString(),
              workflowRunId: run.id,
              runNumber: run.run_number,
            });
          }
        } catch (e: any) { console.warn('story update failed:', e?.message || e); }
        result.project.deployed = true;
        result.project.port = deploy.port;
        result.project.domain = deploy.domain;
      } else {
        result.project.deployed = false;
        result.project.deployError = deploy.error;
        updateProjectById(result.project.id, { status: 'failed', emoji: '\u274c' });
      }
    }
        // Ensure DNS exists even for already-deployed projects
        if (!result.created && result.project?.domain && result.project?.service) {
          try {
            const cfg = readFileSync('/etc/cloudflared/config.yml', 'utf-8');
            const slug2 = slugify(result.project.name);
            const domain = slug2 + '.setrox.com.tr';
            if (!cfg.includes(domain)) {
              const port = result.project.ports?.frontend;
              if (port) {
                const entry = '- hostname: ' + domain + '\n  service: http://127.0.0.1:' + port + '\n';
                const updated = cfg.replace(/^(\s*)- service: http_status:404/m, entry + '$1- service: http_status:404');
                writeFileSync('/tmp/cloudflared-config.yml', updated);
                execFileSync('sudo', ['cp', '/tmp/cloudflared-config.yml', '/etc/cloudflared/config.yml'], { timeout: 5000 });
                execFileSync('sudo', ['systemctl', 'restart', 'cloudflared'], { timeout: 15000 });
                execFileSync('sudo', ['cloudflared', 'tunnel', 'route', 'dns', '92d8df83-3623-4850-ba41-29126106d020', domain], { timeout: 15000 });
              }
            }
          } catch (err: any) {
            console.error('[dns-ensure] Failed for', result.project?.domain, ':', err.message);
          }
        }

    if (result.created) {
      synced.push(result.project);
    } else {
      // Update stories for any run
      try {
        const stories = await getRunStories(run.id);
        if (stories && stories.length > 0) {
          const done = run.status === 'completed' ? stories.length : stories.filter((s: any) => ['done', 'verified', 'skipped'].includes(s.status)).length;
          updateProjectById(result.project.id, {
            stories: { total: stories.length, done },
            completedAt: (run.status === 'completed' || run.status === 'failed' || run.status === 'cancelled') ? (run.updated_at || new Date().toISOString()) : undefined,
            workflowRunId: run.id,
            runNumber: run.run_number,
          });
        }
      } catch (e: any) { console.warn("story sync failed:", e?.message || e); }
      // B4: Auto-update checklist based on project state
      autoUpdateChecklist(result.project);
      updateProjectById(result.project.id, { checklist: result.project.checklist });
      if (result.project?.status === 'building' || result.project?.status === 'failed') {
        const st = run.status === 'completed' ? 'active' : 'failed';
        updateProjectById(result.project.id, { status: st, emoji: st === 'active' ? '🚀' : '❌' });
      }
      skipped.push(run.id + ': exists' + (needsDeploy ? ' (deploy retried)' : ''));
    }
  }

  return { synced, skipped };
}

// POST /setfarm/sync-projects - manual trigger
router.post('/setfarm/sync-projects', async (_req, res) => {
  try {
    const result = await syncProjectsFromRuns();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Sync failed' });
  }
});


// Agent Feed: persistent chat-style agent output log
router.get("/setfarm/agent-feed", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
    const data = await cached("af-agent-feed", 10_000, () => getAgentFeedService(limit));
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Agent feed failed" });
  }
});

// DELETE /setfarm/agent-feed — Clear all agent feed entries
router.delete("/setfarm/agent-feed", async (_req, res) => {
  try {
    await clearAgentFeed();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Clear agent feed failed" });
  }
});
// DELETE /setfarm/activity — Clear activity events file
router.delete("/setfarm/activity", async (_req, res) => {
  try {
    const { writeFile } = await import("fs/promises");
    await writeFile(PATHS.eventsJsonl, "", "utf-8");
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Clear activity failed" });
  }
});

export default router;
