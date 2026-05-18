import React from "react";

export interface CreateProjectModalProps {
  open: boolean;
  form: { name: string; description: string; emoji: string; category: string; type: string };
  loading: boolean;
  onFormChange: (updater: (prev: { name: string; description: string; emoji: string; category: string; type: string }) => { name: string; description: string; emoji: string; category: string; type: string }) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}

export const CreateProjectModal = React.memo(function CreateProjectModal({
  open,
  form,
  loading,
  onFormChange,
  onSubmit,
  onClose,
}: CreateProjectModalProps) {
  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={onSubmit}>
        <h3>Create New Project</h3>
        <label>
          Project Name
          <input type="text" value={form.name} onChange={(e) => onFormChange(f => ({ ...f, name: e.target.value }))} placeholder="example-project" autoFocus />
        </label>
        <label>
          Description
          <textarea value={form.description} onChange={(e) => onFormChange(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Project description..." />
        </label>
        <label>
          Type
          <select value={form.type} onChange={(e) => onFormChange(f => ({ ...f, type: e.target.value }))}>
            <option value="web">Web Application</option>
            <option value="mobile">Mobile Application</option>
          </select>
        </label>
        <label>
          Emoji
          <input type="text" value={form.emoji} onChange={(e) => onFormChange(f => ({ ...f, emoji: e.target.value }))} placeholder={"\u{1F4E6}"} maxLength={4} />
        </label>
        <div className="modal__actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn--primary" disabled={loading || !form.name.trim()}>
            {loading ? "Creating..." : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
});
