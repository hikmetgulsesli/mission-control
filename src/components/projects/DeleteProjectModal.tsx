import React from "react";

interface DeleteStep {
  id: string;
  label: string;
  detail: string;
  status: "waiting" | "done" | "fail" | "skip";
}

export interface DeleteProjectModalProps {
  target: {
    id: string;
    name: string;
    emoji: string;
    service: string;
    domain: string;
    repo: string;
    github?: string;
  } | null;
  confirmText: string;
  loading: boolean;
  result: { success: boolean; log?: string[]; error?: string } | null;
  steps: DeleteStep[];
  onConfirmTextChange: (value: string) => void;
  onDelete: () => void;
  onClose: () => void;
}

export const DeleteProjectModal = React.memo(function DeleteProjectModal({
  target,
  confirmText,
  loading,
  result,
  steps,
  onConfirmTextChange,
  onDelete,
  onClose,
}: DeleteProjectModalProps) {
  if (!target) return null;

  return (
    <div className="modal-backdrop" onClick={() => !loading && onClose()}>
      <div className="modal delete-modal" onClick={(e) => e.stopPropagation()}>
        <div className="delete-modal__header">
          <h3 style={{ color: "#f85149", margin: 0 }}>Delete Project</h3>
          <button className="modal__close" onClick={() => !loading && onClose()}>{"✕"}</button>
        </div>
        <div className="delete-modal__body">
          <div className="delete-modal__warning">
            <strong>{target.emoji} {target.name}</strong> and all project resources will be permanently deleted.
          </div>

          {/* Checklist — only visible during/after deletion */}
          {(loading || result || steps.some(s => s.status !== "waiting")) && (
            <div style={{ margin: "12px 0", display: "flex", flexDirection: "column", gap: "6px" }}>
              {(steps.length > 0 ? steps : [
                { id: "service", label: "Systemd service", detail: target.service || "-", status: "waiting" as const },
                { id: "tunnel", label: "Cloudflare tunnel", detail: target.domain || "-", status: "waiting" as const },
                { id: "files", label: "Local files", detail: target.repo || "~/projects/" + target.id, status: "waiting" as const },
                { id: "github", label: "GitHub repo", detail: target.github?.replace("https://github.com/", "") || "-", status: "waiting" as const },
                { id: "json", label: "projects.json", detail: target.id, status: "waiting" as const },
                { id: "db", label: "Pipeline records", detail: "runs, steps, stories", status: "waiting" as const },
              ]).map((step) => {
                const visibleStatus = step.status === "skip" ? "done" : step.status;
                return (
                  <div key={step.id} style={{
                    display: "flex", alignItems: "center", gap: "8px", padding: "6px 10px",
                    background: visibleStatus === "done" ? "rgba(63, 185, 80, 0.08)" : visibleStatus === "fail" ? "rgba(248, 81, 73, 0.08)" : "rgba(255,255,255,0.03)",
                    borderRadius: "6px", fontSize: "13px", transition: "all 0.3s ease",
                    borderLeft: `3px solid ${visibleStatus === "done" ? "#3fb950" : visibleStatus === "fail" ? "#f85149" : "#30363d"}`
                  }}>
                    <span style={{ fontSize: "16px", width: "20px", textAlign: "center", flexShrink: 0 }}>
                      {visibleStatus === "done" ? "\u2705" : visibleStatus === "fail" ? "\u274C" : "\u23F3"}
                    </span>
                    <span style={{ color: "#e6edf3", fontWeight: 500 }}>{step.label}</span>
                    <span style={{ color: "#484f58", fontSize: "11px", marginLeft: "auto", fontFamily: "monospace" }}>{step.detail}</span>
                  </div>
                );
              })}
            </div>
          )}

          {!loading && !result && (
            <div style={{ margin: "12px 0", padding: "10px", background: "rgba(255,255,255,0.03)", borderRadius: "6px", fontSize: "13px", color: "#8b949e" }}>
              Deletion scope: service, tunnel, files, GitHub repo, database records
            </div>
          )}

          {!result && (
            <div className="delete-modal__confirm">
              <label>Type the project name to confirm: <strong style={{ color: "#f85149" }}>{target.name}</strong></label>
              <input type="text" value={confirmText} onChange={(e) => onConfirmTextChange(e.target.value)} placeholder={target.name} disabled={loading} autoFocus />
            </div>
          )}
          {result && !result.success && (
            <div className="delete-modal__result delete-modal__result--error">
              <strong>Error:</strong> {result.error}
            </div>
          )}
        </div>
        <div className="modal__actions">
          {result?.success ? (
            <button className="btn" onClick={onClose}>Close</button>
          ) : (
            <>
              <button className="btn" onClick={onClose} disabled={loading}>Cancel</button>
              <button className="btn btn--danger" onClick={onDelete} disabled={confirmText.trim() !== target.name.trim() || loading}>
                {loading ? "Deleting..." : "Delete Permanently"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
});
