import type { SetfarmOperationalActiveRunStatusV1 } from "../../server/shared/setfarm-operational-active-run-status-v1.js";
import type { ModelIdentity } from '../../server/shared/agents.js';

export interface Agent {
  id: string;
  name: string;
  identityName: string;
  identityEmoji: string;
  model: string;
  modelIdentity?: ModelIdentity;
  workspace: string;
  bindings: number;
  isDefault: boolean;
}

export interface MetricObservation {
  source: string;
  observedAt: string;
  status: 'available' | 'unknown';
}
export interface SystemMetrics {
  ram: MetricObservation & { total: number | null; used: number | null; percent: number | null; semantics: 'total-os.freemem' };
  cpu: MetricObservation & { percent: number | null };
  disk: MetricObservation & { total: number | null; used: number | null; percent: number | null;
    path: string; mount: string | null; totalBytes: number | null; usedBytes: number | null; freeBytes: number | null };
  load: number | null;
  loadObservation?: MetricObservation;
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

export type UsageAvailability = 'available' | 'unknown';

export interface CostTokenRow {
  model: string;
  calls?: number | null;
  input?: string | number | null;
  output?: string | number | null;
  cacheRead?: string | number | null;
  totalTokens?: string | number | null;
  cost?: number | null;
}

export interface CostData {
  totalToday: number | null;
  totalAllTime: number | null;
  projectedMonthly: number | null;
  breakdownAllTime: { model: string; cost: number }[];
  breakdownToday: { model: string; cost: number }[];
  subagentCostAllTime: number | null;
  subagentCostToday: number | null;
  tokenUsage: CostTokenRow[];
  tokenUsageToday: CostTokenRow[];
  costStatus: Record<'totalToday' | 'totalAllTime' | 'projectedMonthly' | 'subagentCostAllTime' | 'subagentCostToday', UsageAvailability>;
  usageSource: 'dashboard_data';
}

export interface PerformanceAgentStat {
  id: string;
  model: string;
  modelIdentity?: ModelIdentity;
  sessionCount: number;
  totalTokens: number | null;
  lastActive: number | null;
}

export interface PerformanceData {
  agents: Record<string, PerformanceAgentStat>;
  modelCosts: Record<string, number>;
  modelCostsToday: Record<string, number>;
  modelTokens: Record<string, { calls: number | null; totalTokens: string | number | null; cost: number | null }>;
  totalCostToday: number | null;
  totalCostAllTime: number | null;
  sessionsStatus: UsageAvailability;
  costStatus: {today: UsageAvailability; allTime: UsageAvailability};
  usageSource: 'dashboard_data';
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
  crons?: CronStatusItem[];
  agentLastActive?: Record<string, number>;
  openPRs?: OpenPR[];
  recentDeploys?: DeployInfo[];
  agentSummary?: AgentSummary[];
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
  status: "registered" | "building" | "completed" | "failed" | "cancelled";
  execution: {
    schema: "mission-control.project-execution.v1";
    state: SetfarmOperationalActiveRunStatusV1 | "terminal" | "unbound" | "unavailable";
    active: boolean;
    runId: string | null;
    runStatus: string | null;
    protocol: "legacy" | "shadow" | "v3" | null;
    source: "setfarm_postgres_run" | "none";
    reasonCode: string;
  };
  runtime: {
    state: "active" | "inactive" | "unknown";
    checkedAt: string | null;
    reasonCode: string;
  };
  receipt: null | {
    status: string;
    serviceStatus: string;
    projectionHash: string;
    projectRecordHash: string;
  };
  productCompilerProtocol?: string;
  supervisor?: unknown;
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

export interface SetfarmEvent {
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
