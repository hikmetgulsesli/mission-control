import { usePolling } from '../hooks/usePolling';
import { api } from '../lib/api';
import type { SystemMetrics } from '../lib/types';
import { format } from 'date-fns';
import { useState, useEffect } from 'react';

export function StatusBar() {
  const { data: system } = usePolling<SystemMetrics>(api.system, 15000);
  const { data: overview } = usePolling(api.overview, 30000);
  const [time, setTime] = useState(format(new Date(), 'HH:mm'));

  useEffect(() => {
    const id = setInterval(() => setTime(format(new Date(), 'HH:mm')), 30000);
    return () => clearInterval(id);
  }, []);

  const gwStatus = overview?.gateway?.status === 'online';

  return (
    <header className="status-bar">
      <div className="status-bar__left">
        <span className="status-bar__logo">&#9672; MISSION CONTROL</span>
      </div>
      <div className="status-bar__right">
        <span className={`status-dot ${gwStatus ? 'status-dot--online' : 'status-dot--offline'}`} />
        <span>GATEWAY</span>
        <span className="status-bar__sep">|</span>
        {system && (
          <>
            <span>RAM {system.ram.used}/{system.ram.total}GB</span>
            <span className="status-bar__sep">|</span>
            <span>CPU {system.cpu.percent}%</span>
            <span className="status-bar__sep">|</span>
            <span>DISK {system.disk.percent}%</span>
            <span className="status-bar__sep">|</span>
          </>
        )}
        <span>{time}</span>
      </div>
    </header>
  );
}
