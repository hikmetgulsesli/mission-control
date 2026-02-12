import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { api } from '../lib/api';

interface Props {
  agentId: string;
  agentName: string;
  onClose: () => void;
}

export function AgentActivityModal({ agentId, agentName, onClose }: Props) {
  const [activity, setActivity] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.agentActivity(agentId)
      .then(setActivity)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [agentId]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal--large" onClick={e => e.stopPropagation()}>
        <div className="modal__header">
          <h3>📊 {agentName} Activity</h3>
          <button className="modal__close" onClick={onClose}>×</button>
        </div>

        <div className="modal__body">
          {loading ? (
            <div className="loading">Loading activity...</div>
          ) : activity ? (
            <>
              <div className="activity-stats">
                <span className="stat-chip">
                  🏃 {activity.totalRuns || 0} runs participated
                </span>
              </div>

              <div className="activity-list">
                {(activity.runs || []).map((run: any, i: number) => (
                  <div key={i} className="activity-item">
                    <div className="activity-item__header">
                      <span className={`activity-badge activity-badge--${run.status}`}>
                        {run.status}
                      </span>
                      <span className="activity-workflow">{run.workflow}</span>
                      <span className="activity-step">{run.step}</span>
                      {run.completedAt && (
                        <span className="activity-date">
                          {format(new Date(run.completedAt), 'MMM d HH:mm')}
                        </span>
                      )}
                    </div>

                    <div className="activity-item__task" title={run.task}>
                      {run.task}
                    </div>

                    {run.output && (
                      <div className="activity-item__output">
                        <details>
                          <summary>📝 Output Preview</summary>
                          <pre>{run.output}</pre>
                        </details>
                      </div>
                    )}

                    {run.sessions && run.sessions.length > 0 && (
                      <div className="activity-item__sessions">
                        💬 {run.sessions.length} session(s)
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {(activity.runs || []).length === 0 && (
                <div className="empty-state">
                  No activity found for this agent.
                </div>
              )}
            </>
          ) : (
            <div className="error">Failed to load activity</div>
          )}
        </div>
      </div>
    </div>
  );
}
