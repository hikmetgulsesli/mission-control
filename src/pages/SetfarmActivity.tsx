import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';
import { GlitchText } from '../components/GlitchText';
import { AgentMiniGrid } from '../components/AgentMiniGrid';
import { PipelineView } from '../components/PipelineView';
import { SetfarmFeed } from '../components/SetfarmFeed';
import { CompactStatsBar } from '../components/CompactStatsBar';
import { AgentChatFeed } from '../components/AgentChatFeed';

export function SetfarmActivity() {
  const { toast } = useToast();
  const initialLoading = useAppStore(s => s.initialLoading);
  const agents = useAppStore(s => s.agents);
  const pipeline = useAppStore(s => s.pipeline);
  const activity = useAppStore(s => s.activity);
  const wfAgents = useAppStore(s => s.wfAgents);
  const alerts = useAppStore(s => s.alerts);
  const workflows = useAppStore(s => s.workflows);
  const sessions = useAppStore(s => s.sessions);

  const [showModal, setShowModal] = useState(false);
  const [selectedWf, setSelectedWf] = useState('');
  const [task, setTask] = useState('');
  const [starting, setStarting] = useState(false);

  const handleStartRun = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWf || !task.trim()) return;
    setStarting(true);
    try {
      await api.startRun(selectedWf, task.trim());
      setShowModal(false);
      setTask('');
      setSelectedWf('');
      api.setfarmPipeline().then(data => useAppStore.setState({ pipeline: data })).catch(() => {});
    } catch (err: any) {
      toast('Failed: ' + err.message, 'error');
    } finally {
      setStarting(false);
    }
  };

  if (initialLoading) return <div className="page-loading">Loading agents...</div>;
  return (
    <div className="af-page">
      <div className="af-page__header">
        <div className="af-page__header-left">
          <GlitchText text="SETFARM" />
          <div className="af-page__subtitle">Agent Activity &amp; Workflow Pipeline</div>
        </div>
        <CompactStatsBar alerts={alerts} agents={wfAgents || []} />
      </div>

      {/* Top half: Our 10 agents */}
      <section className="af-section">
        <div className="af-section__title">OUR AGENTS</div>
        <AgentMiniGrid agents={agents || []} pipeline={pipeline || []} sessions={sessions || []} />
      </section>

      {/* Bottom half: 3-column layout */}
      <section className="af-bottom">
        <div className="af-bottom__col af-bottom__col--pipeline">
          <div className="af-section__title" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            PIPELINE
            <button className="btn btn--small btn--primary" onClick={() => setShowModal(true)}>+ START RUN</button>
          </div>
          <PipelineView runs={pipeline || []} />
        </div>
        <div className="af-bottom__col af-bottom__col--feed">
          <div className="af-section__title">ACTIVITY FEED</div>
          <SetfarmFeed events={activity || []} />
        </div>
        <div className="af-bottom__col af-bottom__col--stats">
          <div className="af-section__title">AGENT OUTPUT</div>
          <AgentChatFeed />
        </div>
      </section>

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <form className="modal" onClick={e => e.stopPropagation()} onSubmit={handleStartRun}>
            <h3>Start Workflow Run</h3>
            <label>
              Workflow
              <select value={selectedWf} onChange={e => setSelectedWf(e.target.value)}>
                <option value="">Select...</option>
                {(workflows || []).map(wf => (
                  <option key={wf.id} value={wf.id}>{wf.name}</option>
                ))}
              </select>
            </label>
            <label>
              Task
              <textarea value={task} onChange={e => setTask(e.target.value)} rows={3} placeholder="Describe the task..." />
            </label>
            <div className="modal__actions">
              <button type="button" className="btn" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="submit" className="btn btn--primary" disabled={starting || !selectedWf || !task.trim()}>
                {starting ? 'Starting...' : 'Start'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
