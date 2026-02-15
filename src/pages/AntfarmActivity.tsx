import { useState } from 'react';
import { usePolling } from '../hooks/usePolling';
import { api } from '../lib/api';
import { GlitchText } from '../components/GlitchText';
import { AgentMiniGrid } from '../components/AgentMiniGrid';
import { PipelineView } from '../components/PipelineView';
import { AntfarmFeed } from '../components/AntfarmFeed';
import { WorkflowAgentStats } from '../components/WorkflowAgentStats';
import type { Workflow } from '../lib/types';

export function AntfarmActivity() {
  const { data: agents } = usePolling(api.agents, 30_000);
  const { data: pipeline, refresh: refreshPipeline } = usePolling(api.antfarmPipeline, 10_000);
  const { data: activity } = usePolling(api.antfarmActivity, 10_000);
  const { data: wfAgents } = usePolling(api.antfarmAgents, 30_000);
  const { data: alerts } = usePolling(api.antfarmAlerts, 15_000);
  const { data: workflows } = usePolling<Workflow[]>(api.workflows, 30_000);
  const { data: sessions } = usePolling(api.sessions, 30_000);

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
      refreshPipeline();
    } catch (err: any) {
      alert('Failed: ' + err.message);
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="af-page">
      <div className="af-page__header">
        <GlitchText text="ANTFARM" />
        <div className="af-page__subtitle">Agent Activity &amp; Workflow Pipeline</div>
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
          <AntfarmFeed events={activity || []} />
        </div>
        <div className="af-bottom__col af-bottom__col--stats">
          <div className="af-section__title">STATS &amp; ALERTS</div>
          <WorkflowAgentStats agents={wfAgents || []} alerts={alerts} />
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
