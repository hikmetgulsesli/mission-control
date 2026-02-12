export interface Agent {
  id: string;
  name: string;
  identityName: string;
  identityEmoji: string;
  model: string;
  workspace: string;
  bindings: number;
  isDefault: boolean;
}

export interface SystemMetrics {
  ram: { total: number; used: number; percent: number };
  cpu: { percent: number };
  disk: { total: number; used: number; percent: number };
  load: number;
}

export interface CronJob {
  id: string;
  name: string;
  enabled: boolean;
  schedule: { kind: string; expr: string; tz: string };
  payload: { kind: string; message: string; model: string };
  delivery: { mode: string; channel: string; to: string };
  state: {
    nextRunAtMs: number;
    lastRunAtMs: number;
    lastStatus: string;
    lastDurationMs: number;
    lastError?: string;
    consecutiveErrors?: number;
  };
}

export interface Workflow {
  id: string;
  name: string;
  steps: { id: string; agent: string }[];
}

export interface RunStep {
  id: string;
  agent: string;
  status: string;
  output?: string;
}

export interface Run {
  id: string;
  workflow: string;
  status: string;
  currentStep?: string;
  startedAt?: number;
  finishedAt?: number;
  task?: string;
  progress?: string;
  steps?: RunStep[];
  storyCount?: number;
}

export interface CostData {
  totalToday: number;
  totalAllTime: number;
  projectedMonthly: number;
  breakdownAllTime: { model: string; cost: number }[];
  breakdownToday: { model: string; cost: number }[];
  subagentCostAllTime: number;
  subagentCostToday: number;
  tokenUsage: Record<string, number>;
  tokenUsageToday: Record<string, number>;
}

export interface OverviewData {
  agents: Agent[];
  agentCount: number;
  activeRuns: Run[];
  activeRunCount: number;
  cronCount: number;
  costToday: number;
  costAllTime: number;
  system: SystemMetrics | null;
  gateway: { status: string; pid: number; uptime: string; memory: string } | null;
  sessions: any[];
  alerts: any[];
}

export interface Session {
  name: string;
  key: string;
  agent: string;
  model: string;
  contextPct: number;
  lastActivity: string;
  updatedAt: number;
  totalTokens: number;
  type: string;
}

export interface DockerContainer {
  ID: string;
  Names: string;
  Image: string;
  Status: string;
  Ports: string;
  State: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  assigned_agent: string;
  priority: "low" | "medium" | "high" | "critical";
  status: "backlog" | "todo" | "in_progress" | "review" | "done";
  images: string[];
  created_at: string;
  updated_at: string;
}
