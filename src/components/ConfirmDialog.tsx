import React from "react";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog = React.memo(function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Onayla",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.7)", margin: "0 0 16px" }}>
          {message}
        </p>
        <div className="modal__actions">
          <button className="btn" onClick={onCancel} autoFocus>
            Vazgec
          </button>
          <button className="btn btn--danger" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
});
