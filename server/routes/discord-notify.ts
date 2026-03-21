import { Router } from 'express';
import { execFile as execFileCb } from 'child_process';
import { promisify } from 'util';
import { sendDiscord } from '../utils/discord.js';

const execFileAsync = promisify(execFileCb);

const router = Router();

// ── Channel ID mapping ──
const CHANNELS = {
  'setfarm-pipeline': process.env.DISCORD_CH_PIPELINE || '',
  'code-changes': process.env.DISCORD_CH_CODECHANGES || '',
  'agent-activity': process.env.DISCORD_CH_ACTIVITY || '',
  'daily-reports': process.env.DISCORD_CH_REPORTS || '',
  'alerts': process.env.DISCORD_CH_ALERTS || '',
  'logs': process.env.DISCORD_CH_LOGS || '',
  'design-reviews': process.env.DISCORD_CH_DESIGN_REVIEWS || '',
};

const GUILD_ID = '1469860814398816397';

// ── Debounce: skip duplicate events within 30s ──
const recentEvents = new Map<string, number>();
const DEBOUNCE_MS = 30_000;

function isDuplicate(key: string): boolean {
  const now = Date.now();
  const last = recentEvents.get(key);
  if (last && now - last < DEBOUNCE_MS) return true;
  recentEvents.set(key, now);
  if (recentEvents.size > 50) {
    const cutoff = now - 5 * 60_000;
    for (const [k, t] of recentEvents) {
      if (t < cutoff) recentEvents.delete(k);
    }
  }
  return false;
}

// ── Git info for code-changes ──
async function getGitSummary(repoPath: string): Promise<string | null> {
  if (!repoPath) return null;
  try {
    const { stdout: logOut } = await execFileAsync('git', [
      '-C', repoPath, 'log', '--oneline', '-5',
    ], { timeout: 5_000 });
    const { stdout: statOut } = await execFileAsync('git', [
      '-C', repoPath, 'diff', '--stat', 'HEAD~5',
    ], { timeout: 5_000 });
    const lastLine = statOut.trim().split('\n').pop() || '';
    return `Repo: ${repoPath}\nCommits:\n${logOut.trim()}\n${lastLine}`;
  } catch {
    return null;
  }
}

// ── Event → channel + message mapping ──
interface NotifyEvent {
  ts?: string;
  event: string;
  runId?: string;
  runNumber?: number;
  workflowId?: string;
  stepId?: string;
  agentId?: string;
  detail?: string;
  storyTitle?: string;
  repoPath?: string;
  duration?: string;
  storyCount?: number;
  retryCount?: number;
  level?: string;
}

function formatMessage(ev: NotifyEvent): { channel: string; message: string }[] | null {
  const wf = ev.workflowId || '?';
  const num = ev.runNumber ? `#${ev.runNumber}` : (ev.runId ? `(${ev.runId.slice(0, 8)})` : '');
  const title = ev.storyTitle ? ` — "${ev.storyTitle}"` : '';
  const agent = ev.agentId || '?';
  const dur = ev.duration ? ` (${ev.duration})` : '';
  const detail = ev.detail || '';

  switch (ev.event) {
    case 'run.started':
      return [{ channel: 'setfarm-pipeline', message: `🚀 **${wf} ${num} basladi**${title}` }];

    case 'run.completed':
      return [{ channel: 'setfarm-pipeline', message: `✅ **${wf} ${num} tamamlandi**${dur}${ev.storyCount ? ` — ${ev.storyCount} stories` : ''}` }];

    case 'run.failed':
      return [{ channel: 'setfarm-pipeline', message: `❌ **${wf} ${num} basarisiz** — step: ${ev.stepId || '?'}${ev.retryCount ? `, retry: ${ev.retryCount}` : ''}` }];

    case 'step.running':
      return [{ channel: 'agent-activity', message: `🔄 \`${wf}_${agent}\` calisiyor — ${ev.stepId || '?'} step` }];

    case 'step.done': {
      const msgs: { channel: string; message: string }[] = [
        { channel: 'agent-activity', message: `✅ \`${wf}_${agent}\` bitti — ${ev.stepId || '?'} step${dur}` },
      ];
      // PR lifecycle events → #code-changes
      const stepId = ev.stepId || '';
      if (stepId === 'pr') {
        msgs.push({ channel: 'code-changes', message: `🔗 PR acildi: ${detail || wf + ' ' + num}` });
      } else if (stepId === 'review') {
        msgs.push({ channel: 'code-changes', message: `📋 Review: ${detail || 'tamamlandi'} — ${wf} ${num}` });
      } else if (stepId === 'external-review') {
        msgs.push({ channel: 'code-changes', message: `🤖 External review: ${detail || 'tamamlandi'} — ${wf} ${num}` });
      } else if (stepId === 'merge') {
        msgs.push({ channel: 'code-changes', message: `✅ Merged: ${detail || wf + ' ' + num}` });
      } else if (stepId === 'design') {
        msgs.push({ channel: 'design-reviews', message: `🎨 Design tamamlandi: ${wf} ${num}${title}\n${detail || 'Stitch screens generated'}` });
      }
      return msgs;
    }

    case 'step.failed':
      return [{ channel: 'setfarm-pipeline', message: `⚠️ Step failed: ${ev.stepId || '?'} — \`${wf}_${agent}\`` }];

    case 'step.timeout':
      return [{ channel: 'setfarm-pipeline', message: `⏰ Timeout: ${ev.stepId || '?'} — \`${wf}_${agent}\`` }];

    case 'story.done':
      return [{ channel: 'code-changes', message: `📝 Story done: "${ev.storyTitle || '?'}" — ${detail}` }];

    case 'cost.threshold': {
      const icon = ev.level === 'critical' ? '🔴' : '⚠️';
      const label = ev.level === 'critical' ? 'Kritik maliyet uyarisi' : 'Gunluk maliyet esigi';
      return [{ channel: 'alerts', message: `${icon} ${label}: ${detail}` }];
    }

    default:
      return null;
  }
}

// ── Main endpoint ──
router.post('/discord-notify', async (req, res) => {
  const ev: NotifyEvent = req.body;

  if (!ev.event) {
    return res.status(400).json({ error: 'event field required' });
  }

  // Skip noisy events
  const SKIP_EVENTS = ['step.pending', 'story.started'];
  if (SKIP_EVENTS.includes(ev.event)) {
    return res.json({ ok: true, skipped: true, reason: 'filtered' });
  }

  // Debounce
  const dedupeKey = `${ev.event}:${ev.runId}:${ev.stepId || ''}:${ev.agentId || ''}`;
  if (isDuplicate(dedupeKey)) {
    return res.json({ ok: true, skipped: true, reason: 'debounce' });
  }

  const results = formatMessage(ev);
  if (!results || results.length === 0) {
    return res.json({ ok: true, skipped: true, reason: 'unmapped event' });
  }

  // Send all formatted messages
  const sends = results.map(r => {
    const channelId = CHANNELS[r.channel as keyof typeof CHANNELS];
    return sendDiscord(channelId, r.message);
  });
  const outcomes = await Promise.all(sends);
  const anySent = outcomes.some(Boolean);

  // For implement/fix step completions, also send git summary to code-changes
  if (ev.event === 'step.done' && ['implement', 'fix'].includes(ev.stepId || '') && ev.repoPath) {
    const gitInfo = await getGitSummary(ev.repoPath);
    if (gitInfo) {
      const codeMsg = `📦 **${ev.workflowId} ${ev.runNumber ? '#' + ev.runNumber : ''} — ${ev.stepId} step tamamlandi**\n${gitInfo}`;
      await sendDiscord(CHANNELS['code-changes'], codeMsg);
    }
  }

  res.json({ ok: anySent, channels: results.map(r => r.channel), event: ev.event });
});

// ── Status endpoint for debugging ──
router.get('/discord-notify/status', (_req, res) => {
  const configured = Object.entries(CHANNELS).map(([name, id]) => ({
    name,
    configured: !!id,
    id: id ? `...${id.slice(-4)}` : 'missing',
  }));
  res.json({ channels: configured, debounceMs: DEBOUNCE_MS, recentEventsCount: recentEvents.size });
});

export default router;
