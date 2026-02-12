import { readFileSync } from 'fs';
import { resolve } from 'path';
function loadEnv() {
    try {
        const envPath = resolve(import.meta.dirname || __dirname, '..', '.env');
        const lines = readFileSync(envPath, 'utf-8').split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#'))
                continue;
            const eq = trimmed.indexOf('=');
            if (eq === -1)
                continue;
            const key = trimmed.slice(0, eq);
            const val = trimmed.slice(eq + 1);
            if (!process.env[key])
                process.env[key] = val;
        }
    }
    catch { }
}
loadEnv();
export const config = {
    port: parseInt(process.env.MC_PORT || '3080', 10),
    gatewayWs: process.env.GATEWAY_WS || 'ws://127.0.0.1:18789',
    antfarmUrl: process.env.ANTFARM_URL || 'http://127.0.0.1:3333',
    prometheusUrl: process.env.PROMETHEUS_URL || 'http://127.0.0.1:9090',
    dataJson: process.env.DATA_JSON || '/home/setrox/.openclaw/dashboard/data.json',
    jobsJson: process.env.JOBS_JSON || '/home/setrox/.openclaw/cron/jobs.json',
    avatarsDir: process.env.AVATARS_DIR || '/home/setrox/.openclaw/dashboard/avatars',
    cliPath: process.env.CLI_PATH || '/home/setrox/.local/bin',
    clawtabsConfig: process.env.CLAWTABS_CONFIG || '/home/setrox/.openclaw/clawtabs-config.json',
    gatewayToken: process.env.GATEWAY_TOKEN || '',
};
