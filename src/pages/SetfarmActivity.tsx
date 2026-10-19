import { dataSyncMessage, type DataSyncKey } from "../lib/data-sync";
import { acceptDataSync, refreshDataSync } from "../hooks/useDataSync";
import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "../store/appStore";
import { api } from "../lib/api";
import { useToast } from "../components/Toast";
import { GlitchText } from "../components/GlitchText";
import { AgentMiniGrid } from "../components/AgentMiniGrid";
import { PipelineView } from "../components/PipelineView";
import { SetfarmFeed } from "../components/SetfarmFeed";
import { CompactStatsBar } from "../components/CompactStatsBar";
import { AgentChatFeed } from "../components/AgentChatFeed";
import { ConfirmDialog } from "../components/ConfirmDialog";

export function SetfarmActivity() {
  const navigate = useNavigate();
  const [filterStatus, setFilterStatus] = useState("");
  const [filterSearch, setFilterSearch] = useState("");
  const { toast } = useToast();
  const sync = useAppStore(s => s.sync);
  const agents = useAppStore(s => s.agents);
  const pipeline = useAppStore(s => s.pipeline);
  const activity = useAppStore(s => s.activity);
  const wfAgents = useAppStore(s => s.wfAgents);
  const alerts = useAppStore(s => s.alerts);
  const workflows = useAppStore(s => s.workflows);
  const sessions = useAppStore(s => s.sessions);

  const [showModal, setShowModal] = useState(false);
  const [selectedWf, setSelectedWf] = useState("");
  const [task, setTask] = useState("");
  const [starting, setStarting] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ title: string; message: string; action: () => void } | null>(null);

  const downloadJson = useCallback((data: any, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleClearAgentFeed = useCallback(async () => {
    setConfirmAction({
      title: "Clear Agent Output",
      message: "Clear all agent output?",
      action: async () => {
        try {
          await api.clearAgentFeed();
          toast("Agent output cleared", "success");
        } catch (err: any) {
          toast("Failed: " + err.message, "error");
        }
      },
    });
  }, [toast]);

  const handleSaveActivity = useCallback(() => {
    downloadJson(activity || [], `activity-feed-${new Date().toISOString().slice(0, 10)}.json`);
  }, [activity, downloadJson]);

  const handleClearActivity = useCallback(async () => {
    setConfirmAction({
      title: "Clear Activity Feed",
      message: "Clear all activity events?",
      action: async () => {
        try {
          await api.clearActivity();
          acceptDataSync("activity", []);
          toast("Activity feed cleared", "success");
        } catch (err: any) {
          toast("Failed: " + err.message, "error");
        }
      },
    });
  }, [toast]);

  const handleStartRun = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWf || !task.trim()) return;
    setStarting(true);
    try {
      await api.startRun(selectedWf, task.trim());
      setShowModal(false);
      setTask("");
      setSelectedWf("");
      void refreshDataSync("pipeline");
    } catch (err: any) {
      toast("Failed: " + err.message, "error");
    } finally {
      setStarting(false);
    }
  };

  const receipt = (key: DataSyncKey, label: string) => <p role="status">{label}: {dataSyncMessage(sync?.[key])}</p>;
  return (
    <div className="af-page">
      <div className="af-page__header">
        <div className="af-page__header-left">
          <GlitchText text="SETFARM" />

        <div style={{ display: "flex", gap: "8px", marginBottom: "8px", flexWrap: "wrap" }}>
          <input
            placeholder="Search project or task..."
            value={filterSearch}
            onChange={e => setFilterSearch(e.target.value)}
            style={{ flex: 1, minWidth: "150px", background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-primary)", padding: "4px 8px", fontSize: "14px", fontFamily: "var(--font)" }}
          />
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-primary)", padding: "4px 8px", fontSize: "14px", fontFamily: "var(--font)" }}
          >
            <option value="">All statuses</option>
            <option value="running">Running</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
          <div className="af-page__subtitle">Agent Activity &amp; Workflow Pipeline</div>
        </div>
        <div>
          {receipt('alerts', 'Alerts')}{receipt('wfAgents', 'Workflow agents')}
          {alerts !== null && wfAgents !== null ? <CompactStatsBar alerts={alerts} agents={wfAgents} /> : <p>Alerts / agent statistics unavailable</p>}
        </div>
      </div>

      {/* Top half: Our 10 agents */}
      <section className="af-section">
        <div className="af-section__title">OUR AGENTS</div>
        {receipt('agents', 'Agents')}{receipt('sessions', 'Sessions')}
        {agents !== null && pipeline !== null && sessions !== null ? <AgentMiniGrid agents={agents} pipeline={pipeline} sessions={sessions} /> : <p>Agent grid unavailable until its collections are observed.</p>}
      </section>

      {/* Bottom half: 3-column layout */}
      <section className="af-bottom">
        <div className="af-bottom__col af-bottom__col--pipeline">
          <div className="af-section__title" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            PIPELINE
            <button className="btn btn--small btn--primary" disabled={workflows === null} onClick={() => setShowModal(true)}>+ START RUN</button>
            <button className="btn btn--small" onClick={() => navigate("/setfarm/active")}>ACTIVE RUN</button>
          </div>
          {receipt('pipeline', 'Pipeline')}{receipt('workflows', 'Workflows')}
          {pipeline !== null ? <PipelineView runs={pipeline} /> : <p>Pipeline unavailable</p>}
        </div>
        <div className="af-bottom__col af-bottom__col--feed">
          <div className="af-section__title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            ACTIVITY FEED
            <button className="btn btn--tiny" disabled={activity === null} onClick={handleSaveActivity} title="Save as JSON">SAVE</button>
            <button className="btn btn--tiny btn--danger" onClick={handleClearActivity} title="Clear feed">CLEAR</button>
          </div>
          {receipt('activity', 'Activity')}
          {activity !== null ? <SetfarmFeed events={activity} /> : <p>Activity unavailable</p>}
        </div>
        <div className="af-bottom__col af-bottom__col--stats">
          <div className="af-section__title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            AGENT OUTPUT
            <button className="btn btn--tiny" onClick={async () => {
              try {
                const data = await api.setfarmAgentFeed(500);
                downloadJson(data, `agent-output-${new Date().toISOString().slice(0, 10)}.json`);
              } catch (err: any) { toast("Failed: " + err.message, "error"); }
            }} title="Save as JSON">SAVE</button>
            <button className="btn btn--tiny btn--danger" onClick={handleClearAgentFeed} title="Clear agent output">CLEAR</button>
          </div>
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
                {starting ? "Starting..." : "Start"}
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmAction}
        title={confirmAction?.title || ""}
        message={confirmAction?.message || ""}
        confirmLabel="Confirm"
        onConfirm={() => {
          const action = confirmAction?.action;
          setConfirmAction(null);
          if (action) action();
        }}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
