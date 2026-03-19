import { homedir } from 'os';
import { join } from 'path';
import { readFileSync } from 'fs';
import { resolve } from 'path';

function loadEnv() {
  try {
    const envPath = resolve(import.meta.dirname || __dirname, '..', '.env');
    const lines = readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq);
      const val = trimmed.slice(eq + 1);
      if (!process.env[key]) process.env[key] = val;
    }
  } catch (e) {
    console.info('.env file not found or unreadable, using defaults');
  }
}
loadEnv();

export const config = {
  port: parseInt(process.env.MC_PORT || '3080', 10),
  gatewayWs: process.env.GATEWAY_WS || 'ws://127.0.0.1:18789',
  setfarmUrl: process.env.SETFARM_URL || 'http://127.0.0.1:3333',
  prometheusUrl: process.env.PROMETHEUS_URL || 'http://127.0.0.1:9090',
  dataJson: process.env.DATA_JSON || '/home/setrox/.openclaw/dashboard/data.json',
  jobsJson: process.env.JOBS_JSON || '/home/setrox/.openclaw/cron/jobs.json',
  avatarsDir: process.env.AVATARS_DIR || '/home/setrox/.openclaw/dashboard/avatars',
  cliPath: process.env.CLI_PATH || '/home/setrox/.local/bin',
  clawtabsConfig: process.env.CLAWTABS_CONFIG || '/home/setrox/.openclaw/clawtabs-config.json',
  gatewayToken: process.env.GATEWAY_TOKEN || '',
  projectsJson: process.env.PROJECTS_JSON || '/home/setrox/projects/mission-control/projects.json',
  wsOrigin: process.env.WS_ORIGIN || '',
  authToken: process.env.MC_AUTH_TOKEN || process.env.GATEWAY_TOKEN || '',
};

export const PATHS = {
  openclawDir: join(homedir(), '.openclaw'),
  agentsDir: join(homedir(), '.openclaw/agents'),
  configFile: join(homedir(), '.openclaw/openclaw.json'),
  setfarmDb: join(homedir(), '.openclaw/setfarm/setfarm.db'),
  setfarmDir: join(homedir(), '.openclaw/setfarm'),
  projectsDir: join(homedir(), 'projects'),
  mobileDir: join(homedir(), 'mobile'),
  workspaceDir: join(homedir(), '.openclaw/workspace'),
  setfarmRepoDir: join(homedir(), '.openclaw/setfarm-repo'),
  npmGlobalBin: join(homedir(), '.npm-global/bin'),
  eventsJsonl: join(homedir(), '.openclaw/setfarm/events.jsonl'),
  portRegistry: join(homedir(), '.openclaw/workspace/references/port-registry.md'),
  serveBin: join(homedir(), '.npm-global/bin/serve'),
} as const;
