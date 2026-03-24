/**
 * Benchmark & Geri Bildirim — Pipeline run sonuclari ile PRD kalitesi
 * arasindaki iliskiyi analiz eder.
 *
 * setfarm.db'den: runs, steps, stories, claim_log tablolari
 */

import { execFile as execFileCb } from 'child_process';
import { promisify } from 'util';
import { homedir } from 'os';
import { join } from 'path';
import { sql } from '../utils/pg.js';

const execFileAsync = promisify(execFileCb);

const USE_PG = process.env.DB_BACKEND === 'postgres';
const SETFARM_DB = join(homedir(), '.openclaw', 'setfarm', 'setfarm.db');

async function querySetfarm(sqlStr: string): Promise<any[]> {
  const { stdout } = await execFileAsync('sqlite3', [SETFARM_DB, '-json', sqlStr], {
    timeout: 10000,
    maxBuffer: 2 * 1024 * 1024,
  });
  const trimmed = stdout.trim();
  if (!trimmed) return [];
  return JSON.parse(trimmed);
}

export interface RunBenchmark {
  runId: string;
  workflowId: string;
  status: string;
  totalSteps: number;
  completedSteps: number;
  failedSteps: number;
  totalStories: number;
  completedStories: number;
  failedStories: number;
  totalDurationMin: number;
  avgStoryDurationMin: number;
  abandonCount: number;
  retryCount: number;
  errorCategories: Record<string, number>;
}

export async function getRunBenchmark(runId: string): Promise<RunBenchmark | null> {
  // Validate run ID
  if (!runId || !/^[a-zA-Z0-9_-]+$/.test(runId)) {
    throw new Error('Invalid runId');
  }

  let run: any;
  let steps: any[];
  let stories: any[];
  let claims: any[];

  if (USE_PG) {
    // PG path
    const runs = await sql`SELECT id, workflow_id, status, created_at, updated_at FROM runs WHERE id = ${runId}`;
    if (runs.length === 0) return null;
    run = runs[0];

    steps = await sql`SELECT id, step_id, status, retry_count, abandoned_count, created_at, updated_at FROM steps WHERE run_id = ${runId}`;
    stories = await sql`SELECT id, status, retry_count, abandoned_count, output, created_at, updated_at FROM stories WHERE run_id = ${runId}`;
    claims = await sql`SELECT outcome, diagnostic, duration_ms FROM claim_log WHERE run_id = ${runId}`;
  } else {
    // SQLite path
    const runs = await querySetfarm(`SELECT id, workflow_id, status, created_at, updated_at FROM runs WHERE id = '${runId}'`);
    if (runs.length === 0) return null;
    run = runs[0];

    steps = await querySetfarm(`SELECT id, step_id, status, retry_count, abandoned_count, created_at, updated_at FROM steps WHERE run_id = '${runId}'`);
    stories = await querySetfarm(`SELECT id, status, retry_count, abandoned_count, output, created_at, updated_at FROM stories WHERE run_id = '${runId}'`);
    claims = await querySetfarm(`SELECT outcome, diagnostic, duration_ms FROM claim_log WHERE run_id = '${runId}'`);
  }

  // Calculate metrics
  const totalSteps = steps.length;
  const completedSteps = steps.filter((s: any) => s.status === 'done' || s.status === 'completed').length;
  const failedSteps = steps.filter((s: any) => s.status === 'failed').length;

  const totalStories = stories.length;
  const completedStories = stories.filter((s: any) => s.status === 'done' || s.status === 'completed' || s.status === 'verified').length;
  const failedStories = stories.filter((s: any) => s.status === 'failed').length;

  // Duration
  const startTime = new Date(run.created_at).getTime();
  const endTime = new Date(run.updated_at).getTime();
  const totalDurationMin = Math.round((endTime - startTime) / 60000);

  // Avg story duration
  const storyDurations = stories
    .filter((s: any) => s.created_at && s.updated_at)
    .map((s: any) => (new Date(s.updated_at).getTime() - new Date(s.created_at).getTime()) / 60000);
  const avgStoryDurationMin = storyDurations.length > 0
    ? Math.round(storyDurations.reduce((a: number, b: number) => a + b, 0) / storyDurations.length)
    : 0;

  // Abandon and retry counts
  const abandonCount = claims.filter((c: any) => c.outcome === 'abandoned').length;
  const retryCount = steps.reduce((sum: number, s: any) => sum + (s.retry_count || 0), 0)
    + stories.reduce((sum: number, s: any) => sum + (s.retry_count || 0), 0);

  // Error categories from diagnostics
  const errorCategories: Record<string, number> = {};
  for (const claim of claims) {
    if (claim.outcome === 'abandoned' || claim.outcome === 'failed') {
      const diag = (claim.diagnostic || '').toLowerCase();
      if (diag.includes('timeout')) errorCategories['timeout'] = (errorCategories['timeout'] || 0) + 1;
      else if (diag.includes('missing')) errorCategories['missing_input'] = (errorCategories['missing_input'] || 0) + 1;
      else if (diag.includes('lint') || diag.includes('eslint')) errorCategories['lint_error'] = (errorCategories['lint_error'] || 0) + 1;
      else if (diag.includes('test') || diag.includes('vitest')) errorCategories['test_failure'] = (errorCategories['test_failure'] || 0) + 1;
      else if (diag.includes('build') || diag.includes('compile')) errorCategories['build_error'] = (errorCategories['build_error'] || 0) + 1;
      else if (diag.includes('merge') || diag.includes('conflict')) errorCategories['merge_conflict'] = (errorCategories['merge_conflict'] || 0) + 1;
      else errorCategories['other'] = (errorCategories['other'] || 0) + 1;
    }
  }

  // Story output error analysis
  for (const story of stories) {
    if (story.status === 'failed' && story.output) {
      const out = (story.output || '').toLowerCase();
      if (out.includes('design') || out.includes('stitch')) errorCategories['design_mismatch'] = (errorCategories['design_mismatch'] || 0) + 1;
    }
  }

  return {
    runId,
    workflowId: run.workflow_id,
    status: run.status,
    totalSteps,
    completedSteps,
    failedSteps,
    totalStories,
    completedStories,
    failedStories,
    totalDurationMin,
    avgStoryDurationMin,
    abandonCount,
    retryCount,
    errorCategories,
  };
}

export interface PrdFormatAnalysis {
  totalRuns: number;
  successRate: number;
  avgDurationMin: number;
  avgStories: number;
  avgRetries: number;
  avgAbandons: number;
  topErrors: { category: string; count: number }[];
  recommendation: string;
}

export async function analyzePrdFormats(): Promise<PrdFormatAnalysis> {
  let runs: any[];
  if (USE_PG) {
    runs = await sql`SELECT id, status, created_at, updated_at FROM runs ORDER BY created_at DESC LIMIT 50`;
  } else {
    runs = await querySetfarm(`SELECT id, status, created_at, updated_at FROM runs ORDER BY created_at DESC LIMIT 50`);
  }

  let successCount = 0;
  let totalDuration = 0;
  let totalStories = 0;
  let totalRetries = 0;
  let totalAbandons = 0;
  const allErrors: Record<string, number> = {};

  for (const run of runs) {
    try {
      const benchmark = await getRunBenchmark(run.id);
      if (!benchmark) continue;

      if (benchmark.status === 'completed' || benchmark.status === 'done') successCount++;
      totalDuration += benchmark.totalDurationMin;
      totalStories += benchmark.totalStories;
      totalRetries += benchmark.retryCount;
      totalAbandons += benchmark.abandonCount;

      for (const [cat, count] of Object.entries(benchmark.errorCategories)) {
        allErrors[cat] = (allErrors[cat] || 0) + count;
      }
    } catch {
      // Skip runs that fail to benchmark
    }
  }

  const n = runs.length || 1;
  const topErrors = Object.entries(allErrors)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([category, count]) => ({ category, count }));

  const successRate = Math.round((successCount / n) * 100);

  let recommendation = '';
  if (topErrors[0]?.category === 'timeout') {
    recommendation = 'PRD daha kisa ve odakli olmali — agent timeout orani yuksek';
  } else if (topErrors[0]?.category === 'lint_error') {
    recommendation = 'PRD tech stack ve lint kurallarini acikca belirtmeli';
  } else if (topErrors[0]?.category === 'build_error') {
    recommendation = 'PRD dependency ve build setup talimatlarini icermeli';
  } else if (topErrors[0]?.category === 'design_mismatch') {
    recommendation = 'PRD daha detayli tasarim tanimlari icermeli (renkler, fontlar, spacing)';
  } else if (successRate >= 80) {
    recommendation = 'PRD kalitesi iyi — mevcut formati koruyun';
  } else {
    recommendation = 'PRD puanlama ile skor 70+ olana kadar gelistirin';
  }

  return {
    totalRuns: n,
    successRate,
    avgDurationMin: Math.round(totalDuration / n),
    avgStories: Math.round(totalStories / n),
    avgRetries: Math.round(totalRetries / n),
    avgAbandons: Math.round(totalAbandons / n),
    topErrors,
    recommendation,
  };
}
