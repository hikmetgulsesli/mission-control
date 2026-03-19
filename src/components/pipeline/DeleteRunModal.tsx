import React from "react";
import { createPortal } from "react-dom";

interface DeleteStep {
  id: string;
  label: string;
  status: string;
  detail?: string;
}

export interface DeleteRunModalProps {
  modal: { runId: string; runNumber: number; task: string } | null;
  input: string;
  cleanup: boolean;
  steps: DeleteStep[];
  result: { success?: boolean; error?: string } | null;
  loading: boolean;
  onInputChange: (value: string) => void;
  onCleanupChange: (value: boolean) => void;
  onConfirm: () => void;
  onClose: () => void;
}

export const DeleteRunModal = React.memo(function DeleteRunModal({
  modal,
  input,
  cleanup,
  steps,
  result,
  loading,
  onInputChange,
  onCleanupChange,
  onConfirm,
  onClose,
}: DeleteRunModalProps) {
  if (!modal) return null;

  return createPortal(
    <div className="modal-backdrop" onClick={() => !loading && onClose()}>
      <div className="modal modal--delete" onClick={e => e.stopPropagation()}>
        <h3 style={{ color: "#f85149", margin: "0 0 12px" }}>Run #{modal.runNumber} Sil</h3>
        <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.6)", margin: "0 0 8px" }}>
          {modal.task.length > 120 ? modal.task.slice(0, 120) + "..." : modal.task}
        </p>

        {/* Checklist */}
        {steps.length > 0 && (
          <div style={{ margin: "8px 0 12px", display: "flex", flexDirection: "column", gap: "4px" }}>
            {steps.map((step) => (
              <div key={step.id} style={{
                display: "flex", alignItems: "center", gap: "8px", padding: "5px 8px",
                background: step.status === "done" ? "rgba(63, 185, 80, 0.08)" : step.status === "fail" ? "rgba(248, 81, 73, 0.08)" : "rgba(255,255,255,0.03)",
                borderRadius: "5px", fontSize: "12px", transition: "all 0.3s ease",
                borderLeft: `3px solid ${step.status === "done" ? "#3fb950" : step.status === "fail" ? "#f85149" : step.status === "skip" ? "#484f58" : "#30363d"}`
              }}>
                <span style={{ fontSize: "14px", width: "18px", textAlign: "center", flexShrink: 0 }}>
                  {step.status === "done" ? "\u2705" : step.status === "fail" ? "\u274C" : step.status === "skip" ? "\u2796" : "\u2B1C"}
                </span>
                <span style={{ color: step.status === "skip" ? "#484f58" : "#e6edf3", fontWeight: 500 }}>{step.label}</span>
                {step.detail && <span style={{ color: "#484f58", fontSize: "10px", marginLeft: "auto", fontFamily: "monospace" }}>{step.detail}</span>}
              </div>
            ))}
          </div>
        )}

        {!result && (
          <>
            <p style={{ fontSize: "12px", margin: "0 0 8px" }}>
              Silmek icin run numarasini yazin: <strong style={{ color: "#f85149" }}>#{modal.runNumber}</strong>
            </p>
            <input
              type="text"
              className="modal__input"
              placeholder={"#" + modal.runNumber}
              value={input}
              onChange={e => onInputChange(e.target.value)}
              autoFocus
            />
            <label style={{ display: "flex", alignItems: "center", gap: "6px", margin: "10px 0", fontSize: "12px", cursor: "pointer" }}>
              <input type="checkbox" checked={cleanup} onChange={e => onCleanupChange(e.target.checked)} />
              <span>Projeyi de sil (servis, dosyalar, GitHub, tunnel)</span>
            </label>
          </>
        )}
        {result?.error && (
          <div style={{ padding: "8px", background: "rgba(248, 81, 73, 0.1)", borderRadius: "6px", fontSize: "12px", color: "#f85149", margin: "8px 0" }}>
            Hata: {result.error}
          </div>
        )}
        <div className="modal__actions">
          {result?.success ? (
            <button className="btn" onClick={onClose}>Kapat</button>
          ) : (
            <>
              <button className="btn" onClick={onClose}>Vazgec</button>
              <button
                className="btn btn--danger"
                disabled={input !== "#" + modal.runNumber || loading}
                onClick={onConfirm}
              >
                {loading ? "Siliniyor..." : "Kalici Sil"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
});
