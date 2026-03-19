import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { GlitchText } from "../components/GlitchText";
import { StoryList } from "../components/run-detail/StoryList";
import { StepTimeline } from "../components/run-detail/StepTimeline";

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
}

type Tab = "overview" | "chat" | "files" | "stories";

export function RunDetail({ runId, onBack }: { runId: string; onBack: () => void }) {
  const [data, setData] = useState<RunDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("overview");
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState(Date.now());
  const [refreshing, setRefreshing] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setRefreshing(true);
      try {
        const d = await api.runDetail(runId);
        if (!cancelled) { setData(d); setLastRefreshed(Date.now()); }
      } catch (e: any) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) { setLoading(false); setRefreshing(false); }
      }
    };
    load();
    const interval = setInterval(load, 10000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [runId]);

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 5000);
    return () => clearInterval(t);
  }, []);

  if (loading) return <div className="page-loading">Loading run details...</div>;
  if (error) return <div className="page-loading">Error: {error}</div>;
  if (!data) return null;

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "overview", label: "Pipeline" },
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
          {(data as any).storiesDone !== undefined && data.storyCount ? (
            <span className="rd-story-progress">
              <span className="rd-story-bar">
                <span className="rd-story-fill" style={{ width: `${((data as any).storiesDone / data.storyCount) * 100}%` }} />
              </span>
              {(data as any).storiesDone}/{data.storyCount} stories
            </span>
          ) : data.storyCount ? <span>{data.storyCount} stories</span> : null}
          {(data as any).currentStoryId && (
            <span className="rd-current-story">
              {(data as any).currentStoryId}: {((data as any).currentStoryTitle || "").slice(0, 40)}
            </span>
          )}
          {data.startedAt && <span>{new Date(data.startedAt).toLocaleString("tr-TR")}</span>}
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
                      {new Date(msg.timestamp).toLocaleString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit", day: "2-digit", month: "2-digit" })}
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
            return (
              <div key={commit.hash || i} className="rd-commit">
                <div className="rd-commit-header">
                  <span className="rd-commit-hash">{commit.hash}</span>
                  <span className="rd-commit-msg">{commit.message}</span>
                  <span className="rd-commit-date">{commit.date?.split(" ")[0]}</span>
                </div>
                {stats && stats.files.length > 0 && (
                  <div className="rd-commit-stats">
                    {stats.files.map((f, j) => (
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
