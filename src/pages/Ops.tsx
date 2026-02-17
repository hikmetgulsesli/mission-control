import { useState } from 'react';
import { usePolling } from '../hooks/usePolling';
import { api } from '../lib/api';
import { CronTable } from '../components/CronTable';
import { SystemMetricsPanel } from '../components/SystemMetrics';
import { GlitchText } from '../components/GlitchText';
import type { CronJob, SystemMetrics, DockerContainer } from '../lib/types';


interface StuckStep {
  id: string;
  name: string;
  stuckMinutes: number;
  abandonResets: number;
}

interface StuckRun {
  id: string;
  workflowId: string;
  stuckSteps: StuckStep[];
}

export function Ops() {
  const { data: crons, refresh: refreshCrons } = usePolling<CronJob[]>(api.cron, 30000);
  const { data: system } = usePolling<SystemMetrics>(api.system, 15000);
  const { data: docker } = usePolling<DockerContainer[]>(api.docker, 30000);
  const { data: stuckData, refresh: refreshStuck } = usePolling<{ runs: StuckRun[] }>(api.stuckRuns, 30000);

  const [toggleError, setToggleError] = useState<string | null>(null);
  const [unstickMsg, setUnstickMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [unsticking, setUnsticking] = useState<string | null>(null);

  const handleToggle = async (id: string) => {
    try {
      await api.cronToggle(id);
      refreshCrons();
    } catch (err: any) {
      setToggleError(err.message);
      setTimeout(() => setToggleError(null), 5000);
    }
  };


  const handleUnstick = async (runId: string, stepId?: string) => {
    setUnsticking(runId);
    setUnstickMsg(null);
    try {
      const res = await api.unstickRun(runId, stepId);
      if (res.success) {
        const names = res.unstuckedSteps.map((s: any) => s.name).join(', ');
        setUnstickMsg({ type: 'ok', text: `Unstuck: ${names}` });
      } else {
        setUnstickMsg({ type: 'err', text: res.message || 'No stuck steps found' });
      }
      refreshStuck();
    } catch (err: any) {
      setUnstickMsg({ type: 'err', text: err.message });
    } finally {
      setUnsticking(null);
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
            run.stuckSteps.map((step) => (
              <div key={`${run.id}-${step.id}`} className="stuck-banner__item">
                <div className="stuck-banner__info">
                  <span className="stuck-banner__run-id">{run.id.slice(0, 8)}</span>
                  <span className="stuck-banner__step">step: {step.name}</span>
                  <span className="stuck-banner__time">{step.stuckMinutes}min</span>
                </div>
                <button
                  className="stuck-banner__btn"
                  disabled={unsticking === run.id}
                  onClick={() => handleUnstick(run.id, step.id)}
                >
                  {unsticking === run.id ? 'UNSTICKING...' : 'UNSTICK'}
                </button>
              </div>
            ))
          )}
          {unstickMsg && (
            <div className={`stuck-banner__msg stuck-banner__msg--${unstickMsg.type}`}>
              {unstickMsg.text}
            </div>
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

      {toggleError && <p style={{ color: '#f44', padding: '0.5rem 1rem' }}>Toggle failed: {toggleError}</p>}
      <h3 className="section-title">CRON JOBS</h3>
      {crons ? <CronTable jobs={crons} onToggle={handleToggle} /> : <div className="panel__empty">Loading crons...</div>}
    </div>
  );
}
