import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { StoryChecklist } from './StoryChecklist';
import { api } from '../lib/api';

const STEP_ORDER = ['plan', 'design', 'stories', 'setup-repo', 'setup-build', 'implement', 'verify', 'security-gate', 'qa-test', 'final-test', 'deploy'];
const STEP_LABELS: Record<string, string> = {
  plan: 'PLAN', design: 'DESIGN', stories: 'STORIES', 'setup-repo': 'SETUP', 'setup-build': 'BUILD', implement: 'IMPL', deploy: 'DEPLOY',
  verify: 'VERIFY', 'security-gate': 'SEC GATE', 'qa-test': 'QA TEST', 'final-test': 'FINAL TEST',
  test: 'TEST', pr: 'PR', review: 'REVIEW',
  triage: 'TRIAGE', investigate: 'INVEST', fix: 'FIX',
  collect: 'COLLECT', report: 'REPORT',
  'external-review': 'EXT-REV', merge: 'MERGE',
};

const WORKFLOW_STEPS: Record<string, string[]> = {
  'feature-dev': ['plan', 'design', 'stories', 'setup-repo', 'setup-build', 'implement', 'verify', 'security-gate', 'qa-test', 'final-test', 'deploy'],
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

  const fetchData = useCallback(() => {
    Promise.all([
      api.runPlan(runId),
      api.runDesign(runId).catch(() => null),
    ]).then(([plan, design]) => {
      setPlanData(plan);
      if (design) setDesignData(design);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [runId]);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 10_000);
    return () => clearInterval(id);
  }, [fetchData]);

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

export function PipelineView({ runs, onRefresh }: { runs: PipelineRun[]; onRefresh?: () => void }) {
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [hiddenRuns, setHiddenRuns] = useState<Set<string>>(new Set());
  const [deleteModal, setDeleteModal] = useState<{ runId: string; runNumber: number; task: string } | null>(null);
  const [deleteInput, setDeleteInput] = useState('');
  const [deleteCleanup, setDeleteCleanup] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const HIDDEN_WORKFLOWS = ["daily-standup"];
  const filteredRuns = (runs || [])
    .filter(r => !HIDDEN_WORKFLOWS.includes(r.workflow) && !hiddenRuns.has(r.id))
    .filter(r => statusFilter === 'all' || r.status === statusFilter)
    .sort((a, b) => (b.runNumber || 0) - (a.runNumber || 0));
  const filterBar = (
    <div className="af-pipeline__filters">
      {['all', 'running', 'completed', 'failed', 'cancelled'].map(s => (
        <button
          key={s}
          className={`af-pipeline__filter-btn ${statusFilter === s ? 'af-pipeline__filter-btn--active' : ''}`}
          onClick={() => setStatusFilter(s)}
        >
          {s.toUpperCase()}
          {s !== 'all' && <span className="af-pipeline__filter-count">
            {(runs || []).filter(r => !HIDDEN_WORKFLOWS.includes(r.workflow) && r.status === s).length}
          </span>}
        </button>
      ))}
    </div>
  );

  if (filteredRuns.length === 0) {
    return <div className="af-pipeline">{filterBar}<div className="af-empty">No runs found</div></div>;
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
    try { await api.stopRun(runId); if (onRefresh) onRefresh(); } catch (err: any) { console.error('Stop failed:', err); }
    finally { setActionLoading(null); }
  };

  const openDeleteModal = (run: PipelineRun) => {
    setDeleteModal({ runId: run.id, runNumber: run.runNumber || 0, task: run.task });
    setDeleteInput('');
    setDeleteCleanup(false);
    setDeleteSteps([]);
    setDeleteResult(null);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteModal) return;
    setActionLoading(deleteModal.runId + ':delete');
    setDeleteResult(null);

    // Build checklist
    const steps: { id: string; label: string; status: 'waiting' | 'done' | 'fail' | 'skip'; detail?: string }[] = [
      { id: 'db', label: 'DB kayitlari', status: 'waiting', detail: 'runs, steps, stories' },
    ];
    if (deleteCleanup) {
      steps.push(
        { id: 'github', label: 'GitHub repo', status: 'waiting' },
        { id: 'files', label: 'Yerel dosyalar', status: 'waiting' },
        { id: 'service', label: 'Systemd servisi', status: 'waiting' },
        { id: 'json', label: 'projects.json', status: 'waiting' },
        { id: 'tunnel', label: 'Cloudflare tunnel', status: 'waiting' },
      );
    }
    setDeleteSteps(steps);

    try {
      const result = await api.deleteRun(deleteModal.runId, deleteCleanup);
      const log = ((result as any).log || []).join('\n');

      const updates = steps.map(s => {
        if (s.id === 'db') return { ...s, status: 'done' as const };
        if (s.id === 'github') {
          if (log.includes('GitHub repo deleted')) return { ...s, status: 'done' as const };
          if (log.includes('GitHub delete failed')) return { ...s, status: 'fail' as const };
          return { ...s, status: 'skip' as const, detail: 'repo bulunamadi' };
        }
        if (s.id === 'files') {
          if (log.includes('Local repo deleted') || (log.includes('Repo') && log.includes('deleted'))) return { ...s, status: 'done' as const };
          if (log.includes('delete failed') || log.includes('deletion failed')) return { ...s, status: 'fail' as const };
          return { ...s, status: 'skip' as const, detail: 'dosya bulunamadi' };
        }
        if (s.id === 'service') {
          if (log.includes('Service stopped')) return { ...s, status: 'done' as const };
          return { ...s, status: 'skip' as const, detail: 'servis yok' };
        }
        if (s.id === 'json') {
          if (log.includes('Removed from projects.json')) return { ...s, status: 'done' as const };
          return { ...s, status: 'skip' as const };
        }
        if (s.id === 'tunnel') {
          if (log.includes('Tunnel:') || log.includes('Tunnel entry')) return { ...s, status: 'done' as const };
          if (log.includes('Tunnel cleanup failed')) return { ...s, status: 'fail' as const };
          return { ...s, status: 'skip' as const, detail: 'tunnel yok' };
        }
        return s;
      });

      // Stagger reveal
      for (let i = 0; i < updates.length; i++) {
        await new Promise(r => setTimeout(r, 200));
        setDeleteSteps(prev => prev.map((s, j) => j <= i ? updates[j] : s));
      }

      setDeleteResult({ success: true });
      setHiddenRuns(prev => new Set([...prev, deleteModal.runId]));
      if (onRefresh) onRefresh();
    } catch (err: any) {
      console.error('Delete failed:', err);
      setDeleteResult({ error: err.message });
      setDeleteSteps(prev => prev.map(s => s.status === 'waiting' ? { ...s, status: 'fail' as const } : s));
    }
    finally { setActionLoading(null); }
  };

  const handleResume = async (runId: string) => {
    setActionLoading(runId + ':resume');
    try { await api.resumeRun(runId); if (onRefresh) onRefresh(); } catch (err: any) { console.error('Resume failed:', err); }
    finally { setActionLoading(null); }
  };

  return (
    <div className="af-pipeline">
      {filterBar}
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
                {run.status === 'running' ? (
                  <button className="af-run-btn af-run-btn--stop" onClick={() => handleStop(run.id)} disabled={actionLoading === run.id + ':stop'} title="Durdur">
                    {actionLoading === run.id + ':stop' ? '...' : '\u23F8'}
                  </button>
                ) : (run.status === 'failed' || run.status === 'cancelled') ? (
                  <button className="af-run-btn af-run-btn--resume" onClick={() => handleResume(run.id)} disabled={actionLoading === run.id + ':resume'} title="Devam Et">
                    {actionLoading === run.id + ':resume' ? '...' : '\u25B6'}
                  </button>
                ) : null}
                <button className="af-run-btn af-run-btn--delete" onClick={() => openDeleteModal(run)} disabled={actionLoading === run.id + ':delete'} title="Sil">
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
      {deleteModal && createPortal(
        <div className="modal-backdrop" onClick={() => !actionLoading && setDeleteModal(null)}>
          <div className="modal modal--delete" onClick={e => e.stopPropagation()}>
            <h3 style={{ color: '#f85149', margin: '0 0 12px' }}>Run #{deleteModal.runNumber} Sil</h3>
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', margin: '0 0 8px' }}>
              {deleteModal.task.length > 120 ? deleteModal.task.slice(0, 120) + '...' : deleteModal.task}
            </p>

            {/* Checklist */}
            {deleteSteps.length > 0 && (
              <div style={{ margin: '8px 0 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {deleteSteps.map((step) => (
                  <div key={step.id} style={{
                    display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 8px',
                    background: step.status === 'done' ? 'rgba(63, 185, 80, 0.08)' : step.status === 'fail' ? 'rgba(248, 81, 73, 0.08)' : 'rgba(255,255,255,0.03)',
                    borderRadius: '5px', fontSize: '12px', transition: 'all 0.3s ease',
                    borderLeft: `3px solid ${step.status === 'done' ? '#3fb950' : step.status === 'fail' ? '#f85149' : step.status === 'skip' ? '#484f58' : '#30363d'}`
                  }}>
                    <span style={{ fontSize: '14px', width: '18px', textAlign: 'center', flexShrink: 0 }}>
                      {step.status === 'done' ? '✅' : step.status === 'fail' ? '❌' : step.status === 'skip' ? '➖' : '⬜'}
                    </span>
                    <span style={{ color: step.status === 'skip' ? '#484f58' : '#e6edf3', fontWeight: 500 }}>{step.label}</span>
                    {step.detail && <span style={{ color: '#484f58', fontSize: '10px', marginLeft: 'auto', fontFamily: 'monospace' }}>{step.detail}</span>}
                  </div>
                ))}
              </div>
            )}

            {!deleteResult && (
              <>
                <p style={{ fontSize: '12px', margin: '0 0 8px' }}>
                  Silmek icin run numarasini yazin: <strong style={{ color: '#f85149' }}>#{deleteModal.runNumber}</strong>
                </p>
                <input
                  type="text"
                  className="modal__input"
                  placeholder={'#' + deleteModal.runNumber}
                  value={deleteInput}
                  onChange={e => setDeleteInput(e.target.value)}
                  autoFocus
                />
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '10px 0', fontSize: '12px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={deleteCleanup} onChange={e => setDeleteCleanup(e.target.checked)} />
                  <span>Projeyi de sil (servis, dosyalar, GitHub, tunnel)</span>
                </label>
              </>
            )}
            {deleteResult?.error && (
              <div style={{ padding: '8px', background: 'rgba(248, 81, 73, 0.1)', borderRadius: '6px', fontSize: '12px', color: '#f85149', margin: '8px 0' }}>
                Hata: {deleteResult.error}
              </div>
            )}
            <div className="modal__actions">
              {deleteResult?.success ? (
                <button className="btn" onClick={() => setDeleteModal(null)}>Kapat</button>
              ) : (
                <>
                  <button className="btn" onClick={() => setDeleteModal(null)}>Vazgec</button>
                  <button
                    className="btn btn--danger"
                    disabled={deleteInput !== '#' + deleteModal.runNumber || actionLoading === deleteModal.runId + ':delete'}
                    onClick={handleDeleteConfirm}
                  >
                    {actionLoading === deleteModal.runId + ':delete' ? 'Siliniyor...' : 'Kalici Sil'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  );
}
