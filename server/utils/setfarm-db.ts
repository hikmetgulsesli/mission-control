import { homedir } from 'os';
import path from 'path';
import { createHash } from 'crypto';
import { execFile as execFileCb } from 'child_process';
import { promisify } from 'util';
import { readdir, readFile, stat } from 'fs/promises';
import { sql } from './pg.js';

const execFileAsync = promisify(execFileCb);

const STUCK_DETECTION_MS = 10 * 60 * 1000;  // 10min - show in UI
const STUCK_THRESHOLD_MS = 15 * 60 * 1000;  // 15min - auto-unstick
const MAX_AUTO_UNSTICK = 3;

export { STUCK_DETECTION_MS, STUCK_THRESHOLD_MS, MAX_AUTO_UNSTICK };

// Whitelist validation: IDs must be alphanumeric/dash/underscore (setfarm uses UUIDs and slugs)
const SAFE_ID_RE = /^[a-zA-Z0-9_-]+$/;
const FILE_TREE_LIMIT = 700;
const GIT_LOG_LIMIT = 25;
const DIFF_FILE_LIMIT = 80;
const TREE_EXCLUDES = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  '.next',
  '.turbo',
  'coverage',
  '.cache',
]);

function validateId(value: string, name: string): string {
  if (!value || !SAFE_ID_RE.test(value)) {
    throw new Error(`Invalid ${name}: must be alphanumeric/dash/underscore`);
  }
  return value;
}

function escapeStr(value: string): string {
  // Strip null bytes and control characters (except newline/tab), then escape single quotes
  return value.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '').replace(/'/g, "''");
}

function safeJson(value: unknown, fallback: any = null): any {
  if (value == null || value === '') return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function parseRunContext(run: any): Record<string, any> {
  const parsed = safeJson(run?.context, {});
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
}

function expandRuntimePath(value: string): string {
  return value
    .replace(/^\$HOME(?=\/|$)/, homedir())
    .replace(/^~(?=\/|$)/, homedir());
}

function repoPathForRun(run: any): string | null {
  const context = parseRunContext(run);
  const candidates = [context.repo, context.REPO, context.project_path, context.workdir];
  for (const candidate of candidates) {
    if (typeof candidate !== 'string' || !candidate.trim()) continue;
    return expandRuntimePath(candidate.trim());
  }
  return null;
}

function parseJsonList(value: unknown): any[] {
  if (Array.isArray(value)) return value;
  const parsed = safeJson(value, null);
  if (Array.isArray(parsed)) return parsed;
  if (typeof value === 'string' && value.trim()) {
    return value
      .split(/\r?\n|,/)
      .map((item) => item.replace(/^[-*]\s*/, '').trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeStoryRow(story: any): any {
  const acceptanceCriteria = parseJsonList(story.acceptance_criteria);
  const scopeFiles = parseJsonList(story.scope_files).map(String).filter(Boolean);
  const sharedFiles = parseJsonList(story.shared_files).map(String).filter(Boolean);
  const dependsOn = parseJsonList(story.depends_on).map(String).filter(Boolean);
  const storyScreens = parseJsonList(story.story_screens);
  return {
    ...story,
    storyId: story.story_id || story.storyId || story.id,
    title: story.title || story.story_id || story.id,
    description: story.description || '',
    acceptanceCriteria,
    scopeFiles,
    sharedFiles,
    dependsOn,
    storyScreens,
    retryCount: Number(story.retry_count || 0),
    maxRetries: Number(story.max_retries || 0),
    output: story.output || '',
    prUrl: story.pr_url || null,
    mergeStatus: story.merge_status || null,
  };
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

async function fallbackFileTree(root: string): Promise<string[]> {
  const files: string[] = [];
  async function walk(dir: string, rel = '', depth = 0): Promise<void> {
    if (files.length >= FILE_TREE_LIMIT || depth > 8) return;
    let entries: any[];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (files.length >= FILE_TREE_LIMIT) return;
      if (TREE_EXCLUDES.has(entry.name)) continue;
      const entryRel = rel ? `${rel}/${entry.name}` : entry.name;
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(entryPath, entryRel, depth + 1);
      } else if (entry.isFile()) {
        files.push(entryRel);
      }
    }
  }
  await walk(root);
  return files.sort();
}

async function readRepoFileTree(repo: string | null): Promise<string[]> {
  if (!repo || !(await pathExists(repo))) return [];
  try {
    const { stdout } = await execFileAsync('git', ['-C', repo, 'ls-files'], {
      timeout: 5000,
      maxBuffer: 2 * 1024 * 1024,
    });
    const files = stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (files.length > 0) return files.slice(0, FILE_TREE_LIMIT);
  } catch {
    // Non-git project directories still deserve a file tree in Mission Control.
  }
  return fallbackFileTree(repo);
}

async function readGitLog(repo: string | null): Promise<any[]> {
  if (!repo || !(await pathExists(path.join(repo, '.git')))) return [];
  try {
    const { stdout } = await execFileAsync('git', [
      '-C',
      repo,
      'log',
      `--max-count=${GIT_LOG_LIMIT}`,
      '--date=iso-strict',
      '--pretty=format:%h%x1f%ad%x1f%an%x1f%s',
    ], { timeout: 5000, maxBuffer: 1024 * 1024 });
    return stdout.split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        const [hash, date, author, ...messageParts] = line.split('\x1f');
        return { hash, date, author, message: messageParts.join('\x1f') };
      })
      .filter((commit) => commit.hash);
  } catch {
    return [];
  }
}

async function readDiffStats(repo: string | null, commits: any[]): Promise<any[]> {
  if (!repo || commits.length === 0) return [];
  const result: any[] = [];
  for (const commit of commits.slice(0, 12)) {
    try {
      const { stdout } = await execFileAsync('git', ['-C', repo, 'show', '--name-only', '--format=', '-n', '1', commit.hash], {
        timeout: 5000,
        maxBuffer: 512 * 1024,
      });
      const files = stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, DIFF_FILE_LIMIT);
      result.push({ hash: commit.hash, files });
    } catch {
      result.push({ hash: commit.hash, files: [] });
    }
  }
  return result;
}

function buildAgentChatsFromSteps(steps: any[]): any[] {
  const grouped = new Map<string, any[]>();
  for (const step of steps) {
    const output = String(step.output || '').trim();
    if (!output) continue;
    const agent = String(step.agent_id || step.step_id || 'agent');
    const messages = grouped.get(agent) || [];
    messages.push({
      role: String(step.step_id || 'step'),
      text: output.length > 5000 ? `${output.slice(0, 5000)}...` : output,
      timestamp: step.updated_at || step.created_at,
    });
    grouped.set(agent, messages);
  }
  return [...grouped.entries()].map(([agent, messages]) => ({
    agent,
    sessionId: `${agent}-${messages.length}`,
    messages,
  }));
}

function buildProgressLog(steps: any[], stories: any[]): string {
  const lines: string[] = [];
  for (const step of steps) {
    lines.push(`${step.step_id || step.id}: ${step.status || 'unknown'}`);
  }
  for (const story of stories) {
    lines.push(`${story.story_id || story.id}: ${story.status || 'unknown'} ${story.title || ''}`.trim());
  }
  return lines.join('\n');
}

export async function getStuckRuns(thresholdMs = STUCK_DETECTION_MS) {
  const thresholdSec = Math.floor(Number(thresholdMs) / 1000);
  if (!Number.isFinite(thresholdSec) || thresholdSec < 0) throw new Error('Invalid threshold');

  const rows = await sql`
    SELECT
      r.id as run_id,
      r.workflow_id,
      r.status as run_status,
      s.id as sid,
      s.step_id as step_name,
      s.status as step_status,
      s.updated_at,
      s.created_at,
      s.abandoned_count,
      EXTRACT(EPOCH FROM NOW() - s.updated_at)::INTEGER as stuck_seconds,
      EXTRACT(EPOCH FROM NOW() - s.created_at)::INTEGER as total_elapsed_seconds
    FROM runs r
    JOIN steps s ON s.run_id = r.id
    WHERE r.status = 'running'
      AND s.status = 'running'
      AND s.updated_at IS NOT NULL
      AND (
        EXTRACT(EPOCH FROM NOW() - s.updated_at) > ${thresholdSec}
        OR COALESCE(s.abandoned_count, 0) >= 3
        OR EXTRACT(EPOCH FROM NOW() - s.created_at) > 1800
      )
    ORDER BY stuck_seconds DESC
  `;

  const grouped: Record<string, any> = {};
  for (const row of rows) {
    if (!grouped[row.run_id]) {
      grouped[row.run_id] = {
        id: row.run_id,
        workflowId: row.workflow_id,
        status: row.run_status,
        stuckSteps: [],
      };
    }
    grouped[row.run_id].stuckSteps.push({
      id: row.sid,
      name: row.step_name,
      status: row.step_status,
      updatedAt: row.updated_at,
      abandonResets: row.abandoned_count || 0,
      stuckMinutes: Math.floor(row.stuck_seconds / 60),
      totalElapsedMinutes: Math.floor((row.total_elapsed_seconds || 0) / 60),
      stuckReason: (row.abandoned_count || 0) >= 3 ? 'restart-loop' : (row.total_elapsed_seconds || 0) > 1800 ? 'total-elapsed' : 'classic',
    });
  }

  return Object.values(grouped);
}


/**
 * Find runs stuck in limbo: run is "running" but has no "running" steps
 * (all remaining steps are "failed" or "cancelled"). This happens after
 * gateway restarts or cancel+resume operations.
 */
export async function getLimboRuns() {
  return sql`
    SELECT
      r.id as run_id,
      r.workflow_id,
      r.status as run_status,
      r.updated_at,
      (SELECT COUNT(*) FROM steps s WHERE s.run_id = r.id AND s.status = 'running') as running_steps,
      (SELECT COUNT(*) FROM steps s WHERE s.run_id = r.id AND s.status = 'failed') as failed_steps,
      (SELECT COUNT(*) FROM steps s WHERE s.run_id = r.id AND s.status = 'done') as done_steps,
      (SELECT MIN(s.step_id) FROM steps s WHERE s.run_id = r.id AND s.status = 'failed') as first_failed_step
    FROM runs r
    WHERE r.status = 'running'
      AND (SELECT COUNT(*) FROM steps s WHERE s.run_id = r.id AND s.status = 'running') = 0
      AND (SELECT COUNT(*) FROM steps s WHERE s.run_id = r.id AND s.status = 'failed') > 0
  `;
}

export async function getRunDetail(runId: string) {
  const safeId = validateId(runId, 'runId');

  const [runs, steps, stories] = await Promise.all([
    sql`SELECT * FROM runs WHERE id = ${safeId}`,
    sql`SELECT * FROM steps WHERE run_id = ${safeId} ORDER BY step_index`,
    sql`SELECT * FROM stories WHERE run_id = ${safeId} ORDER BY story_index`,
  ]);

  if (runs.length === 0) return null;
  const run = runs[0];
  const repo = repoPathForRun(run);
  const normalizedStories = stories.map(normalizeStoryRow);
  const gitLog = await readGitLog(repo);
  const [fileTree, diffStats] = await Promise.all([
    readRepoFileTree(repo),
    readDiffStats(repo, gitLog),
  ]);

  return {
    id: run.id,
    workflow: run.workflow_id,
    status: run.status,
    task: run.task,
    storyCount: normalizedStories.length,
    run,
    steps,
    fullSteps: steps,
    stories: normalizedStories,
    gitLog,
    diffStats,
    fileTree,
    agentChats: buildAgentChatsFromSteps(steps),
    progressLog: buildProgressLog(steps, stories),
  };
}

// Known error patterns for diagnosis
const KNOWN_PATTERNS = [
  { pattern: /SSL_ERROR|CERT_HAS_EXPIRED|ERR_CERT|unable to verify.*cert/i,
    cause: 'missing_ssl_cert',
    fixable: true,
    description: 'SSL certificate issue',
    suggestedFix: 'Create a self-signed certificate' },
  { pattern: /EACCES|Permission denied|EPERM/i,
    cause: 'permission_error',
    fixable: false,
    description: 'File or directory permission error',
    suggestedFix: null },
  { pattern: /rate.?limit|429|too many requests|quota exceeded/i,
    cause: 'rate_limit',
    fixable: true,
    description: 'API rate limit exceeded',
    suggestedFix: 'Skip the story and continue' },
  { pattern: /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|EAI_AGAIN|network error/i,
    cause: 'network_error',
    fixable: false,
    description: 'Network connection error',
    suggestedFix: null },
  { pattern: /Cannot find module|MODULE_NOT_FOUND|ENOENT.*node_modules/i,
    cause: 'dependency_error',
    fixable: true,
    description: 'Missing npm package',
    suggestedFix: 'Run npm install' },
  { pattern: /missing.*tool|tool.*not.*found|command not found/i,
    cause: 'missing_tool',
    fixable: false,
    description: 'Required tool or command not found',
    suggestedFix: null },
  { pattern: /\[missing:\s*\w+\]/i,
    cause: 'missing_context_var',
    fixable: false,
    description: 'Previous step did not produce required output, such as a PR URL',
    suggestedFix: null },
];

export async function diagnoseStuckStep(runId: string, stepId?: string) {
  const safeRunId = validateId(runId, 'runId');

  let steps: any[];

  if (stepId) {
    const safeStepId = validateId(stepId, 'stepId');
    steps = await sql`
      SELECT s.*, r.workflow_id FROM steps s
      JOIN runs r ON r.id = s.run_id
      WHERE s.run_id = ${safeRunId} AND s.id = ${safeStepId}
      ORDER BY s.updated_at ASC LIMIT 1
    `;
  } else {
    steps = await sql`
      SELECT s.*, r.workflow_id FROM steps s
      JOIN runs r ON r.id = s.run_id
      WHERE s.run_id = ${safeRunId}
      ORDER BY s.updated_at ASC LIMIT 1
    `;
  }

  if (steps.length === 0) {
    return { stepId, cause: 'not_found', fixable: false, description: 'Step not found', excerpt: '', suggestedFix: null };
  }

  const step = steps[0];
  let textToAnalyze = '';

  // 1. Check step output
  if (step.output) {
    textToAnalyze += step.output;
  }

  // 2. Check recent setfarm logs
  try {
    const logPath = path.join(homedir(), '.openclaw/setfarm/logs/setfarm.log');
    const logContent = await readFile(logPath, 'utf-8');
    const logTail = logContent.split('\n').slice(-100).join('\n');
    textToAnalyze += '\n' + logTail;
  } catch {
    // Log file might not exist
  }

  // 3. Try reading session transcript if we have a story id
  if (step.current_story_id) {
    try {
      const sessionsDir = path.join(homedir(), '.openclaw/sessions');
      const { stdout } = await execFileAsync('bash', ['-c',
        `ls -t "${sessionsDir}" 2>/dev/null | head -5`
      ], { timeout: 5000 });
      const recentSessions = stdout.trim().split('\n').filter(Boolean);
      for (const sid of recentSessions) {
        try {
          const transcript = await readFile(`${sessionsDir}/${sid}/transcript.md`, 'utf-8');
          const transcriptTail = transcript.split('\n').slice(-200).join('\n');
          textToAnalyze += '\n' + transcriptTail;
          break; // Use the most recent session
        } catch {
          continue;
        }
      }
    } catch {
      // Session dir might not exist
    }
  }

  // Match against known patterns
  for (const kp of KNOWN_PATTERNS) {
    const match = textToAnalyze.match(kp.pattern);
    if (match) {
      const matchIdx = textToAnalyze.indexOf(match[0]);
      const start = Math.max(0, matchIdx - 80);
      const end = Math.min(textToAnalyze.length, matchIdx + match[0].length + 80);
      const excerpt = textToAnalyze.slice(start, end).replace(/\n/g, ' ').trim();

      return {
        stepId: step.id,
        storyId: step.current_story_id || null,
        cause: kp.cause,
        fixable: kp.fixable,
        description: kp.description,
        excerpt: excerpt.length > 200 ? excerpt.slice(0, 200) + '...' : excerpt,
        suggestedFix: kp.suggestedFix,
      };
    }
  }

  return {
    stepId: step.id,
    storyId: step.current_story_id || null,
    cause: 'unknown',
    fixable: false,
    description: 'Unknown error',
    excerpt: textToAnalyze.slice(-200).replace(/\n/g, ' ').trim(),
    suggestedFix: null,
  };
}

// === Pipeline Loop Prevention (v4) ===

const CLAIM_LOOP_THRESHOLD = 5;

export async function detectInfiniteLoop(runId: string) {
  const safeId = validateId(runId, 'runId');

  const rows = await sql`
    SELECT
      s.id as step_id,
      s.step_id as step_name,
      s.status,
      COALESCE(s.abandoned_count, 0) as abandoned_count,
      COALESCE(s.retry_count, 0) as retry_count
    FROM steps s
    WHERE s.run_id = ${safeId}
      AND s.status IN ('running', 'pending')
      AND (COALESCE(s.abandoned_count, 0) + COALESCE(s.retry_count, 0)) >= ${CLAIM_LOOP_THRESHOLD}
  `;

  if (rows.length === 0) {
    return { isLooping: false };
  }

  const step = rows[0];
  const claimCount = (step.abandoned_count || 0) + (step.retry_count || 0);
  return {
    isLooping: true,
    stepId: step.step_id,
    stepName: step.step_name,
    claimCount,
    reason: `Step '${step.step_name}' claimed ${claimCount} times without completing (threshold: ${CLAIM_LOOP_THRESHOLD})`,
  };
}

export async function checkMissingInput(runId: string) {
  const safeId = validateId(runId, 'runId');

  const rows = await sql`
    SELECT
      s.id as step_id,
      s.step_id as step_name,
      s.input_template,
      s.status
    FROM steps s
    WHERE s.run_id = ${safeId}
      AND s.status IN ('running', 'pending')
  `;

  for (const step of rows) {
    const template = step.input_template || '';
    const missingMatch = template.match(/\[missing:\s*(\w+)\]/i);
    if (missingMatch) {
      return {
        hasMissing: true,
        stepId: step.step_id,
        stepName: step.step_name,
        missingVar: missingMatch[1],
        reason: `Step '${step.step_name}' has unresolved variable: [missing: ${missingMatch[1]}]`,
      };
    }
  }

  return { hasMissing: false };
}

// === Agent Feed (chat-style agent output log) ===

export async function ensureAgentFeedTable(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS agent_feed (
      id SERIAL PRIMARY KEY,
      agent_id TEXT NOT NULL,
      agent_name TEXT NOT NULL,
      message TEXT NOT NULL,
      session_id TEXT,
      msg_hash TEXT UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_agent_feed_created ON agent_feed(created_at DESC)`;
}

export async function insertFeedEntry(agentId: string, agentName: string, message: string, sessionId?: string): Promise<boolean> {
  const safeAgentId = validateId(agentId, 'agentId');
  const safeAgentName = escapeStr(agentName).slice(0, 50);
  const safeMessage = escapeStr(message).slice(0, 500);
  const safeSessionId = sessionId ? escapeStr(sessionId).slice(0, 100) : '';
  const hash = createHash('md5').update(safeAgentId + safeSessionId + safeMessage).digest('hex');

  try {
    await sql`
      INSERT INTO agent_feed (agent_id, agent_name, message, session_id, msg_hash)
      VALUES (${safeAgentId}, ${safeAgentName}, ${safeMessage}, ${safeSessionId}, ${hash})
      ON CONFLICT (msg_hash) DO NOTHING
    `;
    return true;
  } catch {
    return false;
  }
}

export async function getAgentFeed(limit = 100): Promise<any[]> {
  const safeLimit = Math.min(Math.max(1, Number(limit) || 100), 500);
  return sql`SELECT * FROM agent_feed ORDER BY created_at DESC LIMIT ${safeLimit}`;
}

export async function pruneAgentFeed(keep = 5000): Promise<void> {
  const safeKeep = Math.max(100, Number(keep) || 5000);
  await sql`
    DELETE FROM agent_feed WHERE id NOT IN (
      SELECT id FROM agent_feed ORDER BY created_at DESC LIMIT ${safeKeep}
    )
  `;
}

export async function clearAgentFeed(): Promise<void> {
  await sql`DELETE FROM agent_feed`;
}

// D2: Batch story progress (single query replaces N getRunStories calls)
// Wave 1 fix #1 + #9 (plan: reactive-frolicking-cupcake): previously "failed" stories
// were added to the "completed" bucket, which made run #338 show "5/5 stories (100%)"
// even though 2 stories were in merge-conflict limbo. failed and done are now tracked
// in dedicated buckets, and "completed" only sums verified. "done" is excluded
// because under direct-merge it means "implement
// finished, merge pending" — not actually complete from the run's perspective.
export async function getBatchStoryProgress(runIds: string[]): Promise<Record<string, { completed: number; total: number; verified: number; skipped: number; running: number; pending: number; done: number; failed: number }>> {
  if (runIds.length === 0) return {};

  const rows = await sql`
    SELECT run_id, status, COUNT(*)::INTEGER as cnt
    FROM stories
    WHERE run_id = ANY(${runIds})
    GROUP BY run_id, status
  `;

  const result: Record<string, any> = {};
  for (const id of runIds) {
    result[id] = { completed: 0, total: 0, verified: 0, skipped: 0, running: 0, pending: 0, done: 0, failed: 0 };
  }
  for (const row of (rows || [])) {
    if (!result[row.run_id]) continue;
    result[row.run_id].total += row.cnt;
    if (row.status === "verified") { result[row.run_id].verified += row.cnt; result[row.run_id].completed += row.cnt; }
    else if (row.status === "skipped") { result[row.run_id].skipped += row.cnt; result[row.run_id].failed += row.cnt; }
    else if (row.status === "done") { result[row.run_id].done += row.cnt; }
    else if (row.status === "running") result[row.run_id].running += row.cnt;
    else if (row.status === "pending") result[row.run_id].pending += row.cnt;
    else if (row.status === "failed") result[row.run_id].failed += row.cnt;
  }
  return result;
}
