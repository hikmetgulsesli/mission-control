import { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { StatusBar } from './StatusBar';
import { TabNav } from './TabNav';
import { ScanlineOverlay } from './ScanlineOverlay';
import { TerminalDrawer } from './TerminalWidget';

const KEY_MAP: Record<string, string | null> = {
  '0': '/office',
  '1': '/agents',
  '2': '/chat',
  '3': '/ops',
  '4': '/costs',
  '5': '/performance',
  '6': '/projects',
  '7': '/files',
  '8': null, // shell toggle
};

export function Layout() {
  const [shellOpen, setShellOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Escape closes terminal from anywhere
      if (e.key === 'Escape' && shellOpen) {
        e.preventDefault();
        setShellOpen(false);
        return;
      }

      // Skip number shortcuts if user is typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return;

      if (e.key in KEY_MAP) {
        e.preventDefault();
        const route = KEY_MAP[e.key];
        if (route === null) {
          setShellOpen(o => !o);
        } else {
          navigate(route);
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, shellOpen]);

  return (
    <div className="layout">
      <ScanlineOverlay />
      <StatusBar />
      <TabNav onShellToggle={() => setShellOpen(o => !o)} shellOpen={shellOpen} />
      <main className={`layout__content ${shellOpen ? 'layout__content--shell-open' : ''}`}>
        <Outlet />
      </main>
      <TerminalDrawer open={shellOpen} onClose={() => setShellOpen(false)} />
    </div>
  );
}
