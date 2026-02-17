import { execFile as execFileCb } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFileCb);

const DB_PATH = '/home/setrox/.openclaw/antfarm/antfarm.db';
const STUCK_DETECTION_MS = 10 * 60 * 1000;  // 10min - show in UI
const STUCK_THRESHOLD_MS = 15 * 60 * 1000;  // 15min - auto-unstick
const MAX_AUTO_UNSTICK = 3;

export { STUCK_DETECTION_MS, STUCK_THRESHOLD_MS, MAX_AUTO_UNSTICK };

async function sqlite3(sql: string, json = true): Promise<any> {
  const args = [DB_PATH];
  if (json) args.push('-json');
  args.push(sql);

  const { stdout } = await execFileAsync('sqlite3', args, {
    timeout: 10000,
    maxBuffer: 1024 * 1024,
  });

  if (!json) return stdout.trim();

  const trimmed = stdout.trim();
  if (!trimmed) return [];
  return JSON.parse(trimmed);
}

export async function queryAntfarmDb(sql: string): Promise<any[]> {
  return sqlite3(sql, true);
}

export async function execAntfarmDb(sql: string): Promise<string> {
  return sqlite3(sql, false);
}

export async function getStuckRuns(thresholdMs = STUCK_DETECTION_MS) {
  const thresholdSec = Math.floor(thresholdMs / 1000);
  const rows = await queryAntfarmDb(`
    SELECT
      r.id as run_id,
      r.workflow_id,
      r.status as run_status,
      s.id as sid,
      s.step_id as step_name,
      s.status as step_status,
      s.updated_at,
      s.abandoned_count,
      CAST((strftime('%s','now') - strftime('%s', s.updated_at)) AS INTEGER) as stuck_seconds
    FROM runs r
    JOIN steps s ON s.run_id = r.id
    WHERE r.status = 'running'
      AND s.status = 'running'
      AND s.updated_at IS NOT NULL
      AND (strftime('%s','now') - strftime('%s', s.updated_at)) > ${thresholdSec}
    ORDER BY stuck_seconds DESC;
  `);

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
    });
  }

  return Object.values(grouped);
}

const ANTFARM_CLI_ENV = {
  ...process.env,
  PATH: `/home/setrox/.local/bin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH || ''}`,
};

async function antfarmCli(args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('antfarm', args, {
    env: ANTFARM_CLI_ENV,
    timeout: 30000,
    maxBuffer: 1024 * 1024,
  });
  return stdout.trim();
}

export async function unstickRun(runId: string, stepId?: string) {
  const whereStep = stepId
    ? `AND s.id = '${stepId.replace(/'/g, "''")}'`
    : '';

  const safeRunId = runId.replace(/'/g, "''");

  const stuckSteps = await queryAntfarmDb(`
    SELECT s.id, s.step_id as step_name FROM steps s
    WHERE s.run_id = '${safeRunId}'
      AND s.status = 'running'
      ${whereStep};
  `);

  if (stuckSteps.length === 0) {
    return { success: false, message: 'No stuck steps found', unstuckedSteps: [] };
  }

  const stepIds = stuckSteps.map((s: any) => `'${s.id}'`).join(',');

  // Mark stuck steps as failed
  await execAntfarmDb(`
    UPDATE steps
    SET status = 'failed', updated_at = datetime('now')
    WHERE id IN (${stepIds});
  `);

  // Mark the run as failed
  await execAntfarmDb(`
    UPDATE runs
    SET status = 'failed', updated_at = datetime('now')
    WHERE id = '${safeRunId}';
  `);

  // WAL checkpoint so antfarm CLI sees the changes
  await execAntfarmDb('PRAGMA wal_checkpoint(TRUNCATE);');

  // Resume via antfarm CLI – this re-queues the failed run properly
  try {
    await antfarmCli(['workflow', 'resume', runId]);
  } catch (err: any) {
    console.error(`antfarm resume failed for run ${runId}:`, err.message);
    return {
      success: false,
      message: `Steps marked failed but resume failed: ${err.message}`,
      unstuckedSteps: stuckSteps.map((s: any) => ({ id: s.id, name: s.step_name })),
    };
  }

  return {
    success: true,
    unstuckedSteps: stuckSteps.map((s: any) => ({ id: s.id, name: s.step_name })),
  };
}

export async function getRunDetail(runId: string) {
  const safeRunId = runId.replace(/'/g, "''");

  const [runs, steps, stories] = await Promise.all([
    queryAntfarmDb(`SELECT * FROM runs WHERE id = '${safeRunId}';`),
    queryAntfarmDb(`SELECT * FROM steps WHERE run_id = '${safeRunId}' ORDER BY step_index;`),
    queryAntfarmDb(`SELECT id, run_id, status FROM stories WHERE run_id = '${safeRunId}';`),
  ]);

  if (runs.length === 0) return null;

  return { run: runs[0], steps, stories };
}
