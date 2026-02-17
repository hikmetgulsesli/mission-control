import { useState, useEffect } from 'react';
import { StoryChecklist } from './StoryChecklist';
import { api } from '../lib/api';

const STEP_ORDER = ['plan', 'setup', 'implement', 'verify', 'test', 'pr', 'review', 'external-review', 'merge'];
const STEP_LABELS: Record<string, string> = {
  plan: 'PLAN', setup: 'SETUP', implement: 'IMPL',
  verify: 'VERIFY', test: 'TEST', pr: 'PR', review: 'REVIEW',
  triage: 'TRIAGE', investigate: 'INVEST', fix: 'FIX',
  collect: 'COLLECT', report: 'REPORT',
  'external-review': 'EXT-REV', merge: 'MERGE',
};

const WORKFLOW_STEPS: Record<string, string[]> = {
  'feature-dev': ['plan', 'setup', 'implement', 'verify', 'test', 'pr', 'review', 'external-review', 'merge'],
  'bug-fix': ['triage', 'investigate', 'fix', 'verify', 'test', 'pr', 'review'],
  'security-audit': ['collect', 'plan', 'fix', 'verify', 'test', 'report', 'review'],
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

interface PlanData {
  prd: string;
  stories: any[];
  rawOutput: string;
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

function InlinePlanView({ runId, onRetry }: { runId: string; onRetry?: (storyId: string) => void }) {
  const [tab, setTab] = useState<'prd' | 'stories' | 'raw'>('prd');
  const [planData, setPlanData] = useState<PlanData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.runPlan(runId)
      .then((d) => { setPlanData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [runId]);

  if (loading) return <div className="af-inline-plan__loading">Loading plan data...</div>;
  if (!planData || (!planData.prd && planData.stories.length === 0)) {
    return <StoryChecklist runId={runId} onRetry={onRetry} />;
  }

  const storyCount = planData.stories.length;

  return (
    <div className="af-inline-plan">
      <div className="af-inline-plan__tabs">
        <button className={`af-inline-plan__tab ${tab === 'prd' ? 'af-inline-plan__tab--active' : ''}`} onClick={() => setTab('prd')}>PRD</button>
        <button className={`af-inline-plan__tab ${tab === 'stories' ? 'af-inline-plan__tab--active' : ''}`} onClick={() => setTab('stories')}>STORIES ({storyCount})</button>
        <button className={`af-inline-plan__tab ${tab === 'raw' ? 'af-inline-plan__tab--active' : ''}`} onClick={() => setTab('raw')}>RAW</button>
      </div>

      <div className="af-inline-plan__content">
        {tab === 'prd' && (
          <div className="af-inline-plan__prd">
            {planData.prd.split('\n').map((line, i) => {
              if (line.match(/^#{1,3}\s/)) {
                return <h4 key={i} className="af-inline-plan__heading">{line.replace(/^#+\s*/, '')}</h4>;
              }
              if (line.match(/^[A-Z_]+:/)) {
                const [key, ...val] = line.split(':');
                return (
                  <div key={i} className="af-inline-plan__field">
                    <span className="af-inline-plan__key">{key}:</span>
                    <span className="af-inline-plan__val">{val.join(':').trim()}</span>
                  </div>
                );
              }
              if (line.trim() === '') return <br key={i} />;
              return <p key={i} className="af-inline-plan__text">{line}</p>;
            })}
          </div>
        )}

        {tab === 'stories' && (
          <StoryChecklist runId={runId} onRetry={onRetry} />
        )}

        {tab === 'raw' && (
          <pre className="af-inline-plan__raw">{planData.rawOutput}</pre>
        )}
      </div>
    </div>
  );
}

export function PipelineView({ runs }: { runs: PipelineRun[] }) {
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);

  if (!runs || runs.length === 0) {
    return <div className="af-empty">No runs found</div>;
  }

  const handleRetry = async (runId: string, stepId: string) => {
    setRetrying(stepId);
    try {
      await api.retryRun(runId, stepId);
    } catch (err: any) {
      console.error('Retry failed:', err);
    } finally {
      setRetrying(null);
    }
  };

  const handleStoryRetry = async (runId: string, storyId: string) => {
    try {
      await api.retryRun(runId, undefined, `Retry story ${storyId}`);
    } catch (err: any) {
      console.error('Story retry failed:', err);
    }
  };

  return (
    <div className="af-pipeline">
      {runs.map((run) => {
        const steps = run.steps.sort((a, b) => {
          const ai = STEP_ORDER.indexOf(a.stepId);
          const bi = STEP_ORDER.indexOf(b.stepId);
          return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
        });
        const seen = new Set<string>();
        const uniqueSteps = [...steps].reverse().filter(s => {
          if (seen.has(s.stepId)) return false;
          seen.add(s.stepId);
          return true;
        }).reverse();

        // Always show all workflow steps, even if not yet in data
        const wfSteps = WORKFLOW_STEPS[run.workflow] || STEP_ORDER;
        const stepMap = new Map(uniqueSteps.map(s => [s.stepId, s]));
        const allSteps = wfSteps.map(stepId => stepMap.get(stepId) || {
          stepId, agent: '', status: 'pending', retryCount: 0, type: 'step', abandonedCount: 0
        });

        const progressPct = run.storyProgress.total > 0
          ? Math.round((run.storyProgress.completed / run.storyProgress.total) * 100)
          : 0;

        const isExpanded = expandedRun === run.id;

        return (
          <div key={run.id} className={`af-pipeline__run af-pipeline__run--${run.status}`}>
            <div className="af-pipeline__header" onClick={() => setExpandedRun(isExpanded ? null : run.id)} style={{ cursor: 'pointer' }}>
              <span className={`af-pipeline__status af-pipeline__status--${run.status}`}>
                {run.status === 'running' && <span className="af-pulse" />}
                {run.status.toUpperCase()}
              </span>
              <span className="af-pipeline__wf">{run.workflow}</span>
              <span className="af-pipeline__task">{truncate(run.task, 60)}</span>
              <span className="af-pipeline__expand">{isExpanded ? '\u25B2' : '\u25BC'}</span>
            </div>

            <div className="af-pipeline__steps">
              {allSteps.map((step, i) => (
                <div key={`${step.stepId}-${i}`} className="af-step-wrapper">
                  {i > 0 && <span className="af-step-arrow">&rarr;</span>}
                  <div className={`af-step ${statusClass(step.status)}`} title={`${step.stepId} (${step.agent?.split('/').pop() || '?'})`}>
                    <div className="af-step__label">{STEP_LABELS[step.stepId] || step.stepId.toUpperCase()}</div>
                    {step.agent && <div className="af-step__agent">{step.agent.split('/').pop()}</div>}
                    {step.status === 'running' && <div className="af-step__pulse" />}
                    {step.retryCount > 0 && <div className="af-step__retry">R{step.retryCount}</div>}
                    {step.status === 'failed' && (
                      <button
                        className="af-step__retry-btn"
                        onClick={(e) => { e.stopPropagation(); handleRetry(run.id, step.stepId); }}
                        disabled={retrying === step.stepId}
                      >
                        {retrying === step.stepId ? '...' : 'RETRY'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Progress bar */}
            {run.storyProgress.total > 0 && (
              <div className="af-pipeline__actions">
                <div className="af-pipeline__progress">
                  <div className="af-pipeline__progress-bar">
                    <div className="af-pipeline__progress-fill" style={{ width: `${progressPct}%` }} />
                  </div>
                  <span className="af-pipeline__progress-text">
                    {run.storyProgress.completed}/{run.storyProgress.total} stories ({progressPct}%)
                  </span>
                </div>
              </div>
            )}

            {/* Expanded: inline plan view with PRD/STORIES/RAW tabs */}
            {isExpanded && (
              <div className="af-pipeline__expanded">
                <InlinePlanView runId={run.id} onRetry={(storyId) => handleStoryRetry(run.id, storyId)} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
