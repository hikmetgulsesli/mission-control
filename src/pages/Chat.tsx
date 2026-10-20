import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usePolling } from '../hooks/usePolling';
import { useWebSocket } from '../hooks/useWebSocket';
import { api } from '../lib/api';
import { chatTargetDisplay } from '../lib/chat-presentation';
import { ChatPanel } from '../components/ChatPanel';
import { ChatSidebar } from '../components/ChatSidebar';
import { LiveProgressPanel } from '../components/LiveProgressPanel';
import { GlitchText } from '../components/GlitchText';

export function Chat() {
  const { data: agents, loading: agentsLoading, error: agentsError } = usePolling(api.agents, 60000);
  const { messages: events, connected, send } = useWebSocket();
  const [searchParams] = useSearchParams();
  const [selectedAgent, setSelectedAgent] = useState('main');
  const [showProgress, setShowProgress] = useState(false);

  // Read agent from URL query param
  useEffect(() => {
    const agentParam = searchParams.get('agent');
    if (agentParam) setSelectedAgent(agentParam);
  }, [searchParams]);

  const selectedAgentData = (agents || []).find((a) => a.id === selectedAgent);
  const { name: agentName } = chatTargetDisplay(selectedAgent, selectedAgentData);

  return (
    <div className="chat-page">
      <GlitchText text="COMMS" tag="h2" />

      {/* Show progress toggle button */}
      {selectedAgent && (
        <button
          className="btn btn--small"
          style={{ marginBottom: '16px' }}
          onClick={() => setShowProgress(!showProgress)}
        >
          {showProgress ? '\u{1F6AB} Hide Progress' : '\u{1F4E1} Show Progress'}
        </button>
      )}

      <p className="chat-page__notice">Targets include catalog defaults and recorded agents. Catalog roles describe defaults; availability is unverified.</p>

      <div className="chat-page__layout">
        <ChatSidebar
          agents={agents || []}
          selected={selectedAgent}
          onSelect={setSelectedAgent}
          loading={agentsLoading}
          error={agentsError}
        />
        <ChatPanel
          events={events}
          onSend={send}
          connected={connected}
          selectedAgent={selectedAgent}
          selectedAgentData={selectedAgentData}
        />
      </div>

      {/* Live Progress Panel */}
      {showProgress && selectedAgent && (
        <LiveProgressPanel
          agentId={selectedAgent}
          agentName={agentName}
          onClose={() => setShowProgress(false)}
        />
      )}
    </div>
  );
}
