import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Overview } from './pages/Overview';
import { Agents } from './pages/Agents';
import { Workflows } from './pages/Workflows';
import { Chat } from './pages/Chat';
import { Ops } from './pages/Ops';
import { Costs } from './pages/Costs';
import { Performance } from './pages/Performance';
import { Tasks } from './pages/Tasks';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Overview />} />
          <Route path="agents" element={<Agents />} />
          <Route path="workflows" element={<Workflows />} />
          <Route path="chat" element={<Chat />} />
          <Route path="ops" element={<Ops />} />
          <Route path="costs" element={<Costs />} />
          <Route path="performance" element={<Performance />} />
          <Route path="tasks" element={<Tasks />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
