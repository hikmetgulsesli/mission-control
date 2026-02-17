import { useState } from 'react';
import { usePolling } from '../hooks/usePolling';
import { api } from '../lib/api';
import { CronTable } from '../components/CronTable';
import { SystemMetricsPanel } from '../components/SystemMetrics';
import { GlitchText } from '../components/GlitchText';
import type { CronJob, SystemMetrics, DockerContainer } from '../lib/types';

export function Ops() {
  const { data: crons, refresh: refreshCrons } = usePolling<CronJob[]>(api.cron, 30000);
  const { data: system } = usePolling<SystemMetrics>(api.system, 15000);
  const { data: docker } = usePolling<DockerContainer[]>(api.docker, 30000);
  const [toggleError, setToggleError] = useState<string | null>(null);

  const handleToggle = async (id: string) => {
    try {
      await api.cronToggle(id);
      refreshCrons();
    } catch (err: any) {
      setToggleError(err.message);
      setTimeout(() => setToggleError(null), 5000);
    }
  };

  return (
    <div className="ops-page">
      <GlitchText text="OPERATIONS" tag="h2" />

      <div className="ops-page__grid">
        <div className="ops-page__section">
          <h3 className="section-title">SYSTEM METRICS</h3>
          {system ? <SystemMetricsPanel metrics={system} /> : <div className="panel__empty">Loading metrics...</div>}
        </div>

        <div className="ops-page__section">
          <h3 className="section-title">DOCKER CONTAINERS</h3>
          <div className="docker-list">
            {(docker || []).map((c: any) => (
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
