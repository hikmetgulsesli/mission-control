import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { StatusBar } from './StatusBar';
import { KimiQuotaBanner } from './KimiQuotaBanner';
import { TabNav } from './TabNav';
import { TerminalDrawer } from './TerminalDrawer';
import { PixelOffice } from '../pages/PixelOffice';
import { useDataSync } from '../hooks/useDataSync';
import { resolveNavigationShortcut } from '../lib/navigation';

export function Layout() {
  const [shellOpen, setShellOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const isOffice = location.pathname === '/office';
  useDataSync(location.pathname);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Escape closes terminal from anywhere
      if (e.key === 'Escape' && shellOpen) {
        e.preventDefault();
        setShellOpen(false);
        return;
      }

      const shortcut = resolveNavigationShortcut(e);
      if (!shortcut) return;
      e.preventDefault();
      if (shortcut.type === 'shell') setShellOpen(open => !open);
      else navigate(shortcut.href);
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, shellOpen]);

  return (
    <div className="layout">
      <KimiQuotaBanner />
      <StatusBar />
      <TabNav onShellToggle={() => setShellOpen(o => !o)} shellOpen={shellOpen} />
      <main className={`layout__content ${shellOpen ? 'layout__content--shell-open' : ''}`}>
        <div style={{ display: isOffice ? 'contents' : 'none' }}>
          <PixelOffice visible={isOffice} />
        </div>
        {!isOffice && <Outlet />}
      </main>
      <TerminalDrawer open={shellOpen} onClose={() => setShellOpen(false)} />
    </div>
  );
}
