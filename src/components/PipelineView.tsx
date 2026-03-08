import { useState, useEffect } from 'react';
import { StoryChecklist } from './StoryChecklist';
import { api } from '../lib/api';

const STEP_ORDER = ['plan', 'design', 'stories', 'setup', 'implement', 'verify', 'security-gate', 'final-test', 'deploy'];
const STEP_LABELS: Record<string, string> = {
  plan: 'PLAN', design: 'DESIGN', stories: 'STORIES', setup: 'SETUP', implement: 'IMPL', deploy: 'DEPLOY',
  verify: 'VERIFY', 'security-gate': 'SEC GATE', 'final-test': 'FINAL TEST',
  test: 'TEST', pr: 'PR', review: 'REVIEW',
  triage: 'TRIAGE', investigate: 'INVEST', fix: 'FIX',
  collect: 'COLLECT', report: 'REPORT',
  'external-review': 'EXT-REV', merge: 'MERGE',
};

const WORKFLOW_STEPS: Record<string, string[]> = {
  'feature-dev': ['plan', 'design', 'stories', 'setup', 'implement', 'verify', 'security-gate', 'final-test', 'deploy'],
  'bug-fix': ['triage', 'investigate', 'fix', 'verify', 'test', 'pr', 'review'],
  'security-audit': ['collect', 'plan', 'fix', 'verify', 'test', 'report', 'review'],
  'daily-standup': ['collect', 'report'],
  'ui-refactor': ['plan', 'setup', 'implement', 'verify', 'test', 'deploy'],
};

interface PipelineRun {
  id: string;
  runNumber?: number;
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
  const [tab, setTab] = useState<'prd' | 'design' | 'stories' | 'raw' | 'memory'>('prd');
  const [planData, setPlanData] = useState<PlanData | null>(null);
  const [designData, setDesignData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.runPlan(runId),
      api.runDesign(runId).catch(() => null),
    ]).then(([plan, design]) => {
      setPlanData(plan);
      if (design) setDesignData(design);
      setLoading(false);
    }).catch(() => setLoading(false));
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
        {designData && designData.screens && designData.screens.length > 0 && (
          <button className={`af-inline-plan__tab ${tab === 'design' ? 'af-inline-plan__tab--active' : ''}`} onClick={() => setTab('design')}>DESIGN ({designData.screens.length})</button>
        )}
        <button className={`af-inline-plan__tab ${tab === 'stories' ? 'af-inline-plan__tab--active' : ''}`} onClick={() => setTab('stories')}>STORIES ({storyCount})</button>
        <button className={`af-inline-plan__tab ${tab === 'raw' ? 'af-inline-plan__tab--active' : ''}`} onClick={() => setTab('raw')}>RAW</button>
        <button className={`af-inline-plan__tab ${tab === 'memory' ? 'af-inline-plan__tab--active' : ''}`} onClick={() => setTab('memory')}>MEMORY</button>
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


        {tab === 'design' && designData && (
          <div className="af-inline-plan__design">
            {designData.designSystem && (
              <div className="af-design-system">
                <h4 className="af-design-system__title">Design System</h4>
                <div className="af-design-system__tokens">
                  {Object.entries(designData.designSystem).map(([key, value]: [string, any]) => (
                    <span key={key} className="af-design-token">
                      <span className="af-design-token__key">{key}</span>
                      <span className="af-design-token__val">{value}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
            {designData.designNotes && (
              <p className="af-design-notes">{designData.designNotes}</p>
            )}
            <div className="af-design-grid">
              {designData.screens.map((screen: any) => (
                <div key={screen.screenId} className="af-design-card">
                  <div className="af-design-card__header">
                    <span className="af-design-card__name">{screen.name || screen.title}</span>
                    <span className="af-design-card__type">{screen.type || screen.deviceType}</span>
                  </div>
                  {screen.description && <p className="af-design-card__desc">{screen.description}</p>}
                  {screen.screenshotUrl ? (
                    <div className="af-design-card__img-wrap">
                      <img
                        src={screen.screenshotUrl}
                        alt={screen.name || screen.title}
                        className="af-design-card__img"
                        loading="lazy"
                      />
                    </div>
                  ) : (
                    <div className="af-design-card__no-img">No screenshot available</div>
                  )}
                  <div className="af-design-card__actions">
                    {screen.htmlUrl && (
                      <a href={screen.htmlUrl} target="_blank" rel="noopener noreferrer" className="af-design-card__btn">
                        View HTML
                      </a>
                    )}
                    {screen.width && screen.height && (
                      <span className="af-design-card__size">{screen.width}x{screen.height}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'stories' && (
          <StoryChecklist runId={runId} onRetry={onRetry} />
        )}

        {tab === 'raw' && (
          <pre className="af-inline-plan__raw">{planData.rawOutput}</pre>
        )}

        {tab === 'memory' && (
          <pre className="af-inline-plan__raw">{(planData as any).projectMemory || '(no project memory yet)'}</pre>
        )}
      </div>
    </div>
  );
}

export function PipelineView({ runs }: { runs: PipelineRun[] }) {
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const HIDDEN_WORKFLOWS = ["daily-standup"];
  const filteredRuns = (runs || []).filter(r => !HIDDEN_WORKFLOWS.includes(r.workflow));
  if (filteredRuns.length === 0) {
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

  const handleStop = async (runId: string) => {
    if (!confirm('Bu workflow durdurulsun mu?')) return;
    setActionLoading(runId + ':stop');
    try { await api.stopRun(runId); } catch (err: any) { console.error('Stop failed:', err); }
    finally { setActionLoading(null); }
  };

  const handleDelete = async (runId: string) => {
    if (!confirm('Bu run silinsin mi?')) return;
    setActionLoading(runId + ':delete');
    try { await api.deleteRun(runId); } catch (err: any) { console.error('Delete failed:', err); }
    finally { setActionLoading(null); }
  };

  const handleResume = async (runId: string) => {
    setActionLoading(runId + ':resume');
    try { await api.resumeRun(runId); } catch (err: any) { console.error('Resume failed:', err); }
    finally { setActionLoading(null); }
  };

  return (
    <div className="af-pipeline">
      {filteredRuns.map((run) => {
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

        // For completed/failed runs, only show steps that actually ran; for running, show all
        const wfSteps = WORKFLOW_STEPS[run.workflow] || STEP_ORDER;
        const stepMap = new Map(uniqueSteps.map(s => [s.stepId, s]));
        const allSteps = wfSteps
          .filter(stepId => run.status === 'running' || stepMap.has(stepId))
          .map(stepId => stepMap.get(stepId) || {
            stepId, agent: ''  , status: 'pending', retryCount: 0, type: 'step', abandonedCount: 0
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
              {run.runNumber && <span className="af-pipeline__run-id">#{run.runNumber}</span>}
              <span className="af-pipeline__wf">{run.workflow}</span>
              <span className="af-pipeline__task">{truncate(run.task, 60)}</span>
              <span className="af-pipeline__run-actions" onClick={(e) => e.stopPropagation()}>
                {run.status === 'running' && (
                  <button className="af-run-btn af-run-btn--stop" onClick={() => handleStop(run.id)} disabled={actionLoading === run.id + ':stop'} title="Durdur">
                    {actionLoading === run.id + ':stop' ? '...' : '\u25A0'}
                  </button>
                )}
                {(run.status === 'failed' || run.status === 'cancelled') && (
                  <button className="af-run-btn af-run-btn--resume" onClick={() => handleResume(run.id)} disabled={actionLoading === run.id + ':resume'} title="Resume">
                    {actionLoading === run.id + ':resume' ? '...' : '\u25B6'}
                  </button>
                )}
                <button className="af-run-btn af-run-btn--delete" onClick={() => handleDelete(run.id)} disabled={actionLoading === run.id + ':delete'} title="Sil">
                  {actionLoading === run.id + ':delete' ? '...' : '\u2715'}
                </button>
              </span>
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

            {/* Progress bar — color-coded */}
            {run.storyProgress.total > 0 && (() => {
              const t = run.storyProgress.total;
              const sp = run.storyProgress as any;
              const verifiedPct = ((sp.verified || 0) / t) * 100;
              const donePct = ((sp.done || 0) / t) * 100;
              const skippedPct = ((sp.skipped || 0) / t) * 100;
              const runningPct = ((sp.running || 0) / t) * 100;
              return (
              <div className="af-pipeline__actions">
                <div className="af-pipeline__progress">
                  <div className="af-pipeline__progress-bar" style={{ display: 'flex', overflow: 'hidden' }}>
                    {verifiedPct > 0 && <div style={{ width: `${verifiedPct}%`, background: '#22c55e', height: '100%', transition: 'width .3s' }} title={`${sp.verified} verified`} />}
                    {donePct > 0 && <div style={{ width: `${donePct}%`, background: '#3b82f6', height: '100%', transition: 'width .3s' }} title={`${sp.done} done`} />}
                    {skippedPct > 0 && <div style={{ width: `${skippedPct}%`, background: '#6b7280', height: '100%', transition: 'width .3s' }} title={`${sp.skipped} skipped`} />}
                    {runningPct > 0 && <div style={{ width: `${runningPct}%`, background: '#f59e0b', height: '100%', transition: 'width .3s' }} title={`${sp.running} running`} />}
                  </div>
                  <span className="af-pipeline__progress-text">
                    {run.storyProgress.completed}/{run.storyProgress.total} stories ({progressPct}%)
                    <span style={{ marginLeft: 8, fontSize: 11, opacity: 0.7 }}>
                      {sp.verified > 0 && <span style={{ color: '#22c55e' }}>{sp.verified} verified </span>}
                      {sp.done > 0 && <span style={{ color: '#3b82f6' }}>{sp.done} done </span>}
                      {sp.running > 0 && <span style={{ color: '#f59e0b' }}>{sp.running} running </span>}
                      {sp.skipped > 0 && <span style={{ color: '#6b7280' }}>{sp.skipped} skipped</span>}
                    </span>
                  </span>
                </div>
              </div>
              );
            })()}

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
