import { readFileSync } from 'fs';
import { resolve, join } from 'path';
import { homedir } from 'os';

const loadedEnvKeys = new Set<string>();

function parseEnvValue(raw: string): string {
  const value = raw.trim();
  const quote = value[0];
  if ((quote === '"' || quote === "'") && value[value.length - 1] === quote) {
    return value.slice(1, -1);
  }
  return value;
}

function loadEnvFile(filename: string, overrideFileValues: boolean) {
  try {
    const baseDir = resolve(import.meta.dirname || __dirname, '..');
    const envPath = resolve(baseDir, filename);
    const lines = readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim().replace(/^export\s+/, '');
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = parseEnvValue(trimmed.slice(eq + 1));
      const alreadyFromProcess = process.env[key] !== undefined && !loadedEnvKeys.has(key);
      if (alreadyFromProcess) continue;
      if (!overrideFileValues && process.env[key] !== undefined) continue;
      process.env[key] = val;
      loadedEnvKeys.add(key);
    }
  } catch {
    // Missing env files are expected in packaged deployments.
  }
}

function loadEnv() {
  loadEnvFile('.env', false);
  loadEnvFile('.env.local', true);
}
loadEnv();

const HOME = homedir();

function expandRuntimePath(value: string): string {
  return value
    .replace(/^\$HOME(?=\/|$)/, HOME)
    .replace(/^~(?=\/|$)/, HOME);
}

function envPath(key: string, fallback: string): string {
  return expandRuntimePath(process.env[key] || fallback);
}

const port = parseInt(process.env.MC_PORT || '3080', 10);

function readOpenClawGatewayToken(): string {
  if (process.env.GATEWAY_TOKEN) return process.env.GATEWAY_TOKEN;
  try {
    const raw = readFileSync(join(HOME, '.openclaw/openclaw.json'), 'utf-8');
    const parsed = JSON.parse(raw);
    const token = parsed?.gateway?.auth?.token || parsed?.gateway?.token;
    return typeof token === 'string' ? token : '';
  } catch {
    return '';
  }
}

export const config = {
  port,
  host: process.env.MC_HOST || process.env.HOST || '0.0.0.0',
  publicOrigin: process.env.MC_PUBLIC_ORIGIN || '',
  internalUrl: process.env.MC_INTERNAL_URL || `http://127.0.0.1:${port}`,
  gatewayWs: process.env.GATEWAY_WS || 'ws://127.0.0.1:18789',
  setfarmUrl: process.env.SETFARM_URL || process.env.ANTFARM_URL || 'http://127.0.0.1:3333',
  prometheusUrl: process.env.PROMETHEUS_URL || 'http://127.0.0.1:9090',
  dataJson: envPath('DATA_JSON', join(HOME, '.openclaw/dashboard/data.json')),
  jobsJson: envPath('JOBS_JSON', join(HOME, '.openclaw/cron/jobs.json')),
  avatarsDir: envPath('AVATARS_DIR', join(HOME, '.openclaw/dashboard/avatars')),
  cliPath: envPath('CLI_PATH', join(HOME, '.local/bin')),
  clawtabsConfig: envPath('CLAWTABS_CONFIG', join(HOME, '.openclaw/clawtabs-config.json')),
  gatewayToken: readOpenClawGatewayToken(),
  projectsJson: envPath('PROJECTS_JSON', join(HOME, 'projects/mission-control/projects.json')),
  wsOrigin: process.env.WS_ORIGIN || '',
  authToken: process.env.AUTH_TOKEN || '',
};

export const PATHS = {
  setfarmDb: envPath('SETFARM_DB_PATH', join(HOME, '.openclaw/setfarm/setfarm.db')),
  setfarmDir: envPath('SETFARM_DIR', join(HOME, '.openclaw/setfarm')),
  setfarmRepoDir: envPath('SETFARM_REPO_DIR', join(HOME, '.openclaw/setfarm-repo')),
  projectsDir: envPath('PROJECTS_DIR', join(HOME, 'projects')),
  mobileDir: envPath('MOBILE_DIR', join(HOME, 'mobile')),
  eventsJsonl: envPath('EVENTS_JSONL', join(HOME, '.openclaw/setfarm/events.jsonl')),
  sessionsDir: envPath('SESSIONS_DIR', join(HOME, '.openclaw/sessions')),
  transcriptsDir: envPath('TRANSCRIPTS_DIR', join(HOME, '.openclaw/workspace/transcripts')),
  scriptsDir: envPath('SCRIPTS_DIR', join(HOME, '.openclaw/scripts')),
  agentsDir: envPath('AGENTS_DIR', join(HOME, '.openclaw/agents')),
  portRegistry: envPath('PORT_REGISTRY', join(HOME, '.openclaw/setfarm/port-registry.json')),
  serveBin: envPath('SERVE_BIN', join(HOME, '.npm-global/bin/serve')),
};
