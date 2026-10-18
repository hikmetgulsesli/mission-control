import { freshSetfarmCliInvocationV1, freshMissionControlSelectedV1 } from '../services/fresh-installation-runtime.js';
import { execFile as execFileCb } from 'child_process';
import { promisify } from 'util';
import { dirname } from 'path';
import { config } from '../config.js';
import { task6aSelectedCliNoSpawn, TASK6A_SELECTED_CLI_NO_SPAWN } from './task6a-selected-cli-fence.js';

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
const FRESH_WORKFLOW_RUN_TIMEOUT_MS = 120_000;
export class FreshWorkflowCliBusyErrorV1 extends Error { constructor(){super('MC_FRESH_WORKFLOW_CLI_BUSY');} }
function commandTimeoutMsV1(selected:boolean,command:string,args:readonly string[]):number {
  return selected&&command==='setfarm'&&args[0]==='workflow'&&args[1]==='run'
    ? FRESH_WORKFLOW_RUN_TIMEOUT_MS : CLI_TIMEOUT_MS;
}


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

export async function runCliRaw(cmd: string, args: string[]): Promise<string> {
  if (task6aSelectedCliNoSpawn) throw new Error(TASK6A_SELECTED_CLI_NO_SPAWN);
  const key = `${cmd} ${args.join(' ')}`;
  const existing = inflight.get(key);
  if (existing) return existing;

  const p = (async () => {
    // A new selected workflow request never waits in the ambient CLI queue.
    // The synchronous check+acquire cannot enqueue between these statements.
    const selectedRun=cmd==='setfarm'&&args[0]==='workflow'&&args[1]==='run'&&freshMissionControlSelectedV1();
    if(selectedRun&&active>=MAX_CONCURRENT)throw new FreshWorkflowCliBusyErrorV1();
    await acquire();
    try {
      const selected = freshSetfarmCliInvocationV1(cmd,args,env);
      const { stdout } = await execFileAsync(selected?.file ?? cmd, selected ? [...selected.args] : args, {
        env:selected?.env ?? env,
        timeout: commandTimeoutMsV1(selected!==null,cmd,args),
        killSignal: 'SIGKILL',
        maxBuffer: 1024 * 1024,
      });
      return stdout;
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

/** Existing callers retain trimmed output; strict receipt consumers use the same bounded raw capture. */
export async function runCli(cmd: string, args: string[]): Promise<string> {
  return (await runCliRaw(cmd,args)).trim();
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
