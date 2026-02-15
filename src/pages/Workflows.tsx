import { useState } from 'react';
import { usePolling } from '../hooks/usePolling';
import { api } from '../lib/api';
import { WorkflowKanban } from '../components/WorkflowKanban';
import { GlitchText } from '../components/GlitchText';
import type { Workflow, Run } from '../lib/types';

export function Workflows() {
  const { data: workflows, loading } = usePolling<Workflow[]>(api.workflows, 30000);
  const { data: runs, refresh: refreshRuns } = usePolling<Run[]>(api.runs, 15000);
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
      refreshRuns();
    } catch (err: any) {
      alert('Failed: ' + err.message);
    } finally {
      setStarting(false);
    }
  };

  if (loading) return <div className="page-loading">Loading workflows...</div>;

  const allRuns = runs || [];

  return (
    <div className="workflows-page">
      <div className="workflows-page__header">
        <GlitchText text="WORKFLOWS" tag="h2" />
        <button className="btn btn--primary" onClick={() => setShowModal(true)}>
          + START RUN
        </button>
      </div>

      <WorkflowKanban workflows={workflows || []} runs={allRuns} />

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
