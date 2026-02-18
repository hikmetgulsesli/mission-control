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
  storiesDone?: number;
  storiesRemaining?: number;
  currentStoryId?: string;
  currentStoryTitle?: string;
  updatedAt?: string;
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
  sessions: Session[];
  alerts: { agent?: string; message?: string; timestamp?: number; type?: string; [key: string]: unknown }[];
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

export interface CronStatusItem {
  id: string;
  name: string;
  status: string;
  lastRunAt?: number;
  lastDuration?: number;
}

export interface OpenPR {
  number: number;
  title: string;
  url: string;
  headRefName: string;
  updatedAt?: string;
  mergeable?: string;
}

export interface DeployInfo {
  id?: string;
  name: string;
  port: number;
  online: boolean;
  subdomain?: string;
}

export interface AgentSummary {
  id: string;
  status: string;
  currentTask?: string;
  lastActivity?: number | string;
}

export interface ModelLimitItem {
  id: string;
  name: string;
  plan: string;
  cost: string;
  color: string;
  agents: string[];
  limits?: { promptsPer5h?: number };
  usage?: { today?: { cost: number } };
  models?: ModelBadge[];
}

export interface ModelBadge {
  id: string;
  name: string;
  status: string;
}

export interface ProjectData {
  id: string;
  name: string;
  description?: string;
  repo?: string;
  stack?: string[];
  status?: string;
}

export interface TaskCreateData {
  title: string;
  description: string;
  assigned_agent: string;
  priority: Task['priority'];
  status: Task['status'];
  images?: string[];
}

// Pipeline / Stuck Recovery types
export interface StuckStep {
  id: string;
  name: string;
  stuckMinutes: number;
  totalElapsedMinutes?: number;
  stuckReason?: 'classic' | 'restart-loop' | 'total-elapsed';
  abandonResets: number;
}

export interface StuckRun {
  id: string;
  workflowId: string;
  status: string;
  stuckSteps: StuckStep[];
}

export interface Diagnosis {
  stepId?: string;
  storyId?: string | null;
  cause: string;
  fixable: boolean;
  description: string;
  excerpt?: string;
  suggestedFix?: string | null;
}

export interface AntfarmEvent {
  id: string;
  type: string;
  runId: string;
  stepId?: string;
  agentId?: string;
  timestamp: string;
  message?: string;
}

export interface Story {
  id: string;
  run_id: string;
  status: string;
  title?: string;
  output?: string;
}
