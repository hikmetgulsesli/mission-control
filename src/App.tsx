import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Overview } from './pages/Overview';
import { AntfarmActivity } from './pages/AntfarmActivity';
import { Workflows } from './pages/Workflows';
import { Chat } from './pages/Chat';
import { Ops } from './pages/Ops';
import { Costs } from './pages/Costs';
import { Performance } from './pages/Performance';
import { Tasks } from './pages/Tasks';
import { Projects } from './pages/Projects';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Overview />} />
          <Route path="agents" element={<AntfarmActivity />} />
          <Route path="antfarm" element={<AntfarmActivity />} />
          <Route path="workflows" element={<Workflows />} />
          <Route path="chat" element={<Chat />} />
          <Route path="ops" element={<Ops />} />
          <Route path="costs" element={<Costs />} />
          <Route path="performance" element={<Performance />} />
          <Route path="perf" element={<Performance />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="projects" element={<Projects />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
