import { useState } from 'react';
import { format } from 'date-fns';
import { api } from '../lib/api';
import type { Run } from '../lib/types';

interface Props {
  run: Run;
  onClick?: () => void;
  onDelete?: () => void;
}

function StatusBadge({ status }: { status: string }) {
  const cls = status === 'completed' ? 'badge--done'
    : status === 'running' ? 'badge--running'
    : status === 'failed' ? 'badge--failed'
    : 'badge--waiting';
  return <span className={`run-badge ${cls}`}>{status}</span>;
}

export function RunCard({ run, onClick, onDelete }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const statusClass = run.status === 'running' ? 'run-card--running'
    : run.status === 'completed' ? 'run-card--completed'
    : run.status === 'failed' ? 'run-card--failed'
    : '';

  const doneSteps = run.steps?.filter(s => s.status === 'done').length || 0;
  const totalSteps = run.steps?.length || 0;

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete run ${run.id.slice(0, 8)}? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await api.deleteRun(run.id);
      onDelete?.();
    } catch (err) {
      alert('Failed to delete: ' + (err as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className={`run-card ${statusClass} ${onClick ? 'run-card--clickable' : ''}`} onClick={onClick}>
      <div className="run-card__header" onClick={() => setExpanded(!expanded)} style={{ cursor: 'pointer' }}>
        <span className="run-card__id">#{run.id.slice(0, 8)}</span>
        <span className="run-card__workflow">{run.workflow}</span>
        {run.progress && <span className="run-card__progress">{run.progress}</span>}
        <StatusBadge status={run.status} />
        <span className="run-card__expand">{expanded ? '▲' : '▼'}</span>
      </div>

      {run.task && <div className="run-card__task">{run.task.split('\n')[0].slice(0, 120)}</div>}

      <div className="run-card__meta">
        {run.currentStep && <span>Step: <strong>{run.currentStep}</strong></span>}
        {run.storyCount && run.storyCount > 0 && <span>{run.storyCount} stories</span>}
        {run.startedAt && <span>{format(new Date(run.startedAt), 'MMM d HH:mm')}</span>}
      </div>

      {expanded && run.steps && run.steps.length > 0 && (
        <div className="run-card__steps">
          <div className="run-card__steps-header">Pipeline Steps</div>
          {run.steps.map((step, i) => (
            <div key={i} className={`run-card__step run-card__step--${step.status}`}>
              <span className="run-card__step-status">
                {step.status === 'done' ? '✓' : step.status === 'failed' ? '✗' : step.status === 'pending' ? '▶' : '○'}
              </span>
              <span className="run-card__step-name">{step.id}</span>
              <span className="run-card__step-agent">{step.agent?.split('/').pop()}</span>
              <span className={`run-card__step-badge run-card__step-badge--${step.status}`}>
                {step.status}
              </span>
            </div>
          ))}
          {totalSteps > 0 && (
            <div className="run-card__steps-summary">
              {doneSteps}/{totalSteps} completed
            </div>
          )}
        </div>
      )}

      {/* Delete button */}
      {run.status !== 'running' && (
        <button 
          className="run-card__delete" 
          onClick={handleDelete}
          disabled={deleting}
          title="Delete run"
        >
          {deleting ? '...' : '🗑️'}
        </button>
      )}
    </div>
  );
}
