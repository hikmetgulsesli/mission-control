import React, { useState } from 'react';
import { format } from 'date-fns';
import { api } from '../lib/api';
import { useToast } from './Toast';
import type { Run } from '../lib/types';
import { ConfirmDialog } from './ConfirmDialog';

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

export const RunCard = React.memo(function RunCard({ run, onClick, onDelete }: Props) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const statusClass = run.status === 'running' ? 'run-card--running'
    : run.status === 'completed' ? 'run-card--completed'
    : run.status === 'failed' ? 'run-card--failed'
    : '';

  const doneSteps = run.steps?.filter(s => s.status === 'done').length || 0;
  const totalSteps = run.steps?.length || 0;

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirmed = async () => {
    setShowDeleteConfirm(false);
    setDeleting(true);
    try {
      await api.deleteRun(run.id);
      onDelete?.();
    } catch (err) {
      toast('Failed to delete: ' + (err as Error).message, 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className={`run-card ${statusClass} ${onClick ? 'run-card--clickable' : ''}`} onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined} onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}>
      <div className="run-card__header" role="button" tabIndex={0} onClick={() => setExpanded(!expanded)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(!expanded); } }} style={{ cursor: 'pointer' }}>
        <span className="run-card__id">#{run.id.slice(0, 8)}</span>
        <span className="run-card__workflow">{run.workflow}</span>
        {run.progress && <span className="run-card__progress">{run.progress}</span>}
        <StatusBadge status={run.status} />
        <span className="run-card__expand">{expanded ? '▲' : '▼'}</span>
      </div>

      {run.task && <div className="run-card__task">{run.task.split('\n')[0].slice(0, 120)}</div>}

      <div className="run-card__meta">
        {run.currentStep && <span>Step: <strong>{run.currentStep}</strong></span>}
        {run.storiesDone !== undefined && run.storyCount ? (
          <span className="run-card__story-progress">
            <span className="run-card__story-bar">
              <span className="run-card__story-fill" style={{ width: `${(run.storiesDone / run.storyCount) * 100}%` }} />
            </span>
            {run.storiesDone}/{run.storyCount} stories
          </span>
        ) : run.storyCount && run.storyCount > 0 ? <span>{run.storyCount} stories</span> : null}
        {run.currentStoryId && (
          <span className="run-card__current-story">{run.currentStoryId}</span>
        )}
        {run.startedAt && <span>{format(new Date(run.startedAt), 'MMM d HH:mm')}</span>}
      </div>

      {expanded && run.steps && run.steps.length > 0 && (
        <div className="run-card__steps">
          <div className="run-card__steps-header">Pipeline Steps</div>
          {run.steps.map((step, i) => (
            <div key={step.id || i} className={`run-card__step run-card__step--${step.status}`}>
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
          onClick={handleDeleteClick}
          disabled={deleting}
          title="Delete run"
        >
          {deleting ? '...' : '🗑️'}
        </button>
      )}
    <ConfirmDialog
        open={showDeleteConfirm}
        title="Run Sil"
        message={`Run ${run.id.slice(0, 8)} silinecek. Bu islem geri alinamaz.`}
        confirmLabel="Sil"
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
});
