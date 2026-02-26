import { BrowserRouter, Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom';
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
import { Workflows } from './pages/Workflows';
import { Tasks } from './pages/Tasks';
import { RunDetail } from './pages/RunDetail';
import { NotFound } from "./pages/NotFound";
import { Scrape } from "./pages/Scrape";

function RunDetailRoute() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  if (!id) return <NotFound />;
  return <RunDetail runId={id} onBack={() => navigate('/setfarm')} />;
}

export default function App() {
  return (
    <ErrorBoundary>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Overview />} />
          <Route path="office" element={<></>} />
          <Route path="setfarm" element={<SetfarmActivity />} />
          <Route path="setfarm/runs/:id" element={<RunDetailRoute />} />
          <Route path="agents" element={<Navigate to="/setfarm" replace />} />
          <Route path="chat" element={<Chat />} />
          <Route path="ops" element={<Ops />} />
          <Route path="costs" element={<Costs />} />
          <Route path="performance" element={<Performance />} />
          <Route path="perf" element={<Navigate to="/performance" replace />} />
          <Route path="projects" element={<Projects />} />
          <Route path="files" element={<Files />} />
          <Route path="scrape" element={<Scrape />} />
          <Route path="workflows" element={<Workflows />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
    </ErrorBoundary>
  );
}
