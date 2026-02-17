import { execFile as execFileCb } from 'child_process';
import { promisify } from 'util';
import { config } from '../config.js';

const execFileAsync = promisify(execFileCb);

const env = {
  ...process.env,
  PATH: `${config.cliPath}:/usr/local/bin:/usr/bin:/bin:${process.env.PATH || ''}`,
};

export async function runCli(cmd: string, args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync(cmd, args, {
      env,
      timeout: 15000,
      maxBuffer: 1024 * 1024,
    });
    return stdout.trim();
  } catch (err: any) {
    console.error(`CLI error: ${cmd} ${args.join(' ')}:`, err.message);
    throw err;
  }
}

export async function runCliJson<T = unknown>(cmd: string, args: string[]): Promise<T> {
  const out = await runCli(cmd, args);
  // Strip non-JSON prefix (e.g. openclaw doctor messages)
  const jsonStart = out.search(/^[\[{]/m);
  const jsonStr = jsonStart > 0 ? out.slice(jsonStart) : out;
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error(`JSON parse failed for: ${cmd} ${args.join(' ')}`, jsonStr.slice(0, 200));
    throw new Error(`Invalid JSON from ${cmd} ${args.join(' ')}: ${(e as Error).message}`);
  }
}
