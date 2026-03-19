import { StrictMode } from 'react';
import './lib/fetch-interceptor';
import { createRoot } from 'react-dom/client';
import { ToastProvider } from './components/Toast';
import App from './App';
import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/pages/pipeline.css';
import './styles/pages/projects.css';
import './styles/pages/agents.css';
import './styles/pages/overview.css';
import './styles/terminal.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>
);
