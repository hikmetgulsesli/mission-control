import { execFile as execFileCb } from 'child_process';
import { promisify } from 'util';
import { dirname } from 'path';
import { config } from '../config.js';

const execFileAsync = promisify(execFileCb);
const nodeBinDir = dirname(process.execPath);

const env = {
  ...process.env,
  PATH: `${config.cliPath}:${nodeBinDir}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH || ''}`,
};

// 2026-04-19 CPU meltdown postmortem:
// MC spawned a new `openclaw` CLI every 30s (overview cache tick). When the
// gateway stalled, each CLI hung for the full 60s timeout — and a fresh one
// was queued on top of each still-running one. 16 zombie CLIs accumulated,
// load avg hit 17+, gateway couldn't recover. Three defenses below:
//
//   1. Shorter timeout (10s) + SIGKILL so a hang is noticed fast.
//   2. In-flight deduplication: identical cmd+args = single shared promise.
//      Dashboard overview calls `openclaw agents list --json` from multiple
//      routes; they now piggyback on one exec.
//   3. Global concurrency cap (3): further calls queue instead of spawning.
//      Prevents the "tick spawns a new process while old one is hung" loop.

const CLI_TIMEOUT_MS = 25_000;
const MAX_CONCURRENT = 3;

const inflight = new Map<string, Promise<string>>();
let active = 0;
const waitQueue: Array<() => void> = [];

function acquire(): Promise<void> {
  if (active < MAX_CONCURRENT) {
    active++;
    return Promise.resolve();
  }
  return new Promise<void>(resolve => {
    waitQueue.push(() => { active++; resolve(); });
  });
}

function release(): void {
  active--;
  const next = waitQueue.shift();
  if (next) next();
}

export async function runCli(cmd: string, args: string[]): Promise<string> {
  const key = `${cmd} ${args.join(' ')}`;
  const existing = inflight.get(key);
  if (existing) return existing;

  const p = (async () => {
    await acquire();
    try {
      const { stdout } = await execFileAsync(cmd, args, {
        env,
        timeout: CLI_TIMEOUT_MS,
        killSignal: 'SIGKILL',
        maxBuffer: 1024 * 1024,
      });
      return stdout.trim();
    } catch (err: any) {
      console.error(`CLI error: ${cmd} ${args.join(' ')}:`, err.message);
      throw err;
    } finally {
      release();
    }
  })();

  inflight.set(key, p);
  p.finally(() => { inflight.delete(key); }).catch(() => {});
  return p;
}

export async function runCliJson<T = unknown>(cmd: string, args: string[]): Promise<T> {
  const out = await runCli(cmd, args);
  const jsonStart = out.search(/^[\[{]/m);
  const jsonStr = jsonStart > 0 ? out.slice(jsonStart) : out;
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error(`JSON parse failed for: ${cmd} ${args.join(' ')}`, jsonStr.slice(0, 200));
    throw new Error(`Invalid JSON from ${cmd} ${args.join(' ')}: ${(e as Error).message}`);
  }
}
