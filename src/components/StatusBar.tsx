import { useAppStore } from '../store/appStore';
import { format } from 'date-fns';
import { useState, useEffect } from 'react';
import { ChangelogModal } from './ChangelogModal';

export function StatusBar() {
  const system = useAppStore(s => s.system);
  const overview = useAppStore(s => s.overview);
  const [time, setTime] = useState(format(new Date(), 'HH:mm'));
  const [changelogOpen, setChangelogOpen] = useState(false);

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
        <button
          className="status-bar__version-btn"
          onClick={() => setChangelogOpen(true)}
          title="Sürüm ve değişiklikler"
          aria-label="Versiyon"
        >
          v
        </button>
      </div>
      <ChangelogModal open={changelogOpen} onClose={() => setChangelogOpen(false)} />
    </header>
  );
}
