import { execFile as execFileCb } from 'child_process';
import { promisify } from 'util';
import { config } from '../config.js';
const execFileAsync = promisify(execFileCb);
const env = {
    ...process.env,
    PATH: `${config.cliPath}:/usr/local/bin:/usr/bin:/bin:${process.env.PATH || ''}`,
};
export async function runCli(cmd, args) {
    try {
        const { stdout } = await execFileAsync(cmd, args, {
            env,
            timeout: 15000,
            maxBuffer: 1024 * 1024,
        });
        return stdout.trim();
    }
    catch (err) {
        console.error(`CLI error: ${cmd} ${args.join(' ')}:`, err.message);
        throw err;
    }
}
export async function runCliJson(cmd, args) {
    const out = await runCli(cmd, args);
    return JSON.parse(out);
}
