import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Layout } from './components/Layout';
import { Overview } from './pages/Overview';
import { SetfarmActivity } from './pages/SetfarmActivity';
import { Chat } from './pages/Chat';
import { Ops } from './pages/Ops';
import { Costs } from './pages/Costs';
import { Performance } from './pages/Performance';
import { Projects } from './pages/Projects';
import { Files } from './pages/Files';
import { PixelOffice } from './pages/PixelOffice';
import { NotFound } from './pages/NotFound';

export default function App() {
  return (
    <ErrorBoundary>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Overview />} />
          <Route path="office" element={<PixelOffice />} />
          <Route path="setfarm" element={<SetfarmActivity />} />
          <Route path="agents" element={<Navigate to="/setfarm" replace />} />
          <Route path="chat" element={<Chat />} />
          <Route path="ops" element={<Ops />} />
          <Route path="costs" element={<Costs />} />
          <Route path="performance" element={<Performance />} />
          <Route path="perf" element={<Navigate to="/performance" replace />} />
          <Route path="projects" element={<Projects />} />
          <Route path="files" element={<Files />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
    </ErrorBoundary>
  );
}
