import { freshMissionControlPathsV1 } from './services/fresh-installation-runtime.js';
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

// Selected runtime/process administration is captured before config is imported.
// Env files remain ordinary configuration DATA, never a late selection port.
const FRESH_PROTECTED_ENV_KEYS_V1 = new Set([
  'DATABASE_URL','DB_BACKEND','PROJECTS_DIR','SCRIPTS_DIR','CLI_PATH','DATA_JSON','JOBS_JSON',
  'AVATARS_DIR','CLAWTABS_CONFIG','PROJECTS_JSON','DELETED_PROJECTS_JSON','UPLOADS_DIR','MOBILE_DIR',
  'EVENTS_JSONL','SESSIONS_DIR','TRANSCRIPTS_DIR','AGENTS_DIR','PORT_REGISTRY','SERVE_BIN','MC_REPO_DIR',
  'PATH','HOME','USER','LOGNAME','SHELL','PWD','OLDPWD','TMPDIR','TMP','TEMP','ENV','BASH_ENV','IFS','CDPATH',
]);
function selectedEnvFileKeyAllowedV1(key: string): boolean {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || FRESH_PROTECTED_ENV_KEYS_V1.has(key)) return false;
  // These two are existing MC network/auth settings, not Setfarm runtime inputs.
  if (key === 'SETFARM_URL' || key === 'SETFARM_OPERATIONAL_WRITE_TOKEN') return true;
  return !['SETFARM_','OPENCLAW_','MC_TASK6A_','PG','NODE_','GIT_','DYLD_','LD_'].some(prefix => key.startsWith(prefix));
}

function applyEnvFileDataV1(contents: string, overrideFileValues: boolean, selected: boolean): void {
  for (const line of contents.split('\n')) {
    const trimmed = line.trim().replace(/^export\s+/, '');
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (selected && !selectedEnvFileKeyAllowedV1(key)) continue;
    const val = parseEnvValue(trimmed.slice(eq + 1));
    const alreadyFromProcess = process.env[key] !== undefined && !loadedEnvKeys.has(key);
    if (alreadyFromProcess) continue;
    if (!overrideFileValues && process.env[key] !== undefined) continue;
    process.env[key] = val;
    loadedEnvKeys.add(key);
  }
}

function loadEnvFile(filename: string, overrideFileValues: boolean, selected = false) {
  try {
    const baseDir = resolve(import.meta.dirname || __dirname, '..');
    const envPath = resolve(baseDir, filename);
    applyEnvFileDataV1(readFileSync(envPath, 'utf-8'), overrideFileValues, selected);
  } catch {
    // Missing env files are expected in packaged deployments.
  }
}

function loadEnv(selected = false) {
  loadEnvFile('.env', false, selected);
  loadEnvFile('.env.local', true, selected);
}
const selectedPaths = freshMissionControlPathsV1();
loadEnv(selectedPaths !== null);

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
  setfarmOperationalWriteToken: process.env.SETFARM_OPERATIONAL_WRITE_TOKEN || '',
  prometheusUrl: process.env.PROMETHEUS_URL || 'http://127.0.0.1:9090',
  dataJson: selectedPaths?.dataJson ?? envPath('DATA_JSON', join(HOME, '.openclaw/dashboard/data.json')),
  jobsJson: envPath('JOBS_JSON', join(HOME, '.openclaw/cron/jobs.json')),
  avatarsDir: selectedPaths?.avatarsDir ?? envPath('AVATARS_DIR', join(HOME, '.openclaw/dashboard/avatars')),
  cliPath: selectedPaths?.cliPath ?? envPath('CLI_PATH', join(HOME, '.local/bin')),
  clawtabsConfig: envPath('CLAWTABS_CONFIG', join(HOME, '.openclaw/clawtabs-config.json')),
  gatewayToken: readOpenClawGatewayToken(),
  projectsJson: selectedPaths?.projectsJson ?? envPath('PROJECTS_JSON', join(HOME, 'projects/mission-control/projects.json')),
  deletedProjectsJson: selectedPaths?.deletedProjectsJson ?? resolve(import.meta.dirname || __dirname, '..', 'deleted-projects.json'),
  wsOrigin: process.env.WS_ORIGIN || '',
  authToken: process.env.AUTH_TOKEN || '',
};

export const PATHS = {
  uploadsDir: selectedPaths?.uploadsDir ?? resolve(import.meta.dirname || __dirname, '..', 'uploads'),
  setfarmDb: selectedPaths?.setfarmDb ?? envPath('SETFARM_DB_PATH', join(HOME, '.openclaw/setfarm/setfarm.db')),
  setfarmDir: selectedPaths?.setfarmDir ?? envPath('SETFARM_DIR', join(HOME, '.openclaw/setfarm')),
  setfarmRepoDir: selectedPaths?.setfarmRepoDir ?? envPath('SETFARM_REPO_DIR', join(HOME, '.openclaw/setfarm-repo')),
  projectsDir: selectedPaths?.projectsDir ?? envPath('PROJECTS_DIR', join(HOME, 'projects')),
  mobileDir: selectedPaths?.mobileDir ?? envPath('MOBILE_DIR', join(HOME, 'mobile')),
  eventsJsonl: selectedPaths?.eventsJsonl ?? envPath('EVENTS_JSONL', join(HOME, '.openclaw/setfarm/events.jsonl')),
  sessionsDir: selectedPaths?.sessionsDir ?? envPath('SESSIONS_DIR', join(HOME, '.openclaw/sessions')),
  transcriptsDir: selectedPaths?.transcriptsDir ?? envPath('TRANSCRIPTS_DIR', join(HOME, '.openclaw/workspace/transcripts')),
  scriptsDir: selectedPaths?.scriptsDir ?? envPath('SCRIPTS_DIR', join(HOME, '.openclaw/scripts')),
  agentsDir: selectedPaths?.agentsDir ?? envPath('AGENTS_DIR', join(HOME, '.openclaw/agents')),
  portRegistry: selectedPaths?.portRegistry ?? envPath('PORT_REGISTRY', join(HOME, '.openclaw/setfarm/port-registry.json')),
  serveBin: envPath('SERVE_BIN', join(HOME, '.npm-global/bin/serve')),
};

if (selectedPaths) { Object.freeze(config); Object.freeze(PATHS); }
