import { useState } from 'react';
import type { Workflow, Run } from '../lib/types';

interface Props {
  workflows: Workflow[];
  runs: Run[];
  onRunClick?: (runId: string) => void;
}

function StepStatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'done': return <span className="step-icon step-icon--done">✓</span>;
    case 'running':
    case 'pending': return <span className="step-icon step-icon--active">▶</span>;
    case 'failed': return <span className="step-icon step-icon--failed">✗</span>;
    case 'waiting': return <span className="step-icon step-icon--waiting">○</span>;
    default: return <span className="step-icon step-icon--waiting">○</span>;
  }
}

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="progress-bar">
      <div className="progress-bar__fill" style={{ width: `${pct}%` }} />
      <span className="progress-bar__label">{done}/{total} steps · {pct}%</span>
    </div>
  );
}

function timeSince(ts?: number): string {
  if (!ts) return '';
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  return `${hr}h ${min % 60}m ago`;
}

function StepDetail({ step, onClose }: { step: any; onClose: () => void }) {
  return (
    <div className="step-detail-backdrop" onClick={onClose}>
      <div className="step-detail" onClick={e => e.stopPropagation()}>
        <div className="step-detail__header">
          <h4>{step.id.toUpperCase()}</h4>
          <span className={`step-detail__status step-detail__status--${step.status}`}>{step.status}</span>
          <button className="step-detail__close" onClick={onClose}>✕</button>
        </div>
        <div className="step-detail__agent">Agent: <strong>{step.agent}</strong></div>
        {step.output ? (
          <pre className="step-detail__output">{step.output}</pre>
        ) : (
          <div className="step-detail__empty">No output yet</div>
        )}
      </div>
    </div>
  );
}

export function WorkflowKanban({ workflows, runs, onRunClick }: Props) {
  const [selectedStep, setSelectedStep] = useState<any>(null);

  return (
    <div className="kanban">
      {workflows.map(wf => {
        const wfRuns = runs.filter(r => r.workflow === wf.id);
        const activeRun = wfRuns.find(r => r.status === 'running');
        const runSteps = activeRun?.steps || [];
        const doneCount = runSteps.filter(s => s.status === 'done').length;
        const totalCount = runSteps.length || wf.steps.length;

        return (
          <div key={wf.id} className={`kanban__workflow ${activeRun ? 'kanban__workflow--active' : ''}`}>
            <div className="kanban__header">
              <h3 className="kanban__title">{wf.name}</h3>
              {activeRun && (
                <span className="kanban__run-badge">
                  <span className="pulse-dot" /> RUNNING
                </span>
              )}
            </div>

            {activeRun && <ProgressBar done={doneCount} total={totalCount} />}

            <div className="kanban__steps">
              {wf.steps.map(step => {
                const runStep = runSteps.find(rs => rs.id === step.id);
                const status = runStep?.status || 'waiting';
                const isClickable = runStep && (runStep.status === 'done' || runStep.status === 'failed');

                return (
                  <div
                    key={step.id}
                    className={`kanban__step kanban__step--${status} ${isClickable ? 'kanban__step--clickable' : ''}`}
                    onClick={() => isClickable && setSelectedStep(runStep)}
                    title={isClickable ? 'Click to view output' : status}
                  >
                    <StepStatusIcon status={status} />
                    <div className="kanban__step-info">
                      <div className="kanban__step-name">{step.id}</div>
                      <div className="kanban__step-agent">{step.agent}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {activeRun && (
              <div className="kanban__run-meta">
                <span className="kanban__run-id">Run #{activeRun.id.slice(0, 8)}</span>
                {activeRun.currentStep && (
                  <span className="kanban__current-step">
                    → <strong>{activeRun.currentStep}</strong>
                  </span>
                )}
                {activeRun.storyCount && activeRun.storyCount > 0 && (
                  <span className="kanban__stories">{activeRun.storyCount} stories</span>
                )}
                {activeRun.startedAt && (
                  <span className="kanban__elapsed">Started {timeSince(activeRun.startedAt)}</span>
                )}
              </div>
            )}

            {activeRun?.task && (
              <div
                className="kanban__task-preview kanban__task-preview--clickable"
                onClick={() => onRunClick?.(activeRun.id)}
                title="Click to view details"
              >
                {activeRun.task.split('\n')[0].slice(0, 100)}
                <span className="kanban__detail-link">View Details →</span>
              </div>
            )}

            {!activeRun && wfRuns.length > 0 && (
              <div className="kanban__last-run">
                Last: #{wfRuns[0].id.slice(0, 6)} — {wfRuns[0].status}
                {wfRuns[0].startedAt && ` · ${timeSince(wfRuns[0].startedAt)}`}
              </div>
            )}
          </div>
        );
      })}

      {selectedStep && (
        <StepDetail step={selectedStep} onClose={() => setSelectedStep(null)} />
      )}
    </div>
  );
}
