import { useAppStore } from '../store/appStore';
import { format } from 'date-fns';
import { useState, useEffect } from 'react';

export function StatusBar() {
  const system = useAppStore(s => s.system);
  const overview = useAppStore(s => s.overview);
  const overviewSync = useAppStore(s => s.sync?.overview);
  const systemSync = useAppStore(s => s.sync?.system);
  const [time, setTime] = useState(format(new Date(), 'HH:mm'));

  useEffect(() => {
    const id = setInterval(() => setTime(format(new Date(), 'HH:mm')), 30000);
    return () => clearInterval(id);
  }, []);

  const receiptLabel = (meta: typeof overviewSync) => `${meta?.errorCode ?? ''} · ${meta?.observedAt != null ? 'Last HTTP receipt ' + new Date(meta.observedAt).toLocaleTimeString() : 'No HTTP receipt'}`;
  const gwStatus = overview?.gateway?.status;
  const gatewayCurrent = overviewSync?.observedAt !== null && overviewSync?.observedAt !== undefined && !overviewSync.stale;

  return (
    <header className="status-bar">
      <div className="status-bar__left">
        <span className="status-bar__logo">&#9672; MISSION CONTROL</span>
      </div>
      <div className="status-bar__right">
        <span className={`status-dot ${gatewayCurrent && gwStatus === 'online' ? 'status-dot--online' : gatewayCurrent && gwStatus === 'offline' ? 'status-dot--offline' : ''}`} />
        <span title={receiptLabel(overviewSync)}>GATEWAY {gatewayCurrent ? (gwStatus === 'online' ? 'online' : gwStatus === 'offline' ? 'offline' : 'unknown') : overviewSync?.observedAt != null ? 'stale' : 'unknown'}</span>
        <span className="status-bar__sep">|</span>
        {system && (
          <>
            <span title={receiptLabel(systemSync)}>METRICS {systemSync?.stale ? 'stale' : systemSync?.observedAt == null ? 'unknown' : ''}</span>
            <span title={`${system.ram.source} · total−os.freemem (used)`}>RAM used {system.ram.used === null || system.ram.total === null ? 'Unknown' : `${system.ram.used}/${system.ram.total}GB`}</span>
            <span className="status-bar__sep">|</span>
            <span title={`${system.cpu.source} · ${system.cpu.observedAt}`}>CPU {system.cpu.percent === null ? 'Unknown' : `${system.cpu.percent}%`}</span>
            <span className="status-bar__sep">|</span>
            <span title={`${system.disk.source} · ${system.disk.mount ?? system.disk.path}`}>DISK {system.disk.percent === null ? 'Unknown' : `${system.disk.percent}%`}</span>
            <span className="status-bar__sep">|</span>
          </>
        )}
        {!system && <span title={receiptLabel(systemSync)}>METRICS unknown</span>}
        <span>{time}</span>
        <a
          href="/changelog"
          target="_blank"
          rel="noopener noreferrer"
          className="status-bar__version-btn"
          title="Version and changes"
          aria-label="Version"
        >
          v
        </a>
      </div>
    </header>
  );
}
