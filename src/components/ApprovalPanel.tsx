import { useState, useEffect } from "react";
import { api } from "../lib/api";

interface Approval {
  id: string;
  step_id: string;
  run_id: string;
  input_template: string;
  agent_id: string;
  task: string;
  workflow_id: string;
}

export function ApprovalPanel() {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const refresh = async () => {
    try {
      const data = await api.approvals();
      setApprovals(data);
    } catch {}
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 10000);
    return () => clearInterval(interval);
  }, []);

  if (approvals.length === 0) return null;

  return (
    <div className="approval-panel">
      <div className="approval-panel__title">Pending Approvals ({approvals.length})</div>
      {approvals.map((a) => (
        <div key={a.id} className="approval-item">
          <div className="approval-item__info">
            <div className="approval-item__step">{a.step_id} ({a.workflow_id})</div>
            <div className="approval-item__input">{a.task}</div>
          </div>
          {rejectId === a.id ? (
            <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason..."
                style={{ padding: "4px 8px", fontSize: "10px", background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: "3px", color: "var(--text-primary)", fontFamily: "var(--font)", width: "120px" }}
              />
              <button className="approval-item__btn approval-item__btn--reject" onClick={async () => { await api.rejectStep(a.id, reason); setRejectId(null); setReason(""); refresh(); }}>CONFIRM</button>
              <button className="approval-item__btn" onClick={() => setRejectId(null)} style={{ background: "none", color: "var(--text-dim)" }}>X</button>
            </div>
          ) : (
            <div className="approval-item__actions">
              <button className="approval-item__btn approval-item__btn--approve" onClick={async () => { await api.approveStep(a.id); refresh(); }}>APPROVE</button>
              <button className="approval-item__btn approval-item__btn--reject" onClick={() => setRejectId(a.id)}>REJECT</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
