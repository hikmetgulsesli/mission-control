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
          <h3 style={{ color: "#f85149", margin: 0 }}>Projeyi Sil</h3>
          <button className="modal__close" onClick={() => !loading && onClose()}>{"✕"}</button>
        </div>
        <div className="delete-modal__body">
          <div className="delete-modal__warning">
            <strong>{target.emoji} {target.name}</strong> projesi ve tum kaynaklari kalici olarak silinecek.
          </div>

          {/* Checklist — only visible during/after deletion */}
          {(loading || result || steps.some(s => s.status !== "waiting")) && (
            <div style={{ margin: "12px 0", display: "flex", flexDirection: "column", gap: "6px" }}>
              {(steps.length > 0 ? steps : [
                { id: "service", label: "Systemd servisi", detail: target.service || "-", status: "waiting" as const },
                { id: "tunnel", label: "Cloudflare tunnel", detail: target.domain || "-", status: "waiting" as const },
                { id: "files", label: "Yerel dosyalar", detail: target.repo || "~/projects/" + target.id, status: "waiting" as const },
                { id: "github", label: "GitHub repo", detail: target.github?.replace("https://github.com/", "") || "-", status: "waiting" as const },
                { id: "json", label: "projects.json", detail: target.id, status: "waiting" as const },
                { id: "db", label: "Pipeline kayitlari", detail: "runs, steps, stories", status: "waiting" as const },
              ]).map((step) => (
                <div key={step.id} style={{
                  display: "flex", alignItems: "center", gap: "8px", padding: "6px 10px",
                  background: step.status === "done" ? "rgba(63, 185, 80, 0.08)" : step.status === "fail" ? "rgba(248, 81, 73, 0.08)" : "rgba(255,255,255,0.03)",
                  borderRadius: "6px", fontSize: "13px", transition: "all 0.3s ease",
                  borderLeft: `3px solid ${step.status === "done" ? "#3fb950" : step.status === "fail" ? "#f85149" : step.status === "skip" ? "#484f58" : "#30363d"}`
                }}>
                  <span style={{ fontSize: "16px", width: "20px", textAlign: "center", flexShrink: 0 }}>
                    {step.status === "done" ? "\u2705" : step.status === "fail" ? "\u274C" : step.status === "skip" ? "\u2796" : "\u23F3"}
                  </span>
                  <span style={{ color: step.status === "skip" ? "#484f58" : "#e6edf3", fontWeight: 500 }}>{step.label}</span>
                  <span style={{ color: "#484f58", fontSize: "11px", marginLeft: "auto", fontFamily: "monospace" }}>{step.detail}</span>
                </div>
              ))}
            </div>
          )}

          {!loading && !result && (
            <div style={{ margin: "12px 0", padding: "10px", background: "rgba(255,255,255,0.03)", borderRadius: "6px", fontSize: "13px", color: "#8b949e" }}>
              Silinecekler: servis, tunnel, dosyalar, GitHub repo, DB kayitlari
            </div>
          )}

          {!result && (
            <div className="delete-modal__confirm">
              <label>Onaylamak icin proje adini yazin: <strong style={{ color: "#f85149" }}>{target.name}</strong></label>
              <input type="text" value={confirmText} onChange={(e) => onConfirmTextChange(e.target.value)} placeholder={target.name} disabled={loading} autoFocus />
            </div>
          )}
          {result && !result.success && (
            <div className="delete-modal__result delete-modal__result--error">
              <strong>Hata:</strong> {result.error}
            </div>
          )}
        </div>
        <div className="modal__actions">
          {result?.success ? (
            <button className="btn" onClick={onClose}>Kapat</button>
          ) : (
            <>
              <button className="btn" onClick={onClose} disabled={loading}>Vazgec</button>
              <button className="btn btn--danger" onClick={onDelete} disabled={confirmText.trim() !== target.name.trim() || loading}>
                {loading ? "Siliniyor..." : "Kalici Olarak Sil"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
});
