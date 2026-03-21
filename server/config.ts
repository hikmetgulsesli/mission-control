import { readFileSync } from 'fs';
import { resolve, join } from 'path';
import { homedir } from 'os';

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

const HOME = homedir();

export const config = {
  port: parseInt(process.env.MC_PORT || '3080', 10),
  gatewayWs: process.env.GATEWAY_WS || 'ws://127.0.0.1:18789',
  setfarmUrl: process.env.SETFARM_URL || process.env.ANTFARM_URL || 'http://127.0.0.1:3333',
  prometheusUrl: process.env.PROMETHEUS_URL || 'http://127.0.0.1:9090',
  dataJson: process.env.DATA_JSON || join(HOME, '.openclaw/dashboard/data.json'),
  jobsJson: process.env.JOBS_JSON || join(HOME, '.openclaw/cron/jobs.json'),
  avatarsDir: process.env.AVATARS_DIR || join(HOME, '.openclaw/dashboard/avatars'),
  cliPath: process.env.CLI_PATH || join(HOME, '.local/bin'),
  clawtabsConfig: process.env.CLAWTABS_CONFIG || join(HOME, '.openclaw/clawtabs-config.json'),
  gatewayToken: process.env.GATEWAY_TOKEN || '',
  projectsJson: process.env.PROJECTS_JSON || join(HOME, 'projects/mission-control/projects.json'),
  wsOrigin: process.env.WS_ORIGIN || '',
  authToken: process.env.AUTH_TOKEN || '',
};

// A1 fix: PATHS export — setfarm-activity.ts bunu import ediyor
export const PATHS = {
  setfarmDir: process.env.SETFARM_DIR || join(HOME, '.openclaw/setfarm'),
  setfarmRepoDir: process.env.SETFARM_REPO_DIR || join(HOME, '.openclaw/setfarm-repo'),
  projectsDir: process.env.PROJECTS_DIR || join(HOME, 'projects'),
  mobileDir: process.env.MOBILE_DIR || join(HOME, 'mobile'),
  eventsJsonl: process.env.EVENTS_JSONL || join(HOME, '.openclaw/setfarm/events.jsonl'),
  sessionsDir: process.env.SESSIONS_DIR || join(HOME, '.openclaw/sessions'),
  scriptsDir: process.env.SCRIPTS_DIR || join(HOME, '.openclaw/scripts'),
  agentsDir: process.env.AGENTS_DIR || join(HOME, '.openclaw/agents'),
  portRegistry: process.env.PORT_REGISTRY || join(HOME, '.openclaw/setfarm/port-registry.json'),
  serveBin: process.env.SERVE_BIN || join(HOME, '.npm-global/bin/serve'),
};
