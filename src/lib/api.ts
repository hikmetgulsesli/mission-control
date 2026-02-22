import type { OverviewData, Agent, Session, CronJob, Workflow, Run, SystemMetrics, DockerContainer, CostData, Task, ProjectData, TaskCreateData } from './types';

const BASE = '';

async function fetchApi<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, opts);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json();
}

const CT_JSON = { 'Content-Type': 'application/json' };

export const api = {
  overview: () => fetchApi<OverviewData>('/api/overview'),
  agents: () => fetchApi<Agent[]>('/api/agents'),
  agent: (id: string) => fetchApi<Agent>(`/api/agents/${id}`),
  agentHistory: (id: string, limit = 50) => fetchApi<{ messages: any[] }>(`/api/agents/${id}/history?limit=${limit}`),
  agentLive: (id: string) => fetchApi<any>(`/api/agents/${id}/live`),
  agentActivity: (id: string) => fetchApi<any>(`/api/agents/${id}/activity`),
  sessions: () => fetchApi<Session[]>('/api/sessions'),
  cron: () => fetchApi<CronJob[]>('/api/cron'),
  cronToggle: (id: string) => fetchApi<{ success: boolean }>(`/api/cron/${id}/toggle`, { method: 'POST' }),
  workflows: () => fetchApi<Workflow[]>('/api/workflows'),
  runs: () => fetchApi<Run[]>('/api/runs'),
  runDetail: (id: string) => fetchApi<any>(`/api/runs/${id}/detail`),
  runEvents: (id: string) => fetchApi<any[]>(`/api/runs/${id}/events`),
  startRun: (workflow: string, task: string) =>
    fetchApi<any>('/api/runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workflow, task }),
    }),
  deleteRun: (id: string) =>
    fetchApi<any>(`/api/runs/${id}`, { method: 'DELETE' }),
  retryRun: (id: string, step_id?: string, message?: string) =>
    fetchApi<any>(`/api/runs/${id}/retry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step_id, message }),
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
  // New: Stories + Plan for runs
  runStories: (id: string) => fetchApi<any[]>(`/api/setfarm/runs/${id}/stories`),
  runPlan: (id: string) => fetchApi<any>(`/api/setfarm/runs/${id}/plan`),
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
  unstickRun: (id: string, stepId?: string) =>
    fetchApi<any>(`/api/runs/${id}/unstick`, {
      method: "POST",
      headers: CT_JSON,
      body: JSON.stringify({ stepId }),
    }),
  // Smart Stuck Recovery v2
  diagnoseRun: (id: string, stepId?: string) =>
    fetchApi<any>(`/api/runs/${id}/diagnose${stepId ? `?stepId=${stepId}` : ""}`),
  autofixRun: (id: string, cause: string, storyId?: string) =>
    fetchApi<any>(`/api/runs/${id}/autofix`, {
      method: "POST",
      headers: CT_JSON,
      body: JSON.stringify({ cause, storyId }),
    }),
  skipStory: (runId: string, storyId: string, reason: string) =>
    fetchApi<any>(`/api/runs/${runId}/skip-story`, {
      method: "POST",
      headers: CT_JSON,
      body: JSON.stringify({ storyId, reason }),
    }),
};
