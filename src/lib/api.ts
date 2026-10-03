import type { OverviewData, Agent, Session, CronJob, Workflow, Run, SystemMetrics, DockerContainer, CostData, Task, ProjectData, TaskCreateData } from './types';
import {
  parseOperationalSnapshotResponse,
  type OperationalSnapshotFetchResult,
} from './operational-snapshot';
import {
  parseProductBuildAuthorityResponse,
  type ProductBuildAuthorityState,
} from './product-build-authority';

const BASE = '';
const AUTH_TOKEN = (document.querySelector('meta[name="mc-token"]') as HTMLMetaElement)?.content || '';

export type TelemetryUnavailableReason = 'invalid_run_id' | 'sql' | 'http' | 'network'
  | 'invalid_json' | 'invalid_response' | 'run_id_mismatch';
export interface TelemetryStep {
  step_id: string; agent_id: string | null; status: string;
  started_at: string | null; updated_at: string | null;
  duration_ms: number | null; isBottleneck: boolean;
}
export interface TelemetryAvailable {
  schema: 'mission-control.pipeline-telemetry.v1'; status: 'available_limited'; runId: string;
  history: { state: 'unavailable'; reasonCode: 'PRECISE_TRANSITION_HISTORY_UNAVAILABLE' };
  analysis: { coverage: ['historical_execution_duration'] };
  steps: TelemetryStep[]; transitions: [];
  bottlenecks: Array<{ type: 'execution_bottleneck'; stepId: string; message: string; value: number; threshold: number }>;
}
export type TelemetryResult = TelemetryAvailable
  | { status: 'unavailable'; runId: string | null; reason: TelemetryUnavailableReason };

function telemetryUnavailable(runId: string | null, reason: TelemetryUnavailableReason): TelemetryResult {
  return { status: 'unavailable', runId, reason };
}

export function isTelemetryRunId(value: unknown): value is string {
  if (typeof value !== 'string' || !value.length || value.includes('\0')) return false;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(++i);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
    } else if (code >= 0xdc00 && code <= 0xdfff) return false;
  }
  return new TextEncoder().encode(value).byteLength <= 256;
}

function telemetryKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype
    && Reflect.ownKeys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
}

// Canonical PostgreSQL UTC diagnostic text; deliberately not JavaScript Date.
function telemetryTimestamp(value: unknown): boolean {
  if (value === null) return true;
  if (typeof value !== 'string') return false;
  const match = /^(\d{4,6})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{6})Z (AD|BC)$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  if (!year || match[1] !== String(year).padStart(4, '0') || month < 1 || month > 12
      || Number(match[4]) > 23 || Number(match[5]) > 59 || Number(match[6]) > 59) return false;
  const astronomical = match[8] === 'BC' ? 1 - year : year;
  const leap = astronomical % 4 === 0 && (astronomical % 100 !== 0 || astronomical % 400 === 0);
  if (day < 1 || day > [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]!) return false;
  if (match[8] === 'BC') return year < 4714 || year === 4714 && (month > 11 || month === 11 && day >= 24);
  return year <= 294276;
}

export function parseTelemetryResponse(status: number, body: unknown, runId: string): TelemetryResult {
  const invalid = () => telemetryUnavailable(runId, 'invalid_response');
  if (status !== 200 && status !== 400 && status !== 503) return telemetryUnavailable(runId, 'http');
  if (status === 400 || status === 503) {
    if (!telemetryKeys(body, ['schema', 'status', 'runId', 'code', 'reason'])
        || body.schema !== 'mission-control.pipeline-telemetry.v1' || body.status !== 'unavailable') return invalid();
    if (status === 400) return body.runId === null && body.code === 'TELEMETRY_RUN_ID_INVALID'
      && body.reason === 'invalid_run_id' ? telemetryUnavailable(null, 'invalid_run_id') : invalid();
    if (!isTelemetryRunId(body.runId) || body.code !== 'TELEMETRY_READ_FAILED' || body.reason !== 'sql') return invalid();
    return telemetryUnavailable(runId, body.runId === runId ? 'sql' : 'run_id_mismatch');
  }
  if (!telemetryKeys(body, ['schema', 'status', 'runId', 'history', 'analysis', 'steps', 'transitions', 'bottlenecks'])
      || body.schema !== 'mission-control.pipeline-telemetry.v1' || body.status !== 'available_limited'
      || !isTelemetryRunId(body.runId)
      || !telemetryKeys(body.history, ['state', 'reasonCode']) || body.history.state !== 'unavailable'
      || body.history.reasonCode !== 'PRECISE_TRANSITION_HISTORY_UNAVAILABLE'
      || !telemetryKeys(body.analysis, ['coverage']) || !Array.isArray(body.analysis.coverage)
      || body.analysis.coverage.length !== 1 || body.analysis.coverage[0] !== 'historical_execution_duration'
      || !Array.isArray(body.steps) || !Array.isArray(body.transitions) || body.transitions.length !== 0
      || !Array.isArray(body.bottlenecks)) return invalid();
  let total = 0;
  for (const step of body.steps) {
    if (!telemetryKeys(step, ['step_id', 'agent_id', 'status', 'started_at', 'updated_at', 'duration_ms', 'isBottleneck'])
        || typeof step.step_id !== 'string' || typeof step.status !== 'string'
        || step.agent_id !== null && typeof step.agent_id !== 'string'
        || !telemetryTimestamp(step.started_at) || !telemetryTimestamp(step.updated_at)
        || typeof step.isBottleneck !== 'boolean'
        || step.duration_ms !== null && (typeof step.duration_ms !== 'number' || !Number.isFinite(step.duration_ms)
          || !Number.isInteger(step.duration_ms) || step.duration_ms < 0 || !['done', 'failed'].includes(step.status))) return invalid();
    if (step.duration_ms !== null) { total += step.duration_ms as number; if (!Number.isFinite(total)) return invalid(); }
  }
  for (const flag of body.bottlenecks) {
    if (!telemetryKeys(flag, ['type', 'stepId', 'message', 'value', 'threshold'])
        || flag.type !== 'execution_bottleneck' || typeof flag.stepId !== 'string' || typeof flag.message !== 'string'
        || typeof flag.value !== 'number' || !Number.isFinite(flag.value)
        || typeof flag.threshold !== 'number' || !Number.isFinite(flag.threshold)
        || !(flag.value > flag.threshold && flag.threshold > 0)) return invalid();
  }
  if (body.runId !== runId) return telemetryUnavailable(runId, 'run_id_mismatch');
  return body as unknown as TelemetryAvailable;
}

async function fetchTelemetry(runId: string): Promise<TelemetryResult> {
  if (!isTelemetryRunId(runId)) return telemetryUnavailable(null, 'invalid_run_id');
  let response: Response;
  try {
    response = await fetch(`${BASE}/api/telemetry?runId=${encodeURIComponent(runId)}`, {
      headers: AUTH_TOKEN ? { 'X-MC-Token': AUTH_TOKEN } : {}, cache: 'no-store',
    });
  } catch { return telemetryUnavailable(runId, 'network'); }
  const refused = async (reason: TelemetryUnavailableReason) => {
    try { await response.body?.cancel(); } catch { /* preserve the selected refusal */ }
    return telemetryUnavailable(runId, reason);
  };
  if (![200, 400, 503].includes(response.status)) return refused('http');
  if (!/^[ \t]*application\/json[ \t]*(?:;[ \t]*charset[ \t]*=[ \t]*(?:utf-8|"utf-8")[ \t]*)?$/i.test(response.headers.get('content-type') || '')) return refused('invalid_response');
  if (!response.body) return telemetryUnavailable(runId, 'invalid_response');
  const chunks: Uint8Array[] = []; let bytes = 0, ended = false;
  let result: TelemetryResult | undefined;
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    reader = response.body.getReader();
    for (;;) {
      const next = await reader.read();
      if (next.done) { ended = true; break; }
      if (!(next.value instanceof Uint8Array) || bytes + next.value.byteLength > 1048576) {
        result = telemetryUnavailable(runId, 'invalid_response'); break;
      }
      bytes += next.value.byteLength; chunks.push(next.value);
    }
    if (!result) {
      const all = new Uint8Array(bytes); let offset = 0;
      for (const chunk of chunks) { all.set(chunk, offset); offset += chunk.byteLength; }
      let text: string | undefined;
      try { text = new TextDecoder('utf-8', { fatal: true }).decode(all); }
      catch { result = telemetryUnavailable(runId, 'invalid_response'); }
      if (text !== undefined) {
        let body: unknown;
        try { body = JSON.parse(text); } catch { result = telemetryUnavailable(runId, 'invalid_json'); }
        if (!result) result = parseTelemetryResponse(response.status, body, runId);
      }
    }
  } catch { result ??= telemetryUnavailable(runId, 'network'); }
  finally {
    if (reader) {
      if (!ended) try { await reader.cancel(); } catch { result ??= telemetryUnavailable(runId, 'network'); }
      try { reader.releaseLock(); }
      catch { if (!result || result.status === 'available_limited') result = telemetryUnavailable(runId, 'network'); }
    }
  }
  return result ?? telemetryUnavailable(runId, 'invalid_response');
}

async function fetchApi<T>(path: string, opts?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    ...(AUTH_TOKEN ? { 'X-MC-Token': AUTH_TOKEN } : {}),
    ...((opts?.headers as Record<string, string>) || {}),
  };
  const method = String(opts?.method || 'GET').toUpperCase();
  const cache = opts?.cache || (method === 'GET' ? 'no-store' : undefined);
  const res = await fetch(`${BASE}${path}`, { ...opts, headers, cache });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json();
}

async function fetchOperationalSnapshot(runId: string): Promise<OperationalSnapshotFetchResult> {
  try {
    const res = await fetch(`${BASE}/api/setfarm/runs/${encodeURIComponent(runId)}/operational-snapshot`, {
      headers: AUTH_TOKEN ? { 'X-MC-Token': AUTH_TOKEN } : {},
      cache: 'no-store',
    });
    const text = await res.text();
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return {
        status: 'upstream_error',
        code: 'SETFARM_OPERATIONAL_SNAPSHOT_UPSTREAM_ERROR',
        reason: 'invalid_json',
        upstreamStatus: res.status,
      };
    }
    return parseOperationalSnapshotResponse(res.status, body, runId);
  } catch {
    return {
      status: 'unavailable',
      code: 'SETFARM_OPERATIONAL_SNAPSHOT_UNAVAILABLE',
      reason: 'network',
    };
  }
}

async function fetchProductBuildAuthority(runId: string): Promise<Exclude<ProductBuildAuthorityState, { status: 'loading' }>> {
  try {
    const res = await fetch(`${BASE}/api/setfarm/runs/${encodeURIComponent(runId)}/product-build-authority`, {
      headers: AUTH_TOKEN ? { 'X-MC-Token': AUTH_TOKEN } : {},
      cache: 'no-store',
    });
    const text = await res.text();
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return {
        status: 'upstream_error',
        code: 'SETFARM_PRODUCT_BUILD_AUTHORITY_UPSTREAM_ERROR',
        reason: 'invalid_json',
        upstreamStatus: res.status,
      };
    }
    return parseProductBuildAuthorityResponse(res.status, body, runId);
  } catch {
    return {
      status: 'unavailable',
      code: 'SETFARM_PRODUCT_BUILD_AUTHORITY_UNAVAILABLE',
      reason: 'network',
    };
  }
}

const CT_JSON = { 'Content-Type': 'application/json' };

export const api = {
  overview: () => fetchApi<OverviewData>('/api/overview'),
  agents: () => fetchApi<Agent[]>('/api/agents'),
  agent: (id: string) => fetchApi<Agent>(`/api/agents/${id}`),
  agentHistory: (id: string, limit = 50) => fetchApi<{ messages: any[] }>(`/api/agents/${id}/history?limit=${limit}`),
  agentLive: (id: string) => fetchApi<any>(`/api/agents/${id}/live`),
  agentActivity: (id: string) => fetchApi<any>(`/api/agents/${id}/activity`),
  agentStats: (id: string) => fetchApi<{
    agentId: string;
    storiesCompleted: number;
    storiesFailed: number;
    successRate: number;
    avgDurationMs: number;
    errorCount: number;
    totalSteps: number;
  }>(`/api/agents/${id}/stats`),
  sessions: () => fetchApi<Session[]>('/api/sessions'),
  cron: () => fetchApi<CronJob[]>('/api/cron'),
  cronToggle: (id: string) => fetchApi<{ success: boolean }>(`/api/cron/${id}/toggle`, { method: 'POST' }),
  workflows: () => fetchApi<Workflow[]>('/api/workflows'),
  runs: () => fetchApi<Run[]>('/api/runs'),
  runDetail: (id: string) => fetchApi<any>(`/api/runs/${id}/detail`),
  runSupervisor: (id: string) => fetchApi<any>(`/api/runs/${id}/supervisor`),
  runEvents: (id: string) => fetchApi<any[]>(`/api/runs/${id}/events`),
  runProductBuildAuthority: (id: string) => fetchProductBuildAuthority(id),
  startRun: (workflow: string, task: string) =>
    fetchApi<any>('/api/runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workflow, task }),
    }),
  deleteRun: (id: string, cleanupProject = false) =>
    fetchApi<any>(`/api/runs/${id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cleanupProject }) }),
  stopRun: (id: string, expectedSnapshotHash: string) =>
    fetchApi<any>(`/api/runs/${id}/stop`, {
      method: 'POST',
      headers: CT_JSON,
      body: JSON.stringify({ expectedSnapshotHash }),
    }),
  resumeRun: (id: string, expectedSnapshotHash: string) =>
    fetchApi<any>(`/api/runs/${id}/resume`, {
      method: 'POST',
      headers: CT_JSON,
      body: JSON.stringify({ expectedSnapshotHash }),
    }),
  system: () => fetchApi<SystemMetrics>('/api/system'),
  docker: () => fetchApi<DockerContainer[]>('/api/system/docker'),
  costs: () => fetchApi<CostData>('/api/costs'),
  // Projects
  projects: () => fetchApi<ProjectData[]>("/api/projects"),
  project: (id: string) => fetchApi<ProjectData>(`/api/projects/${id}`),
  createProject: (data: any) => fetchApi<any>("/api/projects", { method: "POST", headers: CT_JSON, body: JSON.stringify(data) }),
  updateProject: (id: string, data: any) => fetchApi<any>(`/api/projects/${id}`, { method: "PATCH", headers: CT_JSON, body: JSON.stringify(data) }),
  deleteProject: (id: string, confirmName: string) => fetchApi<any>(`/api/projects/${id}`, { method: "DELETE", headers: CT_JSON, body: JSON.stringify({ confirmName }) }),
  toggleProject: (id: string, action: "start" | "stop") =>
    fetchApi<any>(`/api/projects/${id}/toggle`, { method: "POST", headers: CT_JSON, body: JSON.stringify({ action }) }),
  stopAllProjects: () => fetchApi<any>("/api/projects/stop-all", { method: "POST" }),
  exportProject: (id: string) => fetchApi<any>(`/api/projects/${id}/export`),
  importProject: (data: any) => fetchApi<any>("/api/projects/import", { method: "POST", headers: CT_JSON, body: JSON.stringify(data) }),
  // Tasks
  tasks: () => fetchApi<Task[]>('/api/tasks'),
  createTask: (data: TaskCreateData) => fetchApi<Task>('/api/tasks', { method: 'POST', headers: CT_JSON, body: JSON.stringify(data) }),
  updateTask: (id: string, data: Partial<Task>) => fetchApi<Task>("/api/tasks/" + id, { method: 'PUT', headers: CT_JSON, body: JSON.stringify(data) }),
  deleteTask: (id: string) => fetchApi<any>("/api/tasks/" + id, { method: 'DELETE' }),
  updateTaskStatus: (id: string, status: string) => fetchApi<any>("/api/tasks/" + id + "/status", { method: 'PATCH', headers: CT_JSON, body: JSON.stringify({ status }) }),
  // Images
  uploadTaskImage: (id: string, base64: string, filename: string) => fetchApi<any>("/api/tasks/" + id + "/images", { method: "POST", headers: CT_JSON, body: JSON.stringify({ base64, filename }) }),
  deleteTaskImage: (id: string, filename: string) => fetchApi<any>("/api/tasks/" + id + "/images/" + filename, { method: "DELETE" }),
  // Approvals
  approvals: () => fetchApi<any[]>('/api/approvals'),
  approveStep: (id: string) => fetchApi<any>('/api/approvals/' + id + '/approve', { method: 'POST' }),
  rejectStep: (id: string, reason: string) => fetchApi<any>('/api/approvals/' + id + '/reject', { method: 'POST', headers: CT_JSON, body: JSON.stringify({ reason }) }),
  // Setfarm Activity
  setfarmActivity: (limit = 50) => fetchApi<any[]>('/api/setfarm/activity?limit=' + limit),
  setfarmAgents: () => fetchApi<any[]>('/api/setfarm/agents'),
  setfarmAlerts: () => fetchApi<any>('/api/setfarm/alerts'),
  setfarmPipeline: () => fetchApi<any[]>('/api/setfarm/pipeline'),
  setfarmAgentFeed: (limit = 100) => fetchApi<any[]>("/api/setfarm/agent-feed?limit=" + limit),
  clearAgentFeed: () => fetchApi<any>("/api/setfarm/agent-feed", { method: "DELETE" }),
  clearActivity: () => fetchApi<any>("/api/setfarm/activity", { method: "DELETE" }),
  // New: Stories + Plan for runs
  runStories: (id: string) => fetchApi<any[]>(`/api/setfarm/runs/${id}/stories`),
  runPlan: (id: string) => fetchApi<any>(`/api/setfarm/runs/${id}/plan`),
  runDesign: (id: string) => fetchApi<any>(`/api/setfarm/runs/${id}/design`),
  runContract: (id: string) => fetchApi<any>(`/api/setfarm/runs/${id}/contract`),
  runOperations: (id: string) => fetchApi<any>(`/api/setfarm/runs/${id}/operations`),
  runOperationalSnapshot: (id: string) => fetchOperationalSnapshot(id),
  runAgentActivity: (id: string, stepId: string) =>
    fetchApi<any>(`/api/setfarm/runs/${id}/steps/${encodeURIComponent(stepId)}/agent-activity`),
  // Terminal
  terminalExec: (command: string, args: string[]) =>
    fetchApi<{ output: string; exitCode: number; command: string }>('/api/terminal/exec', {
      method: 'POST',
      headers: CT_JSON,
      body: JSON.stringify({ command, args }),
    }),
  // Pixel Office
  officeStatus: () => fetchApi<any>('/api/office/status'),
  // Files
  filesList: (path: string) => fetchApi<any>(`/api/files/list?path=${encodeURIComponent(path)}`),
  filesRead: (path: string) => fetchApi<any>(`/api/files/read?path=${encodeURIComponent(path)}`),
  filesWrite: (path: string, content: string) =>
    fetchApi<any>('/api/files/write', { method: 'PUT', headers: CT_JSON, body: JSON.stringify({ path, content }) }),
  filesDelete: (path: string) =>
    fetchApi<any>('/api/files/delete', { method: 'DELETE', headers: CT_JSON, body: JSON.stringify({ path }) }),
  filesMkdir: (path: string) =>
    fetchApi<any>('/api/files/mkdir', { method: 'POST', headers: CT_JSON, body: JSON.stringify({ path }) }),
  filesRename: (oldPath: string, newPath: string) =>
    fetchApi<any>('/api/files/rename', { method: 'POST', headers: CT_JSON, body: JSON.stringify({ oldPath, newPath }) }),
  filesUpload: (directory: string, filename: string, content: string) =>
    fetchApi<any>('/api/files/upload', { method: 'POST', headers: CT_JSON, body: JSON.stringify({ directory, filename, content }) }),
  // Stuck Recovery
  stuckRuns: () => fetchApi<any>("/api/runs/stuck"),
  // Smart Stuck Recovery v2
  diagnoseRun: (id: string, stepId?: string) =>
    fetchApi<any>(`/api/runs/${id}/diagnose${stepId ? `?stepId=${stepId}` : ""}`),
  // Rules
  rules: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return fetchApi<any[]>('/api/rules' + qs);
  },
  createRule: (data: any) => fetchApi<any>('/api/rules', { method: 'POST', headers: CT_JSON, body: JSON.stringify(data) }),
  updateRule: (id: string, data: any) => fetchApi<any>(`/api/rules/${id}`, { method: 'PUT', headers: CT_JSON, body: JSON.stringify(data) }),
  deleteRule: (id: string) => fetchApi<any>(`/api/rules/${id}`, { method: 'DELETE' }),
  toggleRule: (id: string) => fetchApi<any>(`/api/rules/${id}/toggle`, { method: 'PUT' }),
  exportRules: () => fetchApi<any>('/api/rules/export'),
  // Telemetry
  telemetry: (runId: string) => fetchTelemetry(runId),
  runErrors: (runId: string) => fetchApi<any[]>(`/api/runs/${runId}/errors`),
  // Live Feed
  liveFeed: (since?: string, agent?: string) => {
    const params: string[] = [];
    if (since) params.push('since=' + encodeURIComponent(since));
    if (agent) params.push('agent=' + agent);
    const qs = params.length ? '?' + params.join('&') : '';
    return fetchApi<any[]>('/api/live-feed' + qs);
  },
  importRules: (data: any) => fetchApi<any>('/api/rules/import', { method: 'POST', headers: CT_JSON, body: JSON.stringify(data) }),
  // Performance
  performance: () => fetchApi<any>('/api/performance'),
  modelLimits: () => fetchApi<any[]>('/api/model-limits'),
  quota: () => fetchApi<any>('/api/quota'),
  // Scrape
  scrapeHistory: () => fetchApi<any[]>('/api/scrape/history'),
  scrape: (data: { url: string; adaptor?: string; format?: string }) => fetchApi<any>('/api/scrape', { method: 'POST', headers: CT_JSON, body: JSON.stringify(data) }),
  // Agent update
  updateAgent: (id: string, data: any) => fetchApi<any>(`/api/agents/${id}`, { method: 'PATCH', headers: CT_JSON, body: JSON.stringify(data) }),

  // PRD Generator
  prdGithubImport: (url: string) =>
    fetchApi<{ analysis: any; platform: string; url: string }>('/api/prd/github-import', { method: 'POST', headers: CT_JSON, body: JSON.stringify({ url }) }),
  prdAnalyze: (data: { url?: string; screenshot?: string; filename?: string }) =>
    fetchApi<any>('/api/prd/analyze', { method: 'POST', headers: CT_JSON, body: JSON.stringify(data) }),
  prdResearch: (data: { query?: string; topic?: string }) =>
    fetchApi<any>('/api/prd/research', { method: 'POST', headers: CT_JSON, body: JSON.stringify(data) }),
  prdChat: (data: { prdId?: string | null; message?: string; context?: any }) =>
    fetchApi<any>('/api/prd/chat', { method: 'POST', headers: CT_JSON, body: JSON.stringify(data) }),
  prdGenerate: (data: any) =>
    fetchApi<any>('/api/prd/generate', { method: 'POST', headers: CT_JSON, body: JSON.stringify(data) }),
  prdEnhance: (data: { prdId: string }) =>
    fetchApi<any>('/api/prd/enhance', { method: 'POST', headers: CT_JSON, body: JSON.stringify(data) }),
  prdScore: (data: { content?: string; prdId?: string }) =>
    fetchApi<any>('/api/prd/score', { method: 'POST', headers: CT_JSON, body: JSON.stringify(data) }),
  prdMockups: (data: { prdId?: string | null; prdContent?: string; title?: string }) =>
    fetchApi<any>('/api/prd/mockups', { method: 'POST', headers: CT_JSON, body: JSON.stringify(data) }),
  prdEstimate: (data: { content?: string; prdId?: string }) =>
    fetchApi<any>('/api/prd/estimate', { method: 'POST', headers: CT_JSON, body: JSON.stringify(data) }),
  prdStartRun: (data: { prdId: string; projectName?: string; workflow?: string }) =>
    fetchApi<any>('/api/prd/start-run', { method: 'POST', headers: CT_JSON, body: JSON.stringify(data) }),
  prdHistory: () => fetchApi<any[]>('/api/prd/history'),
  prdHistoryDetail: (id: string) => fetchApi<any>(`/api/prd/history/${id}`),
  prdTemplates: () => fetchApi<any[]>('/api/prd/templates'),
  prdBenchmark: (runId: string) => fetchApi<any>(`/api/prd/benchmark/${runId}`),
  prdAnalytics: () => fetchApi<any>('/api/prd/analytics'),
  prdComponents: (data: { content?: string; prdId?: string }) =>
    fetchApi<any>('/api/prd/components', { method: 'POST', headers: CT_JSON, body: JSON.stringify(data) }),
  prdClearScreens: (prdId: string) =>
    fetchApi<any>(`/api/prd/screens/${prdId}/clear`, { method: 'POST' }),
  prdDeleteScreen: (prdId: string, screenId: string) =>
    fetchApi<any>(`/api/prd/screens/${prdId}/${screenId}`, { method: 'DELETE' }),
  prdRegenerateScreen: (prdId: string, screenId: string, data?: { prompt?: string }) =>
    fetchApi<any>(`/api/prd/screens/${prdId}/${screenId}/regenerate`, { method: 'POST', headers: CT_JSON, body: JSON.stringify(data || {}) }),
  prdVariantScreen: (prdId: string, data: { sourceScreenId: string; prompt?: string }) =>
    fetchApi<any>(`/api/prd/screens/${prdId}/variant`, { method: 'POST', headers: CT_JSON, body: JSON.stringify(data) }),
  prdScreenCoverage: (data: { prdContent: string; screens: any[]; prdId?: string }) =>
    fetchApi<any>('/api/prd/screen-coverage', { method: 'POST', headers: CT_JSON, body: JSON.stringify(data) }),
  // Trend enhancement
  enhanceWithTrends: (prdContent: string) =>
    fetchApi<{ enhanced: string; trends: any }>("/api/prd/enhance-with-trends", { method: "POST", headers: CT_JSON, body: JSON.stringify({ prdContent }) }),
  // Trending apps
  scrapeTrending: (platform?: string, limit?: number) =>
    fetchApi<any[]>(`/api/scrape/trending?platform=${platform || 'ios'}&limit=${limit || 25}`),
};
