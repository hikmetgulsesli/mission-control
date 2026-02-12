import { useState, useEffect } from 'react';
import { format } from 'date-fns';

interface Props {
  agentId: string;
  agentName: string;
  onClose: () => void;
}

interface ProgressData {
  currentStep: string;
  currentFile: string;
  progress: number;
  lastAction: string;
  lastUpdate: string;
}

export function LiveProgressPanel({ agentId, agentName, onClose }: Props) {
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);

  // Simulate live progress (in real implementation, this would use WebSocket)
  useEffect(() => {
    // For now, show the current runs for this agent
    const fetchProgress = async () => {
      try {
        const response = await fetch(`/api/agents/${agentId}/activity`);
        const data = await response.json();

        if (data.runs && data.runs.length > 0) {
          const latestRun = data.runs[0];
          setProgress({
            currentStep: latestRun.step || 'unknown',
            currentFile: latestRun.output?.substring(0, 100) || 'N/A',
            progress: latestRun.status === 'done' ? 100 : latestRun.status === 'running' ? 50 : 0,
            lastAction: latestRun.task || 'Working...',
            lastUpdate: latestRun.completedAt || new Date().toISOString(),
          });
        }
      } catch (err) {
        console.error('Failed to fetch progress:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProgress();
    const interval = setInterval(fetchProgress, 5000); // Refresh every 5s
    return () => clearInterval(interval);
  }, [agentId]);

  return (
    <div className="live-progress-panel">
      <div className="live-progress-panel__header">
        <h3>📡 {agentName} - Live Progress</h3>
        <button className="live-progress-panel__close" onClick={onClose}>×</button>
      </div>

      <div className="live-progress-panel__content">
        {loading ? (
          <div className="live-progress-panel__loading">
            <span className="pulse" /> Connecting to agent...
          </div>
        ) : progress ? (
          <>
            <div className="live-progress-panel__step">
              <span className="label">Current Step</span>
              <span className="value">{progress.currentStep}</span>
            </div>

            <div className="live-progress-panel__progress">
              <div className="progress-bar">
                <div
                  className="progress-bar__fill"
                  style={{ width: `${progress.progress}%` }}
                />
              </div>
              <span className="progress-text">{progress.progress}%</span>
            </div>

            <div className="live-progress-panel__file">
              <span className="label">Current Activity</span>
              <span className="value" title={progress.lastAction}>
                {progress.lastAction.substring(0, 80)}...
              </span>
            </div>

            <div className="live-progress-panel__updated">
              Last update: {format(new Date(progress.lastUpdate), 'HH:mm:ss')}
            </div>

            <div className="live-progress-panel__status">
              <span className={`status-indicator ${progress.progress === 100 ? 'status-indicator--done' : 'status-indicator--active'}`} />
              {progress.progress === 100 ? '✅ Completed' : '🔄 Active'}
            </div>
          </>
        ) : (
          <div className="live-progress-panel__empty">
            No active progress found for this agent.
          </div>
        )}
      </div>
    </div>
  );
}
