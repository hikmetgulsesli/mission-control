import { Router } from 'express';
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import { basename, extname, join } from 'path';
import { execSync, execFileSync } from 'child_process';
import { cached } from '../utils/cache.js';
import { getBatchStoryProgress } from '../utils/setfarm-db.js';
import { config, PATHS } from '../config.js';
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
import { sql } from '../utils/pg.js';

async function fetchSetfarmOperationalModel(runId: string): Promise<any | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch(`${config.setfarmUrl}/api/runs/${encodeURIComponent(runId)}/operational-model`, { signal: ctrl.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Detect if a task describes a mobile app */
function isMobileProject(task: string, repo: string): boolean {
  const mobileKeywords = [
    'react native', 'expo', 'mobile application', 'mobile app',
    'android', 'ios app', 'flutter', 'swift', 'kotlin'
  ];
  const lower = (task + ' ' + repo).toLowerCase();
  if (repo && repo.includes('/mobile/')) return true;
  return mobileKeywords.some(kw => lower.includes(kw));
}

let syncInProgress = false;
const router = Router();

function noStore(res: any): void {
  res.set('Cache-Control', 'no-store, max-age=0, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
}

function parseRunContext(run: any): any {
  try {
    const raw = run?.context || {};
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return {};
  }
}

function safeJson(value: unknown, fallback: any = null): any {
  if (value == null || value === '') return fallback;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

function compactDisplay(value: unknown, max = 220): string {
  if (value == null) return '';
  if (Array.isArray(value)) {
    return value.map((item) => compactDisplay(item, max)).filter(Boolean).join(', ').slice(0, max);
  }
  if (typeof value !== 'object') return String(value).replace(/\s+/g, ' ').trim().slice(0, max);
  const entry = value as Record<string, any>;
  const name = compactDisplay(entry.name || entry.title || entry.label || entry.screenName, max);
  const type = compactDisplay(entry.type || entry.deviceType || entry.kind, 80);
  const id = compactDisplay(entry.screenId || entry.screen_id || entry.id || entry.path || entry.status, max);
  if (name && type) return `${name} (${type})`.slice(0, max);
  if (name) return name.slice(0, max);
  if (id) return id.slice(0, max);
  try {
    return JSON.stringify(value).replace(/\s+/g, ' ').trim().slice(0, max);
  } catch {
    return String(value).replace(/\s+/g, ' ').trim().slice(0, max);
  }
}

function formatListEntry(value: unknown): string {
  if (value == null) return '';
  if (typeof value !== 'object') return String(value).trim();
  const entry = value as Record<string, any>;
  const name = compactDisplay(entry.name || entry.title || entry.label || entry.screenName, 140);
  const type = compactDisplay(entry.type || entry.deviceType || entry.kind, 80);
  const id = compactDisplay(entry.screenId || entry.screen_id || entry.id || entry.path, 140);
  if (name && type) return `${name} (${type})`;
  if (name) return name;
  if (id) return id;
  return compactDisplay(entry, 180);
}

function parseList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(formatListEntry).map(v => v.trim()).filter(Boolean);
  if (typeof value !== 'string') return [];
  const parsed = safeJson(value, null);
  if (Array.isArray(parsed)) return parsed.map(formatListEntry).map(v => v.trim()).filter(Boolean);
  return value.split(/\r?\n|,/).map(v => v.replace(/^[-*]\s*/, '').trim()).filter(Boolean);
}

function contractStatus(items: any[]): string {
  const statuses = items.map(i => normalizeVisibleStatus(i?.status));
  if (statuses.some(status => status === 'fail')) return 'fail';
  if (statuses.some(status => status === 'pending')) return 'pending';
  if (statuses.some(status => status === 'pass')) return 'pass';
  if (statuses.some(status => status === 'deferred')) return 'deferred';
  return 'pending';
}

function normalizeVisibleStatus(status: unknown): string {
  const value = String(status || 'pending').trim().toLowerCase();
  if (value === 'na' || value === 'n/a' || value === 'not_applicable') return 'pending';
  if (value === 'skipped' || value === 'skip') return 'fail';
  return value || 'pending';
}

function countFiles(dir: string, extension: string): number {
  try {
    if (!dir || !existsSync(dir)) return 0;
    return readdirSync(dir).filter(f => f.toLowerCase().endsWith(extension)).length;
  } catch {
    return 0;
  }
}

function readRepoContract(run: any): any | null {
  const ctx = parseRunContext(run);
  const fromContext = safeJson(ctx.run_contract, null);
  if (fromContext?.schema === 'setfarm.run-contract.v1') return fromContext;
  const repo = typeof ctx.repo === 'string' ? ctx.repo : '';
  const candidate = repo ? join(repo, '.setfarm', 'RUN_CONTRACT.json') : '';
  if (candidate && existsSync(candidate)) {
    const parsed = safeJson(readFileSync(candidate, 'utf-8'), null);
    if (parsed?.schema === 'setfarm.run-contract.v1') return parsed;
  }
  return null;
}

function buildFallbackContract(run: any, stories: any[]): any {
  const ctx = parseRunContext(run);
  const repo = typeof ctx.repo === 'string' ? ctx.repo : '';
  const stitchDir = repo ? join(repo, 'stitch') : '';
  const steps = Array.isArray(run.steps) ? run.steps : [];
  const nowIso = new Date().toISOString();
  const item = (id: string, label: string, status: string, owner: string, evidence = '', stepId?: string) => ({
    id, label, status, owner, evidence, stepId, updatedAt: nowIso,
  });
  const stepStatus = (stepId: string) => {
    const step = steps.find((s: any) => s.step_id === stepId || s.stepId === stepId);
    if (!step) return 'pending';
    if (step.status === 'done') return 'pass';
    if (step.status === 'failed' || step.status === 'skipped') return 'fail';
    return 'pending';
  };
  const requiredStatus = (stepId: string, present: boolean) => {
    const status = stepStatus(stepId);
    if (status === 'pending') return 'pending';
    return present ? 'pass' : 'fail';
  };
  const designManifest = existsSync(join(stitchDir, 'DESIGN_MANIFEST.json'));
  const domManifest = existsSync(join(stitchDir, 'DESIGN_DOM.json'));
  const uiContract = existsSync(join(stitchDir, 'UI_CONTRACT.json'));
  const htmlCount = countFiles(stitchDir, '.html');
  const pngCount = countFiles(stitchDir, '.png');
  const phases = [
    { id: 'plan', label: 'Plan', items: [
      item('plan.repo', 'Repository path resolved', requiredStatus('plan', Boolean(repo)), 'planner', repo || 'missing repo', 'plan'),
      item('plan.stack', 'Technology stack declared', requiredStatus('plan', Boolean(ctx.tech_stack)), 'planner', ctx.tech_stack || 'missing tech_stack', 'plan'),
      item('plan.prd', 'PRD captured', requiredStatus('plan', Boolean(ctx.prd)), 'planner', ctx.prd ? `${String(ctx.prd).length} chars` : 'missing prd', 'plan'),
    ]},
    { id: 'design', label: 'Design', items: [
      item('design.stitch_dir', 'Stitch artifact directory exists', requiredStatus('design', existsSync(stitchDir)), 'designer', stitchDir, 'design'),
      item('design.manifest', 'Design manifest exists', requiredStatus('design', designManifest), 'designer', 'DESIGN_MANIFEST.json', 'design'),
      item('design.png', 'PNG screenshots downloaded', requiredStatus('design', pngCount > 0), 'designer', `${pngCount} png file(s)`, 'design'),
      item('design.dom', 'DOM manifest exists', requiredStatus('design', domManifest), 'designer', 'DESIGN_DOM.json', 'design'),
      item('design.ui_contract', 'UI contract exists', requiredStatus('design', uiContract), 'designer', 'UI_CONTRACT.json', 'design'),
    ]},
    { id: 'stories', label: 'Stories', items: [
      item('stories.count', 'Stories decomposed', requiredStatus('stories', stories.length > 0), 'planner', `${stories.length} story(ies)`, 'stories'),
      item('stories.scope', 'Story scope files captured', requiredStatus('stories', stories.length > 0 && stories.every((s: any) => parseList(s.scope_files).length > 0)), 'planner', 'scope_files', 'stories'),
    ]},
    ...['setup-repo', 'setup-build', 'implement', 'verify', 'security-gate', 'qa-test', 'final-test', 'deploy'].map(stepId => ({
      id: stepId,
      label: stepId.replace(/-/g, ' ').replace(/\b\w/g, m => m.toUpperCase()),
      items: [item(`${stepId}.status`, `${stepId} step status`, stepStatus(stepId), stepId, steps.find((s: any) => s.step_id === stepId)?.status || 'waiting', stepId)],
    })),
  ].map((phase: any) => ({ ...phase, status: contractStatus(phase.items) }));
  const allItems = phases.flatMap((p: any) => p.items);
  const progress = allItems.reduce((acc: any, current: any) => {
    acc.total += 1;
    acc[current.status] = (acc[current.status] || 0) + 1;
    return acc;
  }, { total: 0, pass: 0, fail: 0, pending: 0, deferred: 0, na: 0 });
  return {
    schema: 'setfarm.run-contract.v1',
    version: 1,
    runId: run.id,
    runNumber: run.run_number,
    workflowId: run.workflow_id,
    status: run.status,
    task: run.task,
    project: {
      repo,
      branch: ctx.branch || '',
      displayName: ctx.project_display_name || basename(repo || '') || 'Setfarm Project',
      techStack: ctx.tech_stack || '',
      uiLanguage: ctx.ui_language || 'English',
    },
    stackPack: { id: ctx.stack_pack || 'unknown', label: ctx.stack_pack || 'Unknown stack', confidence: 'low', evidence: ['Fallback contract generated by Mission Control'] },
    progress,
    phases,
    stories: stories.map((s: any) => ({
      storyId: s.story_id,
      title: s.title,
      status: normalizeVisibleStatus(s.status),
      ownsScreens: parseList(s.story_screens),
      scopeFiles: parseList(s.scope_files),
      sharedFiles: parseList(s.shared_files),
      dependsOn: parseList(s.depends_on),
      deferred: ['pending', 'waiting'].includes(String(s.status || '')),
      blocker: s.status === 'failed' ? String(s.output || '').slice(0, 220) : undefined,
    })),
    artifacts: { stitchDir, designScreenCount: 0, htmlCount, pngCount, domManifest, uiContract },
    blockers: steps.filter((s: any) => ['failed', 'skipped'].includes(String(s.status || ''))).map((s: any) => `${s.step_id}: ${String(s.output || s.status).replace(/\s+/g, ' ').slice(0, 180)}`),
    updatedAt: nowIso,
    reason: 'mc-fallback',
  };
}

function normalizeRunContract(contract: any, stories: any[], run?: any): any {
  const storyRows = new Map<string, any>();
  const stepRows = new Map<string, string>();
  for (const step of Array.isArray(run?.steps) ? run.steps : []) {
    const id = String(step.step_id || step.stepId || '');
    if (id) stepRows.set(id, String(step.status || ''));
  }
  const terminalStep = (status: string) => ['done', 'failed', 'skipped'].includes(status);
  const normalizeItemStatus = (phaseId: string, item: any): string => {
    const rawStatus = String(item?.status || 'pending').trim().toLowerCase();
    const status = normalizeVisibleStatus(rawStatus);
    const stepId = String(item?.stepId || item?.step_id || phaseId || '');
    const stepStatus = stepRows.get(stepId);
    if ((rawStatus === 'na' || rawStatus === 'n/a' || rawStatus === 'not_applicable') && stepStatus && terminalStep(stepStatus)) {
      return stepStatus === 'failed' || stepStatus === 'skipped' ? 'fail' : 'pass';
    }
    if (status !== 'pass') return status;
    if (!stepId || stepRows.size === 0) return status;
    return !stepStatus || !terminalStep(stepStatus) ? 'pending' : status;
  };
  const normalizePhaseStatus = (phase: any): string => {
    const items = Array.isArray(phase.items) ? phase.items : [];
    const status = contractStatus(items);
    if (status === 'fail' || stepRows.size === 0) return status;
    const stepIds = new Set<string>();
    for (const item of items) {
      const stepId = String(item?.stepId || item?.step_id || phase.id || '').trim();
      if (stepId) stepIds.add(stepId);
    }
    if (stepIds.size === 0 && phase.id) stepIds.add(String(phase.id));
    for (const stepId of stepIds) {
      const stepStatus = stepRows.get(stepId);
      if (stepStatus && !terminalStep(stepStatus)) return 'pending';
    }
    return status;
  };
  for (const story of stories || []) {
    if (story?.story_id) storyRows.set(String(story.story_id), story);
    if (story?.id) storyRows.set(String(story.id), story);
  }
  const normalizedStories = Array.isArray(contract?.stories)
    ? contract.stories.map((story: any) => {
        const storyId = compactDisplay(story.storyId || story.story_id || story.id || '', 120);
        const row = storyRows.get(storyId) || storyRows.get(String(story.id || '')) || {};
        return {
          ...story,
          storyId,
          title: compactDisplay(story.title || row.title || storyId, 180),
          status: normalizeVisibleStatus(compactDisplay(story.status || row.status || 'pending', 80)),
          ownsScreens: parseList(row.story_screens ?? story.ownsScreens),
          scopeFiles: parseList(row.scope_files ?? story.scopeFiles),
          sharedFiles: parseList(row.shared_files ?? story.sharedFiles),
          dependsOn: parseList(row.depends_on ?? story.dependsOn),
          blocker: compactDisplay(story.blocker || row.output || '', 260) || undefined,
        };
      })
    : [];
  const normalizedPhases = Array.isArray(contract?.phases)
    ? contract.phases.map((phase: any) => ({
        ...phase,
        id: compactDisplay(phase.id, 100),
        label: compactDisplay(phase.label || phase.id || 'Step', 120),
        items: Array.isArray(phase.items)
          ? phase.items.map((item: any) => ({
              ...item,
              id: compactDisplay(item.id || item.label || item.stepId || item.storyId || 'check', 140),
              label: compactDisplay(item.label || item.id || 'Check', 180),
              owner: compactDisplay(item.owner || item.agent || item.stepId || phase.id || 'system', 100),
              stepId: compactDisplay(item.stepId || item.step_id || phase.id || '', 100),
              storyId: compactDisplay(item.storyId || item.story_id || '', 120) || undefined,
              status: normalizeItemStatus(String(phase.id || ''), item),
              evidence: compactDisplay(item.evidence, 260),
              blocker: compactDisplay(item.blocker, 260),
            }))
          : [],
      })).map((phase: any) => ({ ...phase, status: normalizePhaseStatus(phase) }))
    : [];
  const allItems = normalizedPhases.flatMap((phase: any) => phase.items || []);
  const progress = allItems.reduce((acc: any, current: any) => {
    acc.total += 1;
    acc[current.status] = (acc[current.status] || 0) + 1;
    return acc;
  }, { total: 0, pass: 0, fail: 0, pending: 0, deferred: 0, na: 0 });
  return {
    ...contract,
    project: {
      ...(contract?.project || {}),
      repo: compactDisplay(contract?.project?.repo, 260),
      branch: compactDisplay(contract?.project?.branch, 160),
      displayName: compactDisplay(contract?.project?.displayName || contract?.project?.name || 'Setfarm Project', 160),
      techStack: compactDisplay(contract?.project?.techStack || contract?.project?.tech_stack, 120),
      uiLanguage: compactDisplay(contract?.project?.uiLanguage || contract?.project?.ui_language || 'English', 80),
    },
    stackPack: {
      ...(contract?.stackPack || {}),
      id: compactDisplay(contract?.stackPack?.id || 'unknown', 120),
      label: compactDisplay(contract?.stackPack?.label || contract?.stackPack?.id || 'Unknown stack', 160),
      confidence: compactDisplay(contract?.stackPack?.confidence || '', 80),
      evidence: parseList(contract?.stackPack?.evidence),
    },
    progress,
    phases: normalizedPhases,
    stories: normalizedStories,
    blockers: parseList(contract?.blockers).map((item) => compactDisplay(item, 260)),
  };
}

function uniquePaths(paths: string[]): string[] {
  return [...new Set(paths.filter(Boolean))];
}

function projectRootCandidates(): string[] {
  const home = process.env.HOME || process.cwd();
  return uniquePaths([
    PATHS.projectsDir,
    process.env.SETFARM_PROJECTS_DIR || '',
    process.env.OPENCLAW_PROJECTS_DIR || '',
    join(home, 'projects'),
  ]);
}

function stitchCacheDir(projectId: string): string {
  const home = process.env.HOME || process.cwd();
  return join(home, '.openclaw', 'setfarm', 'stitch-cache', projectId);
}

function resolveRunStitchDirs(run: any, projectId?: string | null): string[] {
  const ctx = parseRunContext(run);
  const repo = typeof ctx.repo === 'string' ? ctx.repo : '';
  const projectName = repo ? basename(repo) : '';
  const dirs = [
    repo ? join(repo, 'stitch') : '',
    ...projectRootCandidates().flatMap((root) => projectName ? [join(root, projectName, 'stitch')] : []),
    projectId ? stitchCacheDir(projectId) : '',
  ];
  return uniquePaths(dirs);
}

function findRunStitchFile(run: any, projectId: string | null | undefined, fileName: string): string | null {
  if (!fileName || fileName !== basename(fileName)) return null;
  for (const dir of resolveRunStitchDirs(run, projectId)) {
    const fullPath = join(dir, fileName);
    if (existsSync(fullPath)) return fullPath;
  }
  return null;
}

function designArtifactUrl(runId: string, fileName: string): string {
  return `/api/setfarm/runs/${encodeURIComponent(runId)}/design-artifact/${encodeURIComponent(fileName)}`;
}

function resolveRunProjectId(run: any, output?: string): string | null {
  const pidMatch = output?.match(/STITCH_PROJECT_ID:\s*(\S+)/);
  if (pidMatch) return pidMatch[1];

  const ctx = parseRunContext(run);
  const repo = typeof ctx.repo === 'string' ? ctx.repo : '';
  for (const dir of resolveRunStitchDirs(run, null)) {
    const dotStitch = join(dir.replace(/\/stitch$/, ''), '.stitch');
    if (!existsSync(dotStitch)) continue;
    try {
      const parsed = JSON.parse(readFileSync(dotStitch, 'utf-8'));
      if (parsed?.projectId) return parsed.projectId;
    } catch {
      // Continue through other candidate locations.
    }
  }

  if (repo) {
    try {
      const dotStitch = join(repo, '.stitch');
      if (existsSync(dotStitch)) {
        const parsed = JSON.parse(readFileSync(dotStitch, 'utf-8'));
        if (parsed?.projectId) return parsed.projectId;
      }
    } catch {
      // Project id is optional for older runs.
    }
  }

  return null;
}

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

      // D2: Batch story progress (1 query instead of N)
      const allDisplayRuns = [...running, ...recent];
      const batchProgress = await getBatchStoryProgress(allDisplayRuns.map((r: any) => String(r.id))).catch(() => ({}));
      const operationalByRunId = new Map<string, any>();
      await Promise.all(allDisplayRuns.map(async (r: any) => {
        const model = await fetchSetfarmOperationalModel(String(r.id));
        if (model) operationalByRunId.set(String(r.id), model);
      }));

      return allDisplayRuns.map((r: any) => {
        // Wave 1 fix #1 + #9 (plan: reactive-frolicking-cupcake): fall back includes
        // a `failed` bucket now, and we no longer force-set completed = total when
        // the run is marked completed. Forcing that override was the second source
        // of the "100%" lie (first was failed-counted-as-completed in setfarm-db.ts).
        // Now the real bucket counts flow through unchanged.
            const storyProgress = (batchProgress as any)[r.id] || { completed: 0, total: 0, verified: 0, skipped: 0, running: 0, pending: 0, done: 0, failed: 0 };
        const hasFailures = (storyProgress.failed || 0) > 0;
        const operational = operationalByRunId.get(String(r.id));
        return {
          id: r.id,
          runNumber: r.run_number,
          workflow: r.workflow_id,
          task: r.task,
          status: r.status,
          hasFailures,
          updatedAt: r.updated_at,
          createdAt: r.created_at,
          currentStoryId: r.currentStoryId || r.current_story_id || null,
          currentStoryTitle: r.currentStoryTitle || r.current_story_title || null,
          currentStoryStatus: r.currentStoryStatus || r.current_story_status || null,
          currentStoryRetry: r.currentStoryRetry || r.current_story_retry || 0,
          currentStoryMaxRetries: r.currentStoryMaxRetries || r.current_story_max_retries || 0,
          nextStoryId: r.nextStoryId || r.next_story_id || null,
          nextStoryTitle: r.nextStoryTitle || r.next_story_title || null,
          nextStoryStatus: r.nextStoryStatus || r.next_story_status || null,
          blockerStepId: r.blockerStepId || r.blocker_step_id || null,
          blockerSummary: r.blockerSummary || r.blocker_summary || null,
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
          operational: operational ? {
            stack: operational.stack,
            failure: operational.failure,
            stories: operational.stories,
            pipeline: operational.pipeline,
          } : null,
        };
      });
    });
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Pipeline fetch failed' });
  }
});

// GET /setfarm/runs/:id/stories — Stories for a specific run
router.get('/setfarm/runs/:id/stories', async (req, res) => {
  noStore(res);
  try {
    const stories = await getRunStories(req.params.id);
    res.json(stories || []);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Stories fetch failed' });
  }
});

// GET /setfarm/runs/:id/operational-model — canonical Setfarm run/stack/failure model.
router.get('/setfarm/runs/:id/operational-model', async (req, res) => {
  noStore(res);
  try {
    const model = await fetchSetfarmOperationalModel(req.params.id);
    if (!model) { res.status(404).json({ error: 'Operational model not found' }); return; }
    res.json(model);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Operational model fetch failed' });
  }
});

function normalizeObservationStatus(status: unknown): string {
  const value = String(status || 'info').trim().toLowerCase();
  if (value === 'done' || value === 'completed' || value === 'verified') return 'pass';
  if (value === 'failed' || value === 'skipped' || value === 'timeout') return 'fail';
  if (value === 'waiting') return 'pending';
  if (['pending', 'running', 'pass', 'fail', 'retry', 'blocked', 'info'].includes(value)) return value;
  return 'info';
}

function normalizeOperationObservation(row: any): any {
  const metadata = safeJson(row.metadata, {});
  const eventType = row.event_type || null;
  const status = eventType === 'stack.evidence' && metadata?.stackStatus === 'resolved'
    ? 'pass'
    : normalizeObservationStatus(row.status);
  return {
    id: row.id,
    runId: row.run_id,
    stepId: row.step_id,
    storyId: row.story_id || null,
    agentId: row.agent_id || null,
    phase: row.phase || null,
    checkId: row.check_id,
    label: compactDisplay(row.label, 180),
    status,
    summary: compactDisplay(row.summary, 260),
    detail: compactDisplay(row.detail, 500),
    evidence: safeJson(row.evidence, {}),
    filePaths: safeJson(row.file_paths, []),
    github: safeJson(row.github, {}),
    metadata,
    eventType,
    startedAt: row.started_at || null,
    completedAt: row.completed_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function operationPhaseStatus(stepStatus: string, observations: any[]): string {
  if (stepStatus === 'failed' || stepStatus === 'skipped') return 'fail';
  if (stepStatus === 'running') return 'running';
  if (stepStatus === 'done') return 'pass';
  if (observations.some((obs) => obs.status === 'fail' || obs.status === 'blocked')) return 'fail';
  if (observations.some((obs) => obs.status === 'retry')) return 'retry';
  if (observations.some((obs) => obs.status === 'running')) return 'running';
  if (observations.some((obs) => obs.status === 'pass')) return 'pass';
  if (stepStatus === 'pending' || stepStatus === 'waiting') return 'pending';
  return 'pending';
}

function observationScopeKey(obs: any): string {
  return `${obs.stepId || ''}|${obs.storyId || ''}`;
}

function isTerminalPassObservation(obs: any): boolean {
  if (obs.status !== 'pass') return false;
  const checkId = String(obs.checkId || '');
  const eventType = String(obs.eventType || '');
  return (
    eventType === 'gate.pass' ||
    eventType === 'step.done' ||
    eventType === 'step.output.pass' ||
    checkId === 'supervisor-decision' ||
    checkId.startsWith('stack-evidence:') ||
    checkId === 'verify.pr_comments.resolve_actionable' ||
    checkId.startsWith('synthetic:') ||
    checkId.endsWith(':status')
  );
}

function isTerminalOperationObservation(obs: any): boolean {
  if (['fail', 'retry', 'blocked'].includes(obs.status)) return true;
  return isTerminalPassObservation(obs);
}

function openOperationObservations(observations: any[]): any[] {
  const latestTerminalByScope = new Map<string, number>();
  const latestTerminalPassByScope = new Map<string, number>();
  const latestActiveByScope = new Map<string, number>();
  for (const obs of observations) {
    if (['pending', 'running', 'retry'].includes(obs.status)) {
      const scopeKey = observationScopeKey(obs);
      const ts = new Date(obs.updatedAt || obs.createdAt || 0).getTime();
      if (ts > (latestActiveByScope.get(scopeKey) || 0)) {
        latestActiveByScope.set(scopeKey, ts);
      }
    }
    if (isTerminalOperationObservation(obs)) {
      const scopeKey = observationScopeKey(obs);
      const ts = new Date(obs.updatedAt || obs.createdAt || 0).getTime();
      if (ts > (latestTerminalByScope.get(scopeKey) || 0)) {
        latestTerminalByScope.set(scopeKey, ts);
      }
    }
    if (!isTerminalPassObservation(obs)) continue;
    const scopeKey = observationScopeKey(obs);
    const ts = new Date(obs.updatedAt || obs.createdAt || 0).getTime();
    if (ts > (latestTerminalPassByScope.get(scopeKey) || 0)) {
      latestTerminalPassByScope.set(scopeKey, ts);
    }
  }

  return observations.filter((obs) => {
    if (['pending', 'running'].includes(obs.status)) {
      const terminalAt = latestTerminalByScope.get(observationScopeKey(obs)) || 0;
      const obsAt = new Date(obs.updatedAt || obs.createdAt || 0).getTime();
      return terminalAt <= 0 || obsAt >= terminalAt;
    }
    if (!['fail', 'retry', 'blocked'].includes(obs.status)) return true;
    const activeAt = latestActiveByScope.get(observationScopeKey(obs)) || 0;
    const obsAt = new Date(obs.updatedAt || obs.createdAt || 0).getTime();
    if (activeAt > obsAt) return false;
    const resolvedAt = latestTerminalPassByScope.get(observationScopeKey(obs)) || 0;
    if (resolvedAt <= 0) return true;
    return obsAt >= resolvedAt;
  });
}

function buildRunOperations(run: any, stories: any[], observations: any[]): any {
  const steps = Array.isArray(run.steps) ? run.steps : [];
  const runStatus = String(run.status || '').toLowerCase();
  const runIsTerminal = ['completed', 'failed', 'cancelled', 'canceled'].includes(runStatus);
  const latestByCheck = new Map<string, any>();
  for (const obs of observations) {
    const stepId = String(obs.stepId || '').toLowerCase();
    if (stepId === 'run' && !runIsTerminal && ['fail', 'blocked', 'retry'].includes(String(obs.status || ''))) {
      continue;
    }
    const key = `${obs.stepId || ''}|${obs.storyId || ''}|${obs.checkId || obs.id || ''}`;
    if (!latestByCheck.has(key)) latestByCheck.set(key, obs);
  }
  const currentObservations = [...latestByCheck.values()]
    .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime());
  const openObservations = openOperationObservations(currentObservations);
  const obsByStep = new Map<string, any[]>();
  const obsByStory = new Map<string, any[]>();
  for (const obs of openObservations) {
    const stepRows = obsByStep.get(obs.stepId) || [];
    stepRows.push(obs);
    obsByStep.set(obs.stepId, stepRows);
    if (obs.storyId) {
      const storyRows = obsByStory.get(obs.storyId) || [];
      storyRows.push(obs);
      obsByStory.set(obs.storyId, storyRows);
    }
  }

  const phases = steps.map((step: any) => {
    const stepId = String(step.step_id || step.stepId || '');
    const phaseObservations = obsByStep.get(stepId) || [];
    return {
      id: stepId,
      label: stepId.replace(/-/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()),
      agentId: step.agent_id || null,
      status: operationPhaseStatus(String(step.status || ''), phaseObservations),
      retryCount: Number(step.retry_count || 0),
      maxRetries: Number(step.max_retries || 0),
      currentStoryId: step.current_story_id || null,
      startedAt: step.started_at || null,
      updatedAt: step.updated_at || null,
      observations: phaseObservations.slice(0, 12),
    };
  });
  const knownPhaseIds = new Set(phases.map((phase: any) => phase.id));
  for (const [stepId, phaseObservations] of obsByStep.entries()) {
    if (!stepId || knownPhaseIds.has(stepId)) continue;
    phases.push({
      id: stepId,
      label: stepId.replace(/-/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()),
      agentId: phaseObservations[0]?.agentId || null,
      status: operationPhaseStatus('', phaseObservations),
      retryCount: 0,
      maxRetries: 0,
      currentStoryId: null,
      startedAt: phaseObservations[phaseObservations.length - 1]?.createdAt || null,
      updatedAt: phaseObservations[0]?.updatedAt || phaseObservations[0]?.createdAt || null,
      observations: phaseObservations.slice(0, 12),
    });
  }

  const normalizedStories = (stories || []).map((story: any) => {
    const storyId = String(story.story_id || story.storyId || story.id || '');
    const storyObservations = obsByStory.get(storyId) || [];
    return {
      storyId,
      title: compactDisplay(story.title || storyId, 180),
      status: normalizeVisibleStatus(story.status || 'pending'),
      retryCount: Number(story.retry_count || 0),
      maxRetries: Number(story.max_retries || 0),
      branch: story.story_branch || null,
      prUrl: story.pr_url || null,
      mergeStatus: story.merge_status || null,
      currentObservation: storyObservations[0] || null,
      observations: storyObservations.slice(0, 10),
    };
  });

  const progress = openObservations.reduce((acc: any, obs: any) => {
    acc.total += 1;
    acc[obs.status] = (acc[obs.status] || 0) + 1;
    return acc;
  }, { total: 0, pending: 0, running: 0, pass: 0, fail: 0, retry: 0, blocked: 0, info: 0 });

  return {
    run: {
      id: run.id,
      runNumber: run.run_number,
      workflowId: run.workflow_id,
      task: compactDisplay(run.task, 260),
      status: run.status,
      updatedAt: run.updated_at,
    },
    progress,
    phases,
    stories: normalizedStories,
    feed: observations.slice(0, 80),
    observations: openObservations,
    history: observations.slice(0, 500),
    generatedAt: new Date().toISOString(),
  };
}

function syntheticOperationObservations(run: any, stories: any[]): any[] {
  const rows: any[] = [];
  const steps = Array.isArray(run.steps) ? run.steps : [];
  for (const step of steps) {
    const stepId = String(step.step_id || step.stepId || 'step');
    const rawStatus = String(step.status || 'pending');
    rows.push({
      id: `synthetic-step-${stepId}`,
      runId: run.id,
      stepId,
      storyId: step.current_story_id || null,
      agentId: step.agent_id || null,
      phase: null,
      checkId: `synthetic:${stepId}:status`,
      label: `${stepId} status`,
      status: normalizeObservationStatus(rawStatus),
      summary: rawStatus === 'running'
        ? `${stepId} is running`
        : rawStatus === 'done'
          ? `${stepId} completed`
          : rawStatus === 'failed'
            ? `${stepId} failed`
            : `${stepId} is ${rawStatus || 'pending'}`,
      detail: compactDisplay(step.output || '', 500),
      evidence: {},
      filePaths: [],
      github: {},
      metadata: { synthetic: true },
      eventType: null,
      createdAt: step.updated_at || step.created_at || run.updated_at,
      updatedAt: step.updated_at || step.created_at || run.updated_at,
    });
  }
  for (const story of stories || []) {
    const storyId = String(story.story_id || story.storyId || story.id || '');
    if (!storyId) continue;
    const rawStatus = String(story.status || 'pending');
    rows.push({
      id: `synthetic-story-${storyId}`,
      runId: run.id,
      stepId: rawStatus === 'verified' ? 'verify' : 'implement',
      storyId,
      agentId: story.claimed_by || null,
      phase: null,
      checkId: `synthetic:${storyId}:status`,
      label: `${storyId} status`,
      status: normalizeObservationStatus(rawStatus),
      summary: `${storyId} ${rawStatus}`,
      detail: compactDisplay(story.output || '', 500),
      evidence: {},
      filePaths: [],
      github: story.pr_url ? { prUrl: story.pr_url, mergeStatus: story.merge_status || null } : {},
      metadata: { synthetic: true },
      eventType: null,
      createdAt: story.updated_at || story.created_at || run.updated_at,
      updatedAt: story.updated_at || story.created_at || run.updated_at,
    });
  }
  return rows.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
}

// GET /setfarm/runs/:id/operations — live operations board data for Mission Control.
router.get('/setfarm/runs/:id/operations', async (req, res) => {
  noStore(res);
  try {
    const allRuns = (await getRuns()) as any[];
    const run = allRuns.find((r: any) => r.id === req.params.id);
    if (!run) { res.status(404).json({ error: 'Run not found' }); return; }
    const stories = await getRunStories(req.params.id).catch(() => []);
    let observationRows: any[] = [];
    try {
      observationRows = await sql`
        SELECT *
        FROM run_observations
        WHERE run_id = ${req.params.id}
        ORDER BY created_at DESC
        LIMIT 500
      `;
    } catch {
      observationRows = [];
    }
    const observations = observationRows.length > 0
      ? observationRows.map(normalizeOperationObservation)
      : syntheticOperationObservations(run, stories || []);
    res.json(buildRunOperations(run, stories || [], observations));
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Operations fetch failed' });
  }
});

// GET /setfarm/runs/:id/contract — machine-readable run contract/checklist.
router.get('/setfarm/runs/:id/contract', async (req, res) => {
  noStore(res);
  try {
    const allRuns = (await getRuns()) as any[];
    const run = allRuns.find((r: any) => r.id === req.params.id);
    if (!run) { res.status(404).json({ error: 'Run not found' }); return; }
    const stories = await getRunStories(req.params.id).catch(() => []);
    const contract = readRepoContract(run) || buildFallbackContract(run, stories || []);
    res.json(normalizeRunContract(contract, stories || [], run));
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Contract fetch failed' });
  }
});

// GET /setfarm/runs/:id/plan — PRD/Plan document for a run
router.get('/setfarm/runs/:id/plan', async (req, res) => {
  noStore(res);
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

    // Step durations and stats for Memory tab
    const stepDurations = (run.steps || []).map((s: any) => ({
      stepId: s.step_id,
      status: s.status,
      durationMs: s.updated_at && s.created_at ? Date.parse(s.updated_at) - Date.parse(s.created_at) : 0,
      abandonedCount: s.abandoned_count || 0,
    }));

    // Story stats from run's stories
    let storyStats: Record<string, number> = {};
    try {
      const runStories2 = await getRunStories(req.params.id);
      if (runStories2 && runStories2.length > 0) {
        for (const s of runStories2) {
          storyStats[s.status] = (storyStats[s.status] || 0) + 1;
        }
      }
    } catch { /* story stats failed */ }

    res.json({ prd, stories, rawOutput, projectMemory, stepDurations, storyStats });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Plan fetch failed' });
  }
});

// GET /setfarm/runs/:id/design-artifact/:file — Serve Stitch artifacts from the run's real project location.
router.get('/setfarm/runs/:id/design-artifact/:file', async (req, res) => {
  try {
    const rawFile = req.params.file || '';
    const fileName = basename(rawFile);
    const extension = extname(fileName).toLowerCase();
    const allowedExtensions = new Set(['.png', '.html', '.css', '.jpg', '.jpeg', '.webp']);

    if (fileName !== rawFile || !allowedExtensions.has(extension)) {
      res.status(400).json({ error: 'Invalid design artifact' });
      return;
    }

    const allRuns = (await getRuns()) as any[];
    const run = allRuns.find((r: any) => r.id === req.params.id);
    if (!run) { res.status(404).json({ error: 'Run not found' }); return; }

    const designStep = (run.steps || []).find((s: any) => s.step_id === 'design');
    const projectId = resolveRunProjectId(run, designStep?.output as string | undefined);
    const artifactPath = findRunStitchFile(run, projectId, fileName);
    if (!artifactPath) {
      res.status(404).json({ error: 'Design artifact not found' });
      return;
    }

    if (extension === '.html') res.type('html');
    else if (extension === '.css') res.type('css');
    else res.type(extension.slice(1));
    res.set('Cache-Control', 'private, max-age=300');
    res.sendFile(artifactPath);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Design artifact fetch failed' });
  }
});

// GET /setfarm/runs/:id/design — Stitch design screens with local screenshots
router.get('/setfarm/runs/:id/design', async (req, res) => {
  noStore(res);
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

    const projectId = resolveRunProjectId(run, output);

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
        if (kv) designSystem[kv[1]] = compactDisplay(kv[2], 220);
      }
    }

    // Parse DESIGN_NOTES
    const notesMatch = output.match(/DESIGN_NOTES:\s*(.+)/);
    const designNotes = notesMatch ? notesMatch[1] : '';

    // ENRICH: If screenMap exists but lacks htmlFile/screenshot, merge from DESIGN_MANIFEST.json
    if (screenMap.length > 0 && projectId) {
      try {
        const manifestCandidates = resolveRunStitchDirs(run, projectId).map((dir) => join(dir, 'DESIGN_MANIFEST.json'));
        const mp = manifestCandidates.find(p => existsSync(p));
        if (mp) {
          const mfRaw = JSON.parse(readFileSync(mp, 'utf-8'));
          const mfScreens: any[] = Array.isArray(mfRaw) ? mfRaw : (mfRaw.screens || []);
          if (mfScreens.length > 0) {
            const byId = new Map(mfScreens.map((s: any) => [s.screenId || s.id, s]));
            screenMap = screenMap.map((s: any) => {
              const m = byId.get(s.screenId);
              return m ? { ...s, htmlFile: m.htmlFile || m.file || null, screenshotFile: m.screenshot || null, title: m.title || s.name } : s;
            });
          }
        }
      } catch { /* enrich failed */ }
    }

    // FALLBACK 1: Read from DESIGN_MANIFEST.json (design step writes this to repo)
    if (screenMap.length === 0 && projectId) {
      try {
        const candidatePaths = resolveRunStitchDirs(run, projectId).map((dir) => join(dir, 'DESIGN_MANIFEST.json'));
        const manifestPath = candidatePaths.find(p => existsSync(p)) || '';
        if (manifestPath) {
          const manifestRaw = JSON.parse(readFileSync(manifestPath, 'utf-8'));
          const manifestScreens: any[] = Array.isArray(manifestRaw) ? manifestRaw : (manifestRaw.screens || []);
          if (manifestScreens.length > 0) {
            screenMap = manifestScreens.map((s: any) => ({
              screenId: s.screenId || s.id || (s.name || 'screen').replace(/\s+/g, '-').toLowerCase(),
              name: s.title || s.name || s.screenName || 'Screen',
              description: s.description || '',
              type: s.type || s.category || s.deviceType?.toLowerCase() || 'page',
              htmlFile: s.htmlFile || s.file || null,
              screenshotFile: s.screenshot || null,
            }));
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
        const stitchDir3Candidates = resolveRunStitchDirs(run, projectId);
        const stitchDir3 = stitchDir3Candidates.find(d => existsSync(d));
        if (stitchDir3) {
          const htmlFiles = readdirSync(stitchDir3).filter((f: string) => f.endsWith('.html') && f !== 'DESIGN_MANIFEST.json');
          screenMap = htmlFiles.map((f: string) => {
            const screenId = f.replace('.html', '');
            return { screenId, name: 'Screen', description: '', type: 'page', htmlFile: f };
          });
        }
      } catch { /* stitch dir scan failed */ }
    }


    // Only return empty if we truly have no data
    if (!projectId || screenMap.length === 0) {
      res.json({ screens: screenMap, projectId, designSystem, designNotes });
      return;
    }

    // Cache dir for this project's screenshots

    const cacheDir = stitchCacheDir(projectId);
    mkdirSync(cacheDir, { recursive: true });

    const STITCH_SCRIPT = join(PATHS.setfarmRepoDir, 'scripts/stitch-api.mjs');

    // Fix C: skip populate-cache if PNGs already exist in cacheDir
    const { readdirSync: _rds } = await import('fs');
    const existingPngs: string[] = (() => { try { return (_rds(cacheDir) as string[]).filter((f: string) => f.endsWith('.png')); } catch { return []; } })();

    if (existingPngs.length === 0) {
      // Populate cache from repo's stitch/ dir (eager-downloaded during design step)
      // Stitch API deletes screens after hours, so repo-local files are the only reliable source
      try {
        const ctx = parseRunContext(run);
        const repo = ctx.repo || '';
        const repoStitchDir = repo ? join(repo, 'stitch') : '';
        let populated = false;
        if (repoStitchDir) {
          if (existsSync(repoStitchDir)) {
            execFileSync('node', [STITCH_SCRIPT, 'populate-cache', repoStitchDir, cacheDir], { timeout: 15_000, stdio: 'pipe' });
            populated = true;
          }
        }
        // Fallback: worktree deleted — try projects/ dir with basename
        if (!populated && repo) {
          for (const altRepoStitch of resolveRunStitchDirs(run, projectId)) {
            if (altRepoStitch === repoStitchDir || !existsSync(altRepoStitch)) continue;
            execFileSync('node', [STITCH_SCRIPT, 'populate-cache', altRepoStitch, cacheDir], { timeout: 15_000, stdio: 'pipe' });
            populated = true;
            break;
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
      // Try: manifest screenshot field, screenId.png, htmlFile-based
      const candidates = [
        screen.screenshotFile || '',
        screen.screenId + '.png',
        screen.htmlFile ? screen.htmlFile.replace('.html', '.png') : '',
      ].filter(Boolean);
      const screenshotName = candidates.find(f => findRunStitchFile(run, projectId, f)) || null;

      const htmlCandidates = [
        screen.htmlFile || '',
        screen.screenId + '.html',
      ].filter(Boolean);
      const htmlName = htmlCandidates.find(f => findRunStitchFile(run, projectId, f)) || null;

      return {
        ...screen,
        screenId: compactDisplay(screen.screenId || screen.screen_id || screen.id || screen.name || 'screen', 140),
        name: compactDisplay(screen.name || screen.title || screen.screenName || 'Screen', 160),
        title: compactDisplay(screen.title || screen.name || screen.screenName || 'Screen', 160),
        description: compactDisplay(screen.description || '', 260),
        type: compactDisplay(screen.type || screen.deviceType || screen.kind || 'desktop', 100),
        deviceType: compactDisplay(screen.deviceType || screen.type || 'desktop', 100),
        screenshotUrl: screenshotName ? designArtifactUrl(req.params.id, screenshotName) : null,
        htmlUrl: htmlName ? designArtifactUrl(req.params.id, htmlName) : null,
        width: Number(screen.width || 0) || null,
        height: Number(screen.height || 0) || null,
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
    const mcBase = config.internalUrl;
    const res = await fetch(mcBase + '/api/projects/next-port');
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
    runNumber: run.run_number,
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
      runNumber: run.run_number,
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
            const done = run.status === 'completed' ? stories.length : stories.filter((s: any) => ['done', 'verified'].includes(s.status)).length;
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
          const done = run.status === 'completed' ? stories.length : stories.filter((s: any) => ['done', 'verified'].includes(s.status)).length;
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
