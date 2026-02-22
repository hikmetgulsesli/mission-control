import { createHash } from 'crypto';
import { execFile as execFileCb } from 'child_process';
import { promisify } from 'util';
import { readFile } from 'fs/promises';
const execFileAsync = promisify(execFileCb);
const DB_PATH = '/home/setrox/.openclaw/setfarm/setfarm.db';
const STUCK_DETECTION_MS = 10 * 60 * 1000; // 10min - show in UI
const STUCK_THRESHOLD_MS = 15 * 60 * 1000; // 15min - auto-unstick
const MAX_AUTO_UNSTICK = 3;
export { STUCK_DETECTION_MS, STUCK_THRESHOLD_MS, MAX_AUTO_UNSTICK };
// Whitelist validation: IDs must be alphanumeric/dash/underscore (setfarm uses UUIDs and slugs)
const SAFE_ID_RE = /^[a-zA-Z0-9_-]+$/;
function validateId(value, name) {
    if (!value || !SAFE_ID_RE.test(value)) {
        throw new Error(`Invalid ${name}: must be alphanumeric/dash/underscore`);
    }
    return value;
}
function escapeStr(value) {
    // Strip null bytes and control characters (except newline/tab), then escape single quotes
    return value.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '').replace(/'/g, "''");
}
// Note: sqlite3 CLI doesn't support ? parameterized queries.
// Safety: All IDs go through validateId() (alphanumeric whitelist).
// Free-text strings go through escapeStr() (null byte strip + quote escape).
// execFileAsync prevents shell injection (no shell expansion).
async function sqlite3(sql, json = true) {
    const args = [DB_PATH];
    if (json)
        args.push('-json');
    args.push(sql);
    const { stdout } = await execFileAsync('sqlite3', args, {
        timeout: 10000,
        maxBuffer: 1024 * 1024,
    });
    if (!json)
        return stdout.trim();
    const trimmed = stdout.trim();
    if (!trimmed)
        return [];
    return JSON.parse(trimmed);
}
export async function querySetfarmDb(sql) {
    return sqlite3(sql, true);
}
export async function execSetfarmDb(sql) {
    return sqlite3(sql, false);
}
export async function getStuckRuns(thresholdMs = STUCK_DETECTION_MS) {
    const thresholdSec = Math.floor(Number(thresholdMs) / 1000);
    if (!Number.isFinite(thresholdSec) || thresholdSec < 0)
        throw new Error('Invalid threshold');
    const rows = await querySetfarmDb(`
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
      CAST((strftime('%s','now') - strftime('%s', s.updated_at)) AS INTEGER) as stuck_seconds,
      CAST((strftime('%s','now') - strftime('%s', s.created_at)) AS INTEGER) as total_elapsed_seconds
    FROM runs r
    JOIN steps s ON s.run_id = r.id
    WHERE r.status = 'running'
      AND s.status = 'running'
      AND s.updated_at IS NOT NULL
      AND (
        (strftime('%s','now') - strftime('%s', s.updated_at)) > ${thresholdSec}
        OR COALESCE(s.abandoned_count, 0) >= 3
        OR (strftime('%s','now') - strftime('%s', s.created_at)) > 1800
      )
    ORDER BY stuck_seconds DESC;
  `);
    const grouped = {};
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
    // No user input — static query
    const rows = await querySetfarmDb(`
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
      AND (SELECT COUNT(*) FROM steps s WHERE s.run_id = r.id AND s.status = 'failed') > 0;
  `);
    return rows;
}
/**
 * Auto-resume a limbo run: set run status to failed, then resume via CLI
 */
export async function resumeLimboRun(runId) {
    const safeId = validateId(runId, 'runId');
    await execSetfarmDb(`UPDATE runs SET status = 'failed', updated_at = datetime('now') WHERE id = '${safeId}';`);
    await execSetfarmDb('PRAGMA wal_checkpoint(TRUNCATE);');
    try {
        const result = await setfarmCli(['workflow', 'resume', safeId]);
        return { success: true, message: result || 'Resumed' };
    }
    catch (err) {
        return { success: false, message: err.message || String(err) };
    }
}
const ANTFARM_CLI_ENV = {
    ...process.env,
    PATH: `/home/setrox/.local/bin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH || ''}`,
};
async function setfarmCli(args) {
    const { stdout } = await execFileAsync('setfarm', args, {
        env: ANTFARM_CLI_ENV,
        timeout: 30000,
        maxBuffer: 1024 * 1024,
    });
    return stdout.trim();
}
export async function unstickRun(runId, stepId) {
    const safeRunId = validateId(runId, 'runId');
    const whereStep = stepId
        ? `AND s.id = '${validateId(stepId, 'stepId')}'`
        : '';
    const stuckSteps = await querySetfarmDb(`
    SELECT s.id, s.step_id as step_name FROM steps s
    WHERE s.run_id = '${safeRunId}'
      AND s.status = 'running'
      ${whereStep};
  `);
    if (stuckSteps.length === 0) {
        return { success: false, message: 'No stuck steps found', unstuckedSteps: [] };
    }
    const stepIds = stuckSteps.map((s) => `'${validateId(s.id, 'step.id')}'`).join(',');
    // Mark stuck steps as failed
    await execSetfarmDb(`
    UPDATE steps
    SET status = 'failed', updated_at = datetime('now')
    WHERE id IN (${stepIds});
  `);
    // Mark the run as failed
    await execSetfarmDb(`
    UPDATE runs
    SET status = 'failed', updated_at = datetime('now')
    WHERE id = '${safeRunId}';
  `);
    // WAL checkpoint so setfarm CLI sees the changes
    await execSetfarmDb('PRAGMA wal_checkpoint(TRUNCATE);');
    // Resume via setfarm CLI
    try {
        await setfarmCli(['workflow', 'resume', safeRunId]);
    }
    catch (err) {
        console.error(`setfarm resume failed for run ${runId}:`, err.message);
        return {
            success: false,
            message: `Steps marked failed but resume failed: ${err.message}`,
            unstuckedSteps: stuckSteps.map((s) => ({ id: s.id, name: s.step_name })),
        };
    }
    return {
        success: true,
        unstuckedSteps: stuckSteps.map((s) => ({ id: s.id, name: s.step_name })),
    };
}
export async function getRunDetail(runId) {
    const safeId = validateId(runId, 'runId');
    const [runs, steps, stories] = await Promise.all([
        querySetfarmDb(`SELECT * FROM runs WHERE id = '${safeId}';`),
        querySetfarmDb(`SELECT * FROM steps WHERE run_id = '${safeId}' ORDER BY step_index;`),
        querySetfarmDb(`SELECT id, run_id, status FROM stories WHERE run_id = '${safeId}';`),
    ]);
    if (runs.length === 0)
        return null;
    return { run: runs[0], steps, stories };
}
// Known error patterns for diagnosis
const KNOWN_PATTERNS = [
    { pattern: /SSL_ERROR|CERT_HAS_EXPIRED|ERR_CERT|unable to verify.*cert/i,
        cause: 'missing_ssl_cert',
        fixable: true,
        description: 'SSL sertifika sorunu',
        suggestedFix: 'Self-signed cert olustur' },
    { pattern: /EACCES|Permission denied|EPERM/i,
        cause: 'permission_error',
        fixable: false,
        description: 'Dosya/dizin izin hatasi',
        suggestedFix: null },
    { pattern: /rate.?limit|429|too many requests|quota exceeded/i,
        cause: 'rate_limit',
        fixable: true,
        description: 'API rate limit asimi',
        suggestedFix: 'Story skip et ve devam et' },
    { pattern: /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|EAI_AGAIN|network error/i,
        cause: 'network_error',
        fixable: false,
        description: 'Ag baglanti hatasi',
        suggestedFix: null },
    { pattern: /Cannot find module|MODULE_NOT_FOUND|ENOENT.*node_modules/i,
        cause: 'dependency_error',
        fixable: true,
        description: 'Eksik npm paketi',
        suggestedFix: 'npm install calistir' },
    { pattern: /missing.*tool|tool.*not.*found|command not found/i,
        cause: 'missing_tool',
        fixable: false,
        description: 'Gerekli tool/komut bulunamadi',
        suggestedFix: null },
    { pattern: /\[missing:\s*\w+\]/i,
        cause: 'missing_context_var',
        fixable: false,
        description: 'Onceki step gerekli output uretmedi (orn: PR URL)',
        suggestedFix: null },
];
export async function diagnoseStuckStep(runId, stepId) {
    const safeRunId = validateId(runId, 'runId');
    const stepFilter = stepId ? `AND s.id = '${validateId(stepId, 'stepId')}'` : '';
    // Get step details
    const steps = await querySetfarmDb(`
    SELECT s.*, r.workflow_id FROM steps s
    JOIN runs r ON r.id = s.run_id
    WHERE s.run_id = '${safeRunId}' ${stepFilter}
    ORDER BY s.updated_at ASC LIMIT 1;
  `);
    if (steps.length === 0) {
        return { stepId, cause: 'not_found', fixable: false, description: 'Step bulunamadi', excerpt: '', suggestedFix: null };
    }
    const step = steps[0];
    let textToAnalyze = '';
    // 1. Check step output
    if (step.output) {
        textToAnalyze += step.output;
    }
    // 2. Check recent setfarm logs
    try {
        const logPath = '/home/setrox/.openclaw/setfarm/logs/setfarm.log';
        const logContent = await readFile(logPath, 'utf-8');
        const logTail = logContent.split('\n').slice(-100).join('\n');
        textToAnalyze += '\n' + logTail;
    }
    catch {
        // Log file might not exist
    }
    // 3. Try reading session transcript if we have a story id
    if (step.current_story_id) {
        try {
            const sessionsDir = '/home/setrox/.openclaw/sessions';
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
                }
                catch {
                    continue;
                }
            }
        }
        catch {
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
        description: 'Bilinmeyen hata',
        excerpt: textToAnalyze.slice(-200).replace(/\n/g, ' ').trim(),
        suggestedFix: null,
    };
}
export async function tryAutoFix(runId, cause, storyId) {
    const fixes = {
        missing_ssl_cert: async () => {
            try {
                await execFileAsync('bash', ['-c', `
          mkdir -p /etc/nginx/ssl &&
          openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout /etc/nginx/ssl/origin.key \
            -out /etc/nginx/ssl/origin.pem \
            -subj "/C=TR/ST=Local/L=Local/O=OpenClaw/CN=localhost" 2>&1
        `], { timeout: 15000 });
                console.log(`[MEDIC] Auto-fix: missing_ssl_cert -> self-signed cert created`);
                return { success: true, message: 'Self-signed SSL cert olusturuldu' };
            }
            catch (err) {
                console.error(`[MEDIC] Auto-fix: missing_ssl_cert -> FAILED: ${err.message}`);
                return { success: false, message: `SSL cert olusturulamadi: ${err.message}` };
            }
        },
        dependency_error: async () => {
            try {
                await execFileAsync('npm', ['install'], {
                    timeout: 60000,
                    cwd: '/home/setrox/.openclaw/setfarm',
                    env: ANTFARM_CLI_ENV,
                });
                console.log(`[MEDIC] Auto-fix: dependency_error -> npm install ok`);
                return { success: true, message: 'npm install basarili' };
            }
            catch (err) {
                console.error(`[MEDIC] Auto-fix: dependency_error -> FAILED: ${err.message}`);
                return { success: false, message: `npm install basarisiz: ${err.message}` };
            }
        },
        rate_limit: async () => {
            if (storyId) {
                const safeStoryId = validateId(storyId, 'storyId');
                await execSetfarmDb(`
          UPDATE stories SET status = 'done', output = 'SKIPPED: rate limit'
          WHERE id = '${safeStoryId}';
        `);
                console.log(`[MEDIC] Auto-fix: rate_limit -> story ${storyId} skipped`);
                return { success: true, message: `Story ${storyId} skip edildi (rate limit)` };
            }
            return { success: false, message: 'Story ID bulunamadi, skip yapilamadi' };
        },
    };
    const fixFn = fixes[cause];
    if (!fixFn) {
        return { success: false, message: `${cause} icin auto-fix tanimli degil` };
    }
    const result = await fixFn();
    if (result.success) {
        await unstickRun(runId);
        console.log(`[MEDIC] Auto-fix: ${cause} -> unstick triggered for run ${runId}`);
    }
    return result;
}
export async function skipStory(runId, storyId, reason) {
    const safeStoryId = validateId(storyId, 'storyId');
    const safeReason = escapeStr(reason).slice(0, 200);
    await execSetfarmDb(`
    UPDATE stories SET status = 'done', output = 'SKIPPED: ${safeReason}'
    WHERE id = '${safeStoryId}';
  `);
    await unstickRun(runId);
    console.log(`[MEDIC] Skip story: ${storyId} reason=${reason}, run ${runId} unsticked`);
    return { success: true, message: `Story ${storyId} skip edildi: ${reason}` };
}
// === Pipeline Loop Prevention (v4) ===
const CLAIM_LOOP_THRESHOLD = 5;
export async function detectInfiniteLoop(runId) {
    const safeId = validateId(runId, 'runId');
    const rows = await querySetfarmDb(`
    SELECT
      s.id as step_id,
      s.step_id as step_name,
      s.status,
      COALESCE(s.abandoned_count, 0) as abandoned_count,
      COALESCE(s.retry_count, 0) as retry_count
    FROM steps s
    WHERE s.run_id = '${safeId}'
      AND s.status IN ('running', 'pending')
      AND (COALESCE(s.abandoned_count, 0) + COALESCE(s.retry_count, 0)) >= ${CLAIM_LOOP_THRESHOLD}
  `);
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
export async function checkMissingInput(runId) {
    const safeId = validateId(runId, 'runId');
    const rows = await querySetfarmDb(`
    SELECT
      s.id as step_id,
      s.step_id as step_name,
      s.input_template,
      s.status
    FROM steps s
    WHERE s.run_id = '${safeId}'
      AND s.status IN ('running', 'pending')
  `);
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
export async function failEntireRun(runId, reason) {
    const safeId = validateId(runId, 'runId');
    const safeReason = escapeStr(reason).slice(0, 500);
    // Fail all non-done steps
    await execSetfarmDb(`
    UPDATE steps SET status = 'failed', output = '${safeReason}', updated_at = datetime('now')
    WHERE run_id = '${safeId}' AND status NOT IN ('done', 'failed');
  `);
    // Fail the run itself
    await execSetfarmDb(`
    UPDATE runs SET status = 'failed', updated_at = datetime('now')
    WHERE id = '${safeId}';
  `);
    // WAL checkpoint
    await execSetfarmDb('PRAGMA wal_checkpoint(TRUNCATE);');
    // Discord alert
    try {
        await execFileAsync('bash', ['/home/setrox/.openclaw/scripts/discord-log.sh',
            `Pipeline FAILED: Run ${runId} - ${reason}`
        ], { timeout: 10000, env: ANTFARM_CLI_ENV });
    }
    catch {
        // Discord alert is best-effort
    }
    console.warn(`[MEDIC] failEntireRun: ${runId} - ${reason}`);
    return { success: true, message: `Run ${runId} failed: ${reason}` };
}
// === Agent Feed (chat-style agent output log) ===
export async function ensureAgentFeedTable() {
    await execSetfarmDb(`
    CREATE TABLE IF NOT EXISTS agent_feed (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id TEXT NOT NULL,
      agent_name TEXT NOT NULL,
      message TEXT NOT NULL,
      session_id TEXT,
      msg_hash TEXT UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
    await execSetfarmDb(`CREATE INDEX IF NOT EXISTS idx_agent_feed_created ON agent_feed(created_at DESC);`);
}
export async function insertFeedEntry(agentId, agentName, message, sessionId) {
    const safeAgentId = validateId(agentId, 'agentId');
    const safeAgentName = escapeStr(agentName).slice(0, 50);
    const safeMessage = escapeStr(message).slice(0, 500);
    const safeSessionId = sessionId ? escapeStr(sessionId).slice(0, 100) : '';
    const hash = createHash('md5').update(safeAgentId + safeSessionId + safeMessage).digest('hex');
    try {
        await execSetfarmDb(`
      INSERT OR IGNORE INTO agent_feed (agent_id, agent_name, message, session_id, msg_hash)
      VALUES ('${safeAgentId}', '${safeAgentName}', '${safeMessage}', '${safeSessionId}', '${hash}');
    `);
        return true;
    }
    catch {
        return false;
    }
}
export async function getAgentFeed(limit = 100) {
    const safeLimit = Math.min(Math.max(1, Number(limit) || 100), 500);
    return querySetfarmDb(`SELECT * FROM agent_feed ORDER BY created_at DESC LIMIT ${safeLimit};`);
}
export async function pruneAgentFeed(keep = 5000) {
    const safeKeep = Math.max(100, Number(keep) || 5000);
    await execSetfarmDb(`
    DELETE FROM agent_feed WHERE id NOT IN (
      SELECT id FROM agent_feed ORDER BY created_at DESC LIMIT ${safeKeep}
    );
  `);
}
