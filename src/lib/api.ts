const BASE = '';

async function fetchApi<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, opts);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json();
}

export const api = {
  overview: () => fetchApi<any>('/api/overview'),
  agents: () => fetchApi<any[]>('/api/agents'),
  agent: (id: string) => fetchApi<any>(`/api/agents/${id}`),
  agentHistory: (id: string, limit = 50) => fetchApi<any>(`/api/agents/${id}/history?limit=${limit}`),
  agentActivity: (id: string) => fetchApi<any>(`/api/agents/${id}/activity`),
  sessions: () => fetchApi<any[]>('/api/sessions'),
  cron: () => fetchApi<any[]>('/api/cron'),
  cronToggle: (id: string) => fetchApi<any>(`/api/cron/${id}/toggle`, { method: 'POST' }),
  workflows: () => fetchApi<any[]>('/api/workflows'),
  runs: () => fetchApi<any[]>('/api/runs'),
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
  system: () => fetchApi<any>('/api/system'),
  docker: () => fetchApi<any[]>('/api/system/docker'),
  costs: () => fetchApi<any>('/api/costs'),
  // Tasks
  projects: () => fetchApi<any[]>("/api/projects"),
  deleteProject: (id: string, confirmName: string) => fetchApi<any>(`/api/projects/${id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmName }) }),
  tasks: () => fetchApi<any[]>('/api/tasks'),
  createTask: (data: any) => fetchApi<any>('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
  updateTask: (id: string, data: any) => fetchApi<any>("/api/tasks/" + id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
  deleteTask: (id: string) => fetchApi<any>("/api/tasks/" + id, { method: 'DELETE' }),
  updateTaskStatus: (id: string, status: string) => fetchApi<any>("/api/tasks/" + id + "/status", { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) }),
  // Images
  uploadTaskImage: (id: string, base64: string, filename: string) => fetchApi<any>("/api/tasks/" + id + "/images", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ base64, filename }) }),
  deleteTaskImage: (id: string, filename: string) => fetchApi<any>("/api/tasks/" + id + "/images/" + filename, { method: "DELETE" }),
  // Approvals
  approvals: () => fetchApi<any[]>('/api/approvals'),
  approveStep: (id: string) => fetchApi<any>('/api/approvals/' + id + '/approve', { method: 'POST' }),
  rejectStep: (id: string, reason: string) => fetchApi<any>('/api/approvals/' + id + '/reject', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }) }),
  // Antfarm Activity
  antfarmActivity: (limit = 50) => fetchApi<any[]>('/api/antfarm/activity?limit=' + limit),
  antfarmAgents: () => fetchApi<any[]>('/api/antfarm/agents'),
  antfarmAlerts: () => fetchApi<any>('/api/antfarm/alerts'),
  antfarmPipeline: () => fetchApi<any[]>('/api/antfarm/pipeline'),
};
