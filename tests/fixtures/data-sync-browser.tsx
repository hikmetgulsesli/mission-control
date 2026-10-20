import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { Layout } from '../../src/components/Layout';
import { Overview } from '../../src/pages/Overview';
import { SetfarmActivity } from '../../src/pages/SetfarmActivity';
import { Workflows } from '../../src/pages/Workflows';
import { Chat } from '../../src/pages/Chat';
import { Scrape } from '../../src/pages/Scrape';
import { useAppStore } from '../../src/store/appStore';
import * as hook from '../../src/hooks/useDataSync';
import { ToastProvider } from '../../src/components/Toast';
import '../../src/index.css';
function Driver() {
    const navigate = useNavigate();
    useEffect(() => { Object.assign(window, { fixture: { navigate, state: () => useAppStore.getState(), refresh: (key: string) => (hook as any).refreshDataSync?.(key), visibility: (visible: boolean) => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: visible ? 'visible' : 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); }, unmount: () => root.unmount() } }); }, [navigate]);
    return null;
}
// Instrument the real engine's RAF calls after Playwright's clock is installed.
const originalRAF = requestAnimationFrame.bind(window), originalCancel = cancelAnimationFrame.bind(window);
const pending = new Set<number>();
(window as any).rafFixture = { pending, frames: 0 };
window.requestAnimationFrame = callback => { const id = originalRAF(time => { pending.delete(id); (window as any).rafFixture.frames++; callback(time); }); pending.add(id); return id; };
window.cancelAnimationFrame = id => { pending.delete(id); originalCancel(id); };
if (new URLSearchParams(location.search).has('hidden'))
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
const responsive = new URLSearchParams(location.search).get('profile') === 'responsive-tools-v1';
const root = createRoot(document.getElementById('root')!);
root.render(<ToastProvider><MemoryRouter initialEntries={[new URLSearchParams(location.search).get('initial') || '/']}><Driver /><Routes><Route element={<Layout />}><Route path="/" element={<Overview />}/><Route path="/setfarm" element={<SetfarmActivity />}/><Route path="/workflows" element={<Workflows />}/>{responsive && <Route path="/chat" element={<Chat />}/>} {responsive && <Route path="/scrape" element={<Scrape />}/>}<Route path="*" element={<p>Fixture route placeholder</p>}/></Route></Routes></MemoryRouter></ToastProvider>);
