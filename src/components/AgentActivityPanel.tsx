import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { AGENT_MAP } from '../lib/constants';

function formatDuration(ms: number): string {
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return '<1m';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

function timeAgo(ts: string): string {
  if (!ts) return 'never';
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface AgentActivityData {
  agentId: string;
  totalRuns: number;
  runs: {
    runId: string;
    workflow: string;
    task: string;
    step: string;
    status: string;
    output: string;
    completedAt: string;
  }[];
}

export function AgentActivityPanel({ agentId, onClose }: { agentId: string; onClose: () => void }) {
  const [data, setData] = useState<AgentActivityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<any[]>([]);

  const agent = AGENT_MAP[agentId];

  useEffect(() => {
    Promise.all([
      api.agentActivity(agentId).catch(() => null),
      api.sessions().catch(() => []),
    ]).then(([actData, sessData]) => {
      setData(actData);
      // Filter sessions for this agent
      const agentSessions = (sessData || []).filter((s: any) => {
        const sAgent = s.agentId || s.agent;
        return sAgent === agentId || sAgent === (agentId === 'main' ? 'arya' : agentId);
      });
      setSessions(agentSessions);
      setLoading(false);
    });

    // Poll every 10s
    const interval = setInterval(() => {
      api.agentActivity(agentId).then(setData).catch(() => {});
    }, 10000);

    return () => clearInterval(interval);
  }, [agentId]);

  const activeSession = sessions[0];
  const sessionDuration = activeSession?.duration || 0;
  const isStuck = sessionDuration > 30 * 60 * 1000; // 30+ minutes

  return (
    <div className="agent-activity-panel">
      <div className="agent-activity-panel__header">
        <span className="agent-activity-panel__identity">
          <span className="agent-activity-panel__emoji">{agent?.emoji || '\u{1F916}'}</span>
          <span className="agent-activity-panel__name">{agent?.name || agentId}</span>
        </span>
        {isStuck && <span className="agent-activity-panel__stuck">STUCK?</span>}
        <button className="agent-activity-panel__close" onClick={onClose}>{"\u2715"}</button>
      </div>

      <div className="agent-activity-panel__meta">
        <span className="agent-activity-panel__role">{agent?.role || ''}</span>
        <span className="agent-activity-panel__model">{agent?.model || ''}</span>
      </div>

      {loading ? (
        <div className="agent-activity-panel__loading">Loading...</div>
      ) : (
        <>
          {/* Active session info */}
          {activeSession && (
            <div className="agent-activity-panel__session">
              <div className="agent-activity-panel__session-title">ACTIVE SESSION</div>
              <div className="agent-activity-panel__session-row">
                <span>Duration: {formatDuration(sessionDuration)}</span>
                <span>Model: {activeSession.model || agent?.model || '-'}</span>
              </div>
              {activeSession.contextUsage && (
                <div className="agent-activity-panel__session-row">
                  <span>Context: {activeSession.contextUsage}</span>
                </div>
              )}
            </div>
          )}

          {/* Recent runs */}
          <div className="agent-activity-panel__runs-title">
            RUNS ({data?.totalRuns || 0})
          </div>
          <div className="agent-activity-panel__runs">
            {(!data?.runs || data.runs.length === 0) ? (
              <div className="agent-activity-panel__empty">No runs found</div>
            ) : (
              data.runs.slice(0, 15).map((run) => (
                <div key={run.runId + run.step} className={`agent-activity-panel__run agent-activity-panel__run--${run.status}`}>
                  <div className="agent-activity-panel__run-header">
                    <span className={`agent-activity-panel__run-status agent-activity-panel__run-status--${run.status}`}>
                      {run.status.toUpperCase()}
                    </span>
                    <span className="agent-activity-panel__run-wf">{run.workflow}</span>
                    <span className="agent-activity-panel__run-step">{run.step}</span>
                  </div>
                  <div className="agent-activity-panel__run-task">{run.task}</div>
                  <div className="agent-activity-panel__run-time">{timeAgo(run.completedAt)}</div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
