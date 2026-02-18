import { useState } from 'react';
import { usePolling } from '../hooks/usePolling';
import { useToast } from '../components/Toast';
import { api } from '../lib/api';
import { CronTable } from '../components/CronTable';
import { SystemMetricsPanel } from '../components/SystemMetrics';
import { GlitchText } from '../components/GlitchText';
import type { CronJob, SystemMetrics, DockerContainer, StuckRun, Diagnosis } from '../lib/types';

export function Ops() {
  const { toast } = useToast();
  const { data: crons, refresh: refreshCrons } = usePolling<CronJob[]>(api.cron, 30000);
  const { data: system } = usePolling<SystemMetrics>(api.system, 15000);
  const { data: docker } = usePolling<DockerContainer[]>(api.docker, 30000);
  const { data: stuckData, refresh: refreshStuck } = usePolling<{ runs: StuckRun[] }>(api.stuckRuns, 30000);

  const [unsticking, setUnsticking] = useState<string | null>(null);
  const [diagnosing, setDiagnosing] = useState<string | null>(null);
  const [diagnoses, setDiagnoses] = useState<Record<string, Diagnosis>>({});
  const [fixing, setFixing] = useState<string | null>(null);

  const handleToggle = async (id: string) => {
    try {
      await api.cronToggle(id);
      refreshCrons();
    } catch (err: any) {
      toast(`Toggle failed: ${err.message}`, 'error');
    }
  };

  const handleUnstick = async (runId: string, stepId?: string) => {
    setUnsticking(runId);
    try {
      const res = await api.unstickRun(runId, stepId);
      if (res.success) {
        const names = res.unstuckedSteps.map((s: any) => s.name).join(', ');
        toast(`Unstuck: ${names}`, 'success');
      } else {
        toast(res.message || 'No stuck steps found', 'error');
      }
      refreshStuck();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setUnsticking(null);
    }
  };

  const handleDiagnose = async (runId: string, stepId: string) => {
    const key = `${runId}-${stepId}`;
    setDiagnosing(key);
    try {
      const result = await api.diagnoseRun(runId, stepId);
      setDiagnoses((prev) => ({ ...prev, [key]: result }));
    } catch (err: any) {
      setDiagnoses((prev) => ({ ...prev, [key]: { cause: 'error', description: err.message, fixable: false } }));
    } finally {
      setDiagnosing(null);
    }
  };

  const handleAutoFix = async (runId: string, cause: string, storyId?: string) => {
    setFixing(runId);
    try {
      const result = await api.autofixRun(runId, cause, storyId);
      toast(result.message, result.success ? 'success' : 'error');
      refreshStuck();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setFixing(null);
    }
  };

  const handleSkipStory = async (runId: string, storyId: string, reason: string) => {
    setFixing(runId);
    try {
      const result = await api.skipStory(runId, storyId, reason);
      toast(result.message, result.success ? 'success' : 'error');
      refreshStuck();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setFixing(null);
    }
  };

  const stuckRuns = stuckData?.runs || [];

  return (
    <div className="ops-page">
      <GlitchText text="OPERATIONS" tag="h2" />

      {stuckRuns.length > 0 && (
        <div className="stuck-banner">
          <div className="stuck-banner__title">[!] Stuck Runs Detected</div>
          {stuckRuns.map((run) =>
            run.stuckSteps.map((step) => {
              const dKey = `${run.id}-${step.id}`;
              const diag = diagnoses[dKey];
              return (
                <div key={dKey} className="stuck-banner__item">
                  <div className="stuck-banner__info">
                    <span className="stuck-banner__run-id">{run.id.slice(0, 8)}</span>
                    <span className="stuck-banner__step">step: {step.name}</span>
                    <span className="stuck-banner__time">{step.stuckReason === 'restart-loop' ? `loop (${step.abandonResets}x)` : step.stuckReason === 'total-elapsed' ? `${step.totalElapsedMinutes || step.stuckMinutes}min total` : `${step.stuckMinutes}min`}</span>
                  </div>
                  <div className="stuck-banner__actions" style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      className="stuck-banner__btn"
                      disabled={unsticking === run.id}
                      onClick={() => handleUnstick(run.id, step.id)}
                    >
                      {unsticking === run.id ? 'UNSTICKING...' : 'UNSTICK'}
                    </button>
                    <button
                      className="stuck-banner__btn"
                      style={{ borderColor: '#0ff' }}
                      disabled={diagnosing === dKey}
                      onClick={() => handleDiagnose(run.id, step.id)}
                    >
                      {diagnosing === dKey ? 'DIAGNOSING...' : 'DIAGNOSE'}
                    </button>
                  </div>
                  {diag && (
                    <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', fontSize: '0.85rem' }}>
                      <div><strong style={{ color: diag.fixable ? '#0f0' : '#f44' }}>{diag.cause}</strong>: {diag.description}</div>
                      {diag.excerpt && <div style={{ color: '#888', marginTop: '0.25rem', fontFamily: 'monospace', fontSize: '0.75rem' }}>{diag.excerpt}</div>}
                      <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                        {diag.fixable && (
                          <button className="stuck-banner__btn" style={{ borderColor: '#0f0' }} disabled={fixing === run.id} onClick={() => handleAutoFix(run.id, diag.cause, diag.storyId)}>
                            {fixing === run.id ? 'FIXING...' : 'AUTO-FIX'}
                          </button>
                        )}
                        {diag.storyId && !diag.fixable && (
                          <button className="stuck-banner__btn" style={{ borderColor: '#f80' }} disabled={fixing === run.id} onClick={() => handleSkipStory(run.id, diag.storyId!, diag.description)}>
                            {fixing === run.id ? 'SKIPPING...' : 'SKIP STORY'}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}


      <div className="ops-page__grid">
        <div className="ops-page__section">
          <h3 className="section-title">SYSTEM METRICS</h3>
          {system ? <SystemMetricsPanel metrics={system} /> : <div className="panel__empty">Loading metrics...</div>}
        </div>

        <div className="ops-page__section">
          <h3 className="section-title">DOCKER CONTAINERS</h3>
          <div className="docker-list">
            {(docker || []).map((c) => (
              <div key={c.ID || c.Names} className={`docker-card docker-card--${c.State || 'unknown'}`}>
                <span className="docker-card__name">{c.Names}</span>
                <span className="docker-card__image">{c.Image}</span>
                <span className={`docker-card__state`}>{c.State || c.Status}</span>
              </div>
            ))}
            {(!docker || docker.length === 0) && <div className="panel__empty">No containers</div>}
          </div>
        </div>
      </div>

      <h3 className="section-title">CRON JOBS</h3>
      {crons ? <CronTable jobs={crons} onToggle={handleToggle} /> : <div className="panel__empty">Loading crons...</div>}
    </div>
  );
}
