import { Router } from 'express';
import { spawn } from 'child_process';
import { config } from '../config.js';
const router = Router();
const ALLOWED_COMMANDS = new Set([
    'openclaw', 'antfarm', 'docker', 'git', 'systemctl',
    'tail', 'cat', 'ls', 'df', 'free', 'uptime', 'top',
    'uname', 'whoami', 'date', 'which', 'ps',
]);
const SAFE_PATHS = [
    '/home/setrox/.openclaw/',
    '/home/setrox/mission-control/',
    '/var/log/',
    '/tmp/',
];
let activeCommands = 0;
const MAX_CONCURRENT = 3;
const MAX_OUTPUT = 64 * 1024;
const TIMEOUT = 30_000;
function validateCommand(command, args) {
    if (!ALLOWED_COMMANDS.has(command)) {
        return `Command "${command}" is not allowed`;
    }
    if (command === 'cat' || command === 'tail') {
        for (const arg of args) {
            if (arg.startsWith('-'))
                continue;
            const isSafe = SAFE_PATHS.some(p => arg.startsWith(p));
            if (!isSafe)
                return `Path "${arg}" is not in allowed directories`;
            if (arg.includes('..'))
                return 'Path traversal not allowed';
        }
    }
    if (command === 'systemctl' && args[0] !== 'status') {
        return 'Only "systemctl status" is allowed';
    }
    if (command === 'docker') {
        const safe = ['ps', 'logs', 'stats', 'inspect', 'images'];
        if (!safe.includes(args[0]))
            return `Docker subcommand "${args[0]}" is not allowed`;
    }
    if (command === 'git') {
        const safe = ['status', 'log', 'diff', 'branch', 'show', 'remote'];
        if (!safe.includes(args[0]))
            return `Git subcommand "${args[0]}" is not allowed`;
    }
    return null;
}
router.post('/terminal/exec', async (req, res) => {
    try {
        const { command, args = [] } = req.body;
        if (!command) {
            res.status(400).json({ error: 'command is required' });
            return;
        }
        const error = validateCommand(command, args);
        if (error) {
            res.status(403).json({ error });
            return;
        }
        if (activeCommands >= MAX_CONCURRENT) {
            res.status(429).json({ error: 'Too many concurrent commands' });
            return;
        }
        activeCommands++;
        let output = '';
        const env = {
            ...process.env,
            PATH: `${config.cliPath}:/usr/local/bin:/usr/bin:/bin:${process.env.PATH || ''}`,
            HOME: '/home/setrox',
        };
        const child = spawn(command, args, { env, timeout: TIMEOUT, cwd: '/home/setrox' });
        child.stdout.on('data', (data) => {
            if (output.length < MAX_OUTPUT)
                output += data.toString();
        });
        child.stderr.on('data', (data) => {
            if (output.length < MAX_OUTPUT)
                output += data.toString();
        });
        child.on('close', (code) => {
            activeCommands--;
            if (output.length > MAX_OUTPUT) {
                output = output.slice(0, MAX_OUTPUT) + '\n[... output truncated at 64KB]';
            }
            res.json({ output, exitCode: code ?? -1, command: `${command} ${args.join(' ')}` });
        });
        child.on('error', (err) => {
            activeCommands--;
            res.status(500).json({ error: err.message });
        });
    }
    catch (err) {
        if (activeCommands > 0)
            activeCommands--;
        res.status(500).json({ error: err.message });
    }
});
export default router;
