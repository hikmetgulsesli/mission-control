import { Outlet } from 'react-router-dom';
import { StatusBar } from './StatusBar';
import { TabNav } from './TabNav';
import { ScanlineOverlay } from './ScanlineOverlay';

export function Layout() {
  return (
    <div className="layout">
      <ScanlineOverlay />
      <StatusBar />
      <TabNav />
      <main className="layout__content">
        <Outlet />
      </main>
    </div>
  );
}
