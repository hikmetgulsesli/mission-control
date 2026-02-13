const STEP_ORDER = ['plan', 'setup', 'implement', 'verify', 'test', 'pr', 'review'];
const STEP_LABELS: Record<string, string> = {
  plan: 'PLAN', setup: 'SETUP', implement: 'IMPL',
  verify: 'VERIFY', test: 'TEST', pr: 'PR', review: 'REVIEW',
  triage: 'TRIAGE', investigate: 'INVEST', fix: 'FIX',
  collect: 'COLLECT', report: 'REPORT',
};

interface PipelineRun {
  id: string;
  workflow: string;
  task: string;
  status: string;
  updatedAt: string;
  steps: { stepId: string; agent: string; status: string; retryCount: number; type: string; currentStoryId?: string; abandonedCount: number }[];
  storyProgress: { completed: number; total: number };
}

function statusClass(s: string): string {
  if (s === 'done') return 'af-step--done';
  if (s === 'running') return 'af-step--running';
  if (s === 'failed') return 'af-step--failed';
  return 'af-step--pending';
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '...' : s;
}

export function PipelineView({ runs }: { runs: PipelineRun[] }) {
  if (!runs || runs.length === 0) {
    return <div className="af-empty">No runs found</div>;
  }

  return (
    <div className="af-pipeline">
      {runs.map((run) => {
        const steps = run.steps.sort((a, b) => {
          const ai = STEP_ORDER.indexOf(a.stepId);
          const bi = STEP_ORDER.indexOf(b.stepId);
          return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
        });
        // Deduplicate steps by stepId (keep last)
        const seen = new Set<string>();
        const uniqueSteps = [...steps].reverse().filter(s => {
          if (seen.has(s.stepId)) return false;
          seen.add(s.stepId);
          return true;
        }).reverse();

        const progressPct = run.storyProgress.total > 0
          ? Math.round((run.storyProgress.completed / run.storyProgress.total) * 100)
          : 0;

        return (
          <div key={run.id} className={`af-pipeline__run af-pipeline__run--${run.status}`}>
            <div className="af-pipeline__header">
              <span className={`af-pipeline__status af-pipeline__status--${run.status}`}>
                {run.status === 'running' && <span className="af-pulse" />}
                {run.status.toUpperCase()}
              </span>
              <span className="af-pipeline__wf">{run.workflow}</span>
              <span className="af-pipeline__task">{truncate(run.task, 60)}</span>
            </div>

            <div className="af-pipeline__steps">
              {uniqueSteps.map((step, i) => (
                <div key={`${step.stepId}-${i}`} className="af-step-wrapper">
                  {i > 0 && <span className="af-step-arrow">&rarr;</span>}
                  <div className={`af-step ${statusClass(step.status)}`} title={`${step.stepId} (${step.agent?.split('/').pop() || '?'})`}>
                    <div className="af-step__label">{STEP_LABELS[step.stepId] || step.stepId.toUpperCase()}</div>
                    <div className="af-step__agent">{step.agent?.split('/').pop() || '?'}</div>
                    {step.status === 'running' && <div className="af-step__pulse" />}
                    {step.retryCount > 0 && <div className="af-step__retry">R{step.retryCount}</div>}
                  </div>
                </div>
              ))}
            </div>

            {run.storyProgress.total > 0 && (
              <div className="af-pipeline__progress">
                <div className="af-pipeline__progress-bar">
                  <div className="af-pipeline__progress-fill" style={{ width: `${progressPct}%` }} />
                </div>
                <span className="af-pipeline__progress-text">
                  {run.storyProgress.completed}/{run.storyProgress.total} stories ({progressPct}%)
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
