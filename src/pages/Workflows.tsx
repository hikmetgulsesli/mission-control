import { useState } from 'react';
import { usePolling } from '../hooks/usePolling';
import { api } from '../lib/api';
import { WorkflowKanban } from '../components/WorkflowKanban';
import { RunCard } from '../components/RunCard';
import { RunDetail } from './RunDetail';
import { GlitchText } from '../components/GlitchText';
import type { Workflow, Run } from '../lib/types';
import { ApprovalPanel } from '../components/ApprovalPanel';

export function Workflows() {
  const { data: workflows, loading } = usePolling<Workflow[]>(api.workflows, 30000);
  const { data: runs, refresh: refreshRuns } = usePolling<Run[]>(api.runs, 10000);
  const [showModal, setShowModal] = useState(false);
  const [selectedWf, setSelectedWf] = useState('');
  const [task, setTask] = useState('');
  const [starting, setStarting] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

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

  const handleDeleteRun = async (runId: string) => {
    try {
      await api.deleteRun(runId);
      refreshRuns();
    } catch (err: any) {
      alert('Delete failed: ' + err.message);
    }
  };

  // If a run is selected, show detail page
  if (selectedRunId) {
    return <RunDetail runId={selectedRunId} onBack={() => setSelectedRunId(null)} />;
  }

  if (loading) return <div className="page-loading">Loading workflows...</div>;

  const allRuns = runs || [];
  const activeRuns = allRuns.filter(r => r.status === 'running');
  const completedRuns = allRuns.filter(r => r.status !== 'running');

  return (
    <div className="workflows-page">
      <ApprovalPanel />
      <div className="workflows-page__header">
        <GlitchText text="WORKFLOWS" tag="h2" />
        <div className="workflows-page__stats">
          <span className="stat-chip">{(workflows || []).length} workflows</span>
          <span className="stat-chip stat-chip--active">{activeRuns.length} active</span>
          <span className="stat-chip">{allRuns.length} total runs</span>
        </div>
        <button className="btn btn--primary" onClick={() => setShowModal(true)}>
          + START RUN
        </button>
      </div>

      <WorkflowKanban workflows={workflows || []} runs={allRuns} onRunClick={setSelectedRunId} />

      {activeRuns.length > 0 && (
        <>
          <h3 className="section-title">
            <span className="pulse-dot" /> ACTIVE RUNS
          </h3>
          <div className="runs-list">
            {activeRuns.map(run => (
              <RunCard key={run.id} run={run} onClick={() => setSelectedRunId(run.id)} />
            ))}
          </div>
        </>
      )}

      <h3 className="section-title">RUN HISTORY</h3>
      <div className="runs-list">
        {completedRuns.length === 0 ? (
          <div className="panel__empty">No completed runs yet</div>
        ) : (
          completedRuns.slice(0, 20).map(run => (
            <RunCard key={run.id} run={run} onClick={() => setSelectedRunId(run.id)} onDelete={() => handleDeleteRun(run.id)} />
          ))
        )}
      </div>

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
              <textarea value={task} onChange={e => setTask(e.target.value)} rows={4} placeholder="PRD veya task açıklaması..." />
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
