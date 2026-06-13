import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { GlitchText } from "../components/GlitchText";
import { StoryList } from "../components/run-detail/StoryList";
import { StepTimeline } from "../components/run-detail/StepTimeline";
import { TelemetryChart } from "../components/run-detail/TelemetryChart";
import { InlinePlanView } from "../components/pipeline/InlinePlanView";
import { normalizeVisibleVisualStatus } from "../lib/status";

interface ChatMessage {
  role: string;
  text: string;
  timestamp?: string;
}

interface AgentChat {
  agent: string;
  sessionId: string;
  messages: ChatMessage[];
}

interface GitCommit {
  hash: string;
  message: string;
  date: string;
  author: string;
}

interface DiffStat {
  hash: string;
  files: string[];
}

interface SupervisorSummary {
  available: boolean;
  status: string;
  source?: string;
  workdir: string | null;
  stateRoot: string | null;
  scope?: string;
  provider?: string;
  openBlockers: number;
  warnings: number;
  resolved: number;
  pendingInterventions: number;
  checklistItems: number;
  checklistPassed: number;
  interventionText?: string;
  visualReportText?: string;
  artifacts: Record<string, string | undefined>;
  visual: {
    status: "pass" | "fail" | "skipped" | "missing";
    issueCount: number;
    controlsChecked: number;
    routesChecked: string[];
    screenshots: string[];
    reportPath?: string;
  };
}

interface Story {
  id: string;
  title: string;
  description?: string;
  acceptanceCriteria?: string[];
}

interface StepDetail {
  id: string;
  agent: string;
  status: string;
  output: string | null;
  retryCount: number;
  updatedAt?: string;
  createdAt?: string;
}

interface RunDetailData {
  id: string;
  workflow: string;
  status: string;
  currentStep?: string;
  task?: string;
  startedAt?: number;
  progress?: string;
  storyCount?: number;
  fullSteps: StepDetail[];
  stories: Story[];
  gitLog: GitCommit[];
  diffStats: DiffStat[];
  fileTree: string[];
  agentChats: AgentChat[];
  progressLog: string;
  supervisor?: SupervisorSummary | null;
  currentStoryId?: string | null;
  currentStoryTitle?: string | null;
  storiesDone?: number;
  operationalModel?: any | null;
}

type Tab = "overview" | "contract" | "stack" | "supervisor" | "chat" | "files" | "stories" | "telemetry";

function asArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function parseTimestamp(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || !value) return undefined;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

function normalizeRunDetail(raw: any, operationalModel?: any | null): RunDetailData {
  const run = raw?.run || raw || {};
  const rawSteps = asArray<any>(raw?.fullSteps || raw?.steps);
  const rawStories = asArray<any>(raw?.stories);
  const agentChats = asArray<AgentChat>(raw?.agentChats).map((chat: any) => ({
    agent: String(chat.agent || ""),
    sessionId: String(chat.sessionId || chat.session_id || ""),
    messages: asArray<ChatMessage>(chat.messages),
  }));
  const diffStats = asArray<DiffStat>(raw?.diffStats).map((stat: any) => ({
    hash: String(stat.hash || ""),
    files: asArray<string>(stat.files),
  }));

  return {
    id: String(raw?.id || run.id || ""),
    workflow: String(raw?.workflow || run.workflow || run.workflow_id || ""),
    status: String(raw?.status || run.status || "unknown"),
    currentStep: raw?.currentStep || run.current_step || run.currentStep,
    task: String(raw?.task || run.task || ""),
    startedAt: raw?.startedAt || parseTimestamp(run.started_at || run.created_at || raw?.createdAt),
    progress: raw?.progress || run.progress,
    storyCount: Number(raw?.storyCount || run.story_count || rawStories.length) || rawStories.length,
    currentStoryId: raw?.currentStoryId || run.currentStoryId || run.current_story_id || null,
    currentStoryTitle: raw?.currentStoryTitle || run.currentStoryTitle || null,
    storiesDone: Number(operationalModel?.stories?.completed ?? raw?.storiesDone ?? run.storyProgress?.completed ?? run.story_progress?.completed ?? 0),
    fullSteps: rawSteps.map((step: any) => ({
      id: String(step.stepId || step.step_id || step.id || ""),
      agent: String(step.agent || step.agent_id || step.step_id || ""),
      status: String(step.status || "pending"),
      output: step.output ?? null,
      retryCount: Number(step.retryCount ?? step.retry_count ?? 0),
      updatedAt: step.updatedAt || step.updated_at,
      createdAt: step.createdAt || step.created_at,
    })),
    stories: rawStories.map((story: any) => ({
      id: String(story.storyId || story.story_id || story.id || ""),
      title: String(story.title || story.name || story.storyId || story.story_id || story.id || "Untitled story"),
      description: story.description,
      acceptanceCriteria: asArray<string>(story.acceptanceCriteria || story.acceptance_criteria),
    })),
    gitLog: asArray<GitCommit>(raw?.gitLog),
    diffStats,
    fileTree: asArray<string>(raw?.fileTree),
    agentChats,
    progressLog: String(raw?.progressLog || raw?.progress_log || ""),
    supervisor: raw?.supervisor || null,
    operationalModel: operationalModel || null,
  };
}

export function RunDetail({ runId, onBack, initialTab = "overview" }: { runId: string; onBack: () => void; initialTab?: Tab }) {
  const [data, setData] = useState<RunDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>(initialTab);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState(Date.now());
  const [refreshing, setRefreshing] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setRefreshing(true);
      try {
        const [d, operationalModel] = await Promise.all([
          api.runDetail(runId),
          api.runOperationalModel(runId).catch(() => null),
        ]);
        if (!cancelled) { setData(normalizeRunDetail(d, operationalModel)); setLastRefreshed(Date.now()); }
      } catch (e: any) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) { setLoading(false); setRefreshing(false); }
      }
    };
    load();
    const interval = setInterval(load, 3000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [runId]);

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 5000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    setTab(initialTab);
  }, [runId, initialTab]);

  if (loading) return <div className="page-loading">Loading run details...</div>;
  if (error) return <div className="page-loading">Error: {error}</div>;
  if (!data) return null;

  const operationalFailure = data.operationalModel?.failure;
  const isManualReviewFailure = Boolean(
    operationalFailure?.present &&
    operationalFailure.recoveryPolicy === "manual_review" &&
    operationalFailure.retryable === false
  );
  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "overview", label: "Pipeline" },
    { id: "contract", label: "Run Contract", count: data.supervisor?.checklistItems || undefined },
    { id: "stack", label: "Stack", count: data.operationalModel?.failure?.present ? 1 : undefined },
    { id: "supervisor", label: "Supervisor", count: data.supervisor?.openBlockers || data.supervisor?.visual?.issueCount || undefined },
    { id: "telemetry", label: "Telemetry" },
    { id: "chat", label: "Agent Chat", count: data.agentChats.length },
    { id: "files", label: "Files", count: data.fileTree.length },
    { id: "stories", label: "Stories", count: data.stories.length },
  ];

  return (
    <div className="run-detail-page">
      <div className="rd-header">
        <button className="rd-back" onClick={onBack}>← Back</button>
        <div className="rd-title-row">
          <GlitchText text={data.task?.split("\n")[0].slice(0, 60) || "Run Detail"} tag="h2" />
          <span className={`rd-status rd-status--${data.status}`}>
            {data.status === "running" && <span className="rd-status-pulse" />}
            {data.status}
          </span>
          <span className={`rd-refresh-indicator ${refreshing ? "rd-refresh-indicator--active" : ""}`} title="Auto-refreshing every 10s">
            {(() => { const ago = Math.floor((Date.now() - lastRefreshed) / 1000); return ago < 5 ? "just now" : `${ago}s ago`; })()}
          </span>
        </div>
        <div className="rd-meta">
          <span>#{data.id.slice(0, 8)}</span>
          <span>{data.workflow}</span>
          {data.progress && <span>{data.progress}</span>}
          {data.storiesDone !== undefined && data.storyCount ? (
            <span className="rd-story-progress">
              <span className="rd-story-bar">
                <span className="rd-story-fill" style={{ width: `${(data.storiesDone / data.storyCount) * 100}%` }} />
              </span>
              {data.storiesDone}/{data.storyCount} stories
            </span>
          ) : data.storyCount ? <span>{data.storyCount} stories</span> : null}
          {data.currentStoryId && (
            <span className="rd-current-story">
              {data.currentStoryId}: {(data.currentStoryTitle || "").slice(0, 40)}
            </span>
          )}
          {data.operationalModel?.stack && <span>{data.operationalModel.stack.stackPackId}</span>}
          {operationalFailure?.present && (
            <span
              className={`rd-current-story ${isManualReviewFailure ? "rd-current-story--manual" : ""}`}
              title={operationalFailure.summary || operationalFailure.category || ""}
            >
              {isManualReviewFailure ? "MANUAL REVIEW" : operationalFailure.owner}: {operationalFailure.category}
            </span>
          )}
          {data.startedAt && <span>{new Date(data.startedAt).toLocaleString("en-US")}</span>}
        </div>
      </div>

      <div className="rd-tabs">
        {tabs.map(t => (
          <button
            key={t.id}
            className={`rd-tab ${tab === t.id ? "rd-tab--active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && <span className="rd-tab-count">{t.count}</span>}
          </button>
        ))}
      </div>

      <div className="rd-content">
        {tab === "overview" && (
          <StepTimeline steps={data.fullSteps} progressLog={data.progressLog} />
        )}
        {tab === "contract" && (
          <div className="rd-contract-wrap">
            <InlinePlanView runId={runId} initialTab="contract" />
          </div>
        )}
        {tab === "stack" && (
          <StackTab model={data.operationalModel || null} />
        )}
        {tab === "supervisor" && (
          <SupervisorTab supervisor={data.supervisor || null} model={data.operationalModel || null} />
        )}
        {tab === "telemetry" && (
          <TelemetryChart runId={runId} />
        )}
        {tab === "chat" && (
          <ChatTab chats={data.agentChats} selectedAgent={selectedAgent} onSelectAgent={setSelectedAgent} />
        )}
        {tab === "files" && (
          <FilesTab fileTree={data.fileTree} gitLog={data.gitLog} diffStats={data.diffStats} />
        )}
        {tab === "stories" && (
          <StoryList stories={data.stories} />
        )}
      </div>
    </div>
  );
}

function SupervisorTab({ supervisor, model }: { supervisor: SupervisorSummary | null; model: any | null }) {
  if (!supervisor || !supervisor.available) {
    if (!model) return <div className="rd-empty">No supervisor data found for this run</div>;
    return <SupervisorFallback model={model} />;
  }
  const visual = supervisor.visual || { status: "missing", issueCount: 0, controlsChecked: 0, routesChecked: [], screenshots: [] };
  const visualStatus = normalizeVisibleVisualStatus(visual.status);
  const derivedOpenBlockers = supervisor.openBlockers || (supervisor.status === "blocked" ? 1 : 0);

  return (
    <div className="rd-supervisor">
      <div className="rd-supervisor-grid">
        <Metric label="Status" value={supervisor.status.toUpperCase()} tone={supervisor.status} />
        <Metric label="Blockers" value={String(derivedOpenBlockers)} tone={derivedOpenBlockers > 0 ? "blocked" : "passed"} />
        <Metric label="Warnings" value={String(supervisor.warnings)} tone={supervisor.warnings > 0 ? "warning" : "passed"} />
        <Metric label="Checklist" value={`${supervisor.checklistPassed}/${supervisor.checklistItems}`} />
        <Metric label="Visual QA" value={`${visualStatus.toUpperCase()} / ${visual.issueCount}`} tone={visualStatus === "fail" ? "blocked" : visualStatus === "pass" ? "passed" : "warning"} />
        <Metric label="Interventions" value={String(supervisor.pendingInterventions)} tone={supervisor.pendingInterventions > 0 ? "fixing" : "passed"} />
      </div>
      <div className="rd-supervisor-meta">
        <div><span>Source</span><code>{supervisor.source || "-"}</code></div>
        <div><span>Scope</span><code>{supervisor.scope || "-"}</code></div>
        <div><span>Provider</span><code>{supervisor.provider || "-"}</code></div>
        <div><span>Workdir</span><code>{supervisor.workdir || "-"}</code></div>
        <div><span>State</span><code>{supervisor.stateRoot || "-"}</code></div>
        {visual.reportPath && <div><span>Visual Report</span><code>{visual.reportPath}</code></div>}
      </div>
      {(supervisor.interventionText || supervisor.visualReportText) && (
        <div className="rd-supervisor-notes">
          {supervisor.interventionText && <pre>{supervisor.interventionText}</pre>}
          {supervisor.visualReportText && <pre>{supervisor.visualReportText}</pre>}
        </div>
      )}
    </div>
  );
}

function SupervisorFallback({ model }: { model: any }) {
  const failure = model.failure || {};
  const stack = model.stack || {};
  const pipeline = model.pipeline || {};
  const stories = model.stories || {};
  const isManualReviewFailure = Boolean(failure.present && failure.recoveryPolicy === "manual_review" && failure.retryable === false);
  const retryTone = failure.retryable ? "warning" : isManualReviewFailure ? "manual" : failure.present ? "blocked" : "passed";
  const retryValue = failure.retryable ? "RETRYABLE" : isManualReviewFailure ? "MANUAL REVIEW" : failure.present ? "STOPPED" : "CLEAR";

  return (
    <div className="rd-supervisor">
      <div className="rd-supervisor-banner">
        <span>Operational supervisor fallback</span>
        <strong>{failure.summary || failure.category || "No ledger, using Setfarm model"}</strong>
      </div>
      <div className="rd-supervisor-grid">
        <Metric label="Stack" value={String(stack.stackPackId || "unknown").toUpperCase()} />
        <Metric label="Failure Owner" value={String(failure.owner || "none").toUpperCase()} tone={failure.present ? failure.owner : "passed"} />
        <Metric label="Recovery" value={String(failure.recoveryPolicy || "no_action").toUpperCase()} tone={retryTone} />
        <Metric label="Retry Decision" value={retryValue} tone={retryTone} />
        <Metric label="Source Step" value={String(failure.sourceStepId || pipeline.failedStepId || "-").toUpperCase()} tone={failure.present ? "blocked" : "passed"} />
        <Metric label="Stories" value={`${stories.completed || 0}/${stories.total || 0}`} tone={(stories.failed || 0) > 0 ? "blocked" : "passed"} />
      </div>
      <div className="rd-supervisor-meta">
        <div><span>Reason</span><code>{failure.reason || "-"}</code></div>
        <div><span>Source Story</span><code>{failure.sourceStoryId || pipeline.currentStoryId || "-"}</code></div>
        <div><span>Current Step</span><code>{pipeline.currentStepId || "-"}</code></div>
        <div><span>Failed Step</span><code>{pipeline.failedStepId || "-"}</code></div>
        <div><span>Runtime</span><code>{stack.runtimeKind || "-"}</code></div>
        <div><span>Smoke Runner</span><code>{stack.systemSmokeRunner || "-"}</code></div>
      </div>
    </div>
  );
}

function StackTab({ model }: { model: any | null }) {
  if (!model) return <div className="rd-empty">No operational model found for this run</div>;
  const stack = model.stack || {};
  const failure = model.failure || {};
  const stories = model.stories || {};
  const pipeline = model.pipeline || {};
  const isManualReviewFailure = Boolean(failure.present && failure.recoveryPolicy === "manual_review" && failure.retryable === false);
  const recoveryTone = failure.retryable ? "warning" : isManualReviewFailure ? "manual" : failure.present ? "blocked" : "passed";
  return (
    <div className="rd-supervisor">
      <div className="rd-supervisor-grid">
        <Metric label="Stack" value={String(stack.stackPackId || "unknown").toUpperCase()} tone="neutral" />
        <Metric label="Runtime" value={String(stack.runtimeKind || "unknown").toUpperCase()} tone="neutral" />
        <Metric label="Smoke" value={String(stack.systemSmokeRunner || "none").toUpperCase()} tone="neutral" />
        <Metric label="Failure Owner" value={String(failure.owner || "none").toUpperCase()} tone={failure.present ? failure.owner : "passed"} />
        <Metric label="Recovery" value={String(failure.recoveryPolicy || "no_action").toUpperCase()} tone={recoveryTone} />
        <Metric label="Stories" value={`${stories.completed || 0}/${stories.total || 0}`} tone={(stories.failed || 0) > 0 ? "blocked" : "passed"} />
      </div>
      <div className="rd-supervisor-meta">
        <div><span>Label</span><code>{stack.label || "-"}</code></div>
        <div><span>Current Step</span><code>{pipeline.currentStepId || "-"}</code></div>
        <div><span>Failed Step</span><code>{pipeline.failedStepId || "-"}</code></div>
        <div><span>Evidence</span><code>{Array.isArray(stack.evidenceClasses) ? stack.evidenceClasses.join(", ") : "-"}</code></div>
        <div><span>Reason</span><code>{failure.reason || "-"}</code></div>
        <div><span>Summary</span><code>{failure.summary || "-"}</code></div>
      </div>
    </div>
  );
}

function Metric({ label, value, tone = "neutral" }: { label: string; value: string; tone?: string }) {
  return (
    <div className={`rd-supervisor-metric rd-supervisor-metric--${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ChatTab({ chats, selectedAgent, onSelectAgent }: {
  chats: AgentChat[];
  selectedAgent: string | null;
  onSelectAgent: (a: string | null) => void;
}) {
  const agents = [...new Set(chats.map(c => c.agent))];
  const active = selectedAgent || agents[0] || null;
  const activeChats = chats.filter(c => c.agent === active).slice().reverse();

  if (chats.length === 0) {
    return <div className="rd-empty">No agent conversations found for this run</div>;
  }

  return (
    <div className="rd-chat-layout">
      <div className="rd-chat-sidebar">
        <h4>Agents</h4>
        {agents.map(agent => {
          const msgCount = chats.filter(c => c.agent === agent).reduce((sum, c) => sum + c.messages.length, 0);
          return (
            <button
              key={agent}
              className={`rd-agent-btn ${active === agent ? "rd-agent-btn--active" : ""}`}
              onClick={() => onSelectAgent(agent)}
            >
              <span className="rd-agent-name">{agent.split("/").pop()}</span>
              <span className="rd-agent-count">{msgCount}</span>
            </button>
          );
        })}
      </div>
      <div className="rd-chat-messages">
        {activeChats.map(chat => (
          <div key={chat.sessionId} className="rd-chat-session">
            <div className="rd-chat-session-id">Session: {chat.sessionId.slice(0, 8)}</div>
            {[...chat.messages].reverse().map((msg, i) => (
              <div key={i} className={`rd-msg rd-msg--${msg.role}`}>
                <div className="rd-msg-header">
                  <span className="rd-msg-role">{msg.role}</span>
                  {msg.timestamp && (
                    <span className="rd-msg-time">
                      {new Date(msg.timestamp).toLocaleString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", day: "2-digit", month: "2-digit" })}
                    </span>
                  )}
                </div>
                <div className="rd-msg-text">{msg.text}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function FilesTab({ fileTree, gitLog, diffStats }: {
  fileTree: string[];
  gitLog: GitCommit[];
  diffStats: DiffStat[];
}) {
  return (
    <div className="rd-files">
      {gitLog.length > 0 && (
        <div className="rd-git-section">
          <h3 className="rd-section-title">COMMITS ({gitLog.length})</h3>
          {gitLog.map((commit, i) => {
            const stats = diffStats.find(d => d.hash === commit.hash);
            const files = stats?.files || [];
            return (
              <div key={commit.hash || i} className="rd-commit">
                <div className="rd-commit-header">
                  <span className="rd-commit-hash">{commit.hash}</span>
                  <span className="rd-commit-msg">{commit.message}</span>
                  <span className="rd-commit-date">{commit.date?.split(" ")[0]}</span>
                </div>
                {files.length > 0 && (
                  <div className="rd-commit-stats">
                    {files.map((f, j) => (
                      <div key={j} className="rd-commit-file">{f}</div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {fileTree.length > 0 && (
        <div className="rd-tree-section">
          <h3 className="rd-section-title">FILE TREE ({fileTree.length} files)</h3>
          <div className="rd-file-tree">
            {fileTree.map((f, i) => (
              <div key={i} className="rd-file-item">
                <span className="rd-file-icon">
                  {f.endsWith(".ts") || f.endsWith(".tsx") || f.endsWith(".js") || f.endsWith(".jsx") ? "\u{1F4C4}" :
                   f.endsWith(".json") ? "\u{1F4CB}" :
                   f.endsWith(".md") ? "\u{1F4DD}" :
                   f.endsWith(".css") ? "\u{1F3A8}" :
                   f.includes("Dockerfile") ? "\u{1F433}" :
                   f.includes(".yml") || f.includes(".yaml") ? "\u2699\uFE0F" :
                   "\u{1F4C1}"}
                </span>
                {f}
              </div>
            ))}
          </div>
        </div>
      )}

      {fileTree.length === 0 && gitLog.length === 0 && (
        <div className="rd-empty">No file changes found</div>
      )}
    </div>
  );
}
