import { useState } from 'react';
import type { Workflow, Run } from '../lib/types';

const STEP_LABELS: Record<string, string> = {
  plan: 'PLAN', setup: 'SETUP', implement: 'IMPL',
  verify: 'VERIFY', test: 'TEST', pr: 'PR', review: 'REVIEW',
  triage: 'TRIAGE', investigate: 'INVEST', fix: 'FIX',
  collect: 'COLLECT', report: 'REPORT',
  scan: 'SCAN', prioritize: 'PRIORITIZE',
};

interface Props {
  workflows: Workflow[];
  runs: Run[];
}

function timeSince(ts?: number): string {
  if (!ts) return '';
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 60) return sec + 's ago';
  const min = Math.floor(sec / 60);
  if (min < 60) return min + 'm ago';
  const hr = Math.floor(min / 60);
  return hr + 'h ' + (min % 60) + 'm ago';
}

function stepStatusClass(status: string): string {
  if (status === 'done') return 'af-step--done';
  if (status === 'running') return 'af-step--running';
  if (status === 'failed') return 'af-step--failed';
  return 'af-step--pending';
}

export function WorkflowKanban({ workflows, runs }: Props) {
  const [selectedStep, setSelectedStep] = useState<any>(null);

  return (
    <div className="af-pipeline">
      {workflows.map(wf => {
        const wfRuns = runs.filter(r => r.workflow === wf.id);
        const activeRun = wfRuns.find(r => r.status === 'running');
        const lastRun = wfRuns[0];
        const runSteps = activeRun?.steps || [];

        return (
          <div key={wf.id} className={`af-pipeline__run ${activeRun ? 'af-pipeline__run--running' : 'af-pipeline__run--idle'}`}>
            <div className="af-pipeline__header">
              {activeRun ? (
                <>
                  <span className="af-pipeline__status af-pipeline__status--running">
                    <span className="af-pulse" />RUNNING
                  </span>
                  <span className="af-pipeline__wf">{wf.name}</span>
                  <span className="af-pipeline__task">
                    {activeRun.task ? (activeRun.task.length > 50 ? activeRun.task.slice(0, 47) + '...' : activeRun.task) : ''}
                  </span>
                </>
              ) : (
                <>
                  <span className="af-pipeline__status af-pipeline__status--idle">IDLE</span>
                  <span className="af-pipeline__wf">{wf.name}</span>
                  {lastRun && (
                    <span className="af-pipeline__task" style={{ opacity: 0.5 }}>
                      Last: {lastRun.status} {lastRun.startedAt ? timeSince(lastRun.startedAt) : ''}
                    </span>
                  )}
                </>
              )}
            </div>

            <div className="af-pipeline__steps">
              {wf.steps.map((step: any, i: number) => {
                const runStep = runSteps.find((rs: any) => rs.id === step.id);
                const status = runStep?.status || 'waiting';
                const isClickable = runStep && (status === 'done' || status === 'failed');

                return (
                  <div key={step.id} className="af-step-wrapper">
                    {i > 0 && <span className="af-step-arrow">&rarr;</span>}
                    <div
                      className={`af-step ${stepStatusClass(status)} ${isClickable ? 'af-step--clickable' : ''}`}
                      title={`${step.id} (${step.agent})`}
                      onClick={() => isClickable && setSelectedStep(runStep)}
                    >
                      <div className="af-step__label">{STEP_LABELS[step.id] || step.id.toUpperCase()}</div>
                      <div className="af-step__agent">{step.agent}</div>
                      {status === 'running' && <div className="af-step__pulse" />}
                      {runStep?.retryCount > 0 && <div className="af-step__retry">R{runStep.retryCount}</div>}
                    </div>
                  </div>
                );
              })}
            </div>

            {activeRun && activeRun.storyCount > 0 && (
              <div className="af-pipeline__progress">
                <div className="af-pipeline__progress-bar">
                  <div className="af-pipeline__progress-fill" style={{ width: `${Math.round(((activeRun.storiesDone || 0) / activeRun.storyCount) * 100)}%` }} />
                </div>
                <span className="af-pipeline__progress-text">
                  {activeRun.storiesDone || 0}/{activeRun.storyCount} stories
                </span>
              </div>
            )}
          </div>
        );
      })}

      {selectedStep && (
        <div className="step-detail-backdrop" onClick={() => setSelectedStep(null)}>
          <div className="step-detail" onClick={e => e.stopPropagation()}>
            <div className="step-detail__header">
              <h4>{selectedStep.id?.toUpperCase()}</h4>
              <span className={`step-detail__status step-detail__status--${selectedStep.status}`}>{selectedStep.status}</span>
              <button className="step-detail__close" onClick={() => setSelectedStep(null)}>&#x2715;</button>
            </div>
            <div className="step-detail__agent">Agent: <strong>{selectedStep.agent}</strong></div>
            {selectedStep.output ? (
              <pre className="step-detail__output">{selectedStep.output}</pre>
            ) : (
              <div className="step-detail__empty">No output yet</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
