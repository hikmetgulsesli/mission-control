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
        <h3>Yeni Proje Olustur</h3>
        <label>
          Proje Adi
          <input type="text" value={form.name} onChange={(e) => onFormChange(f => ({ ...f, name: e.target.value }))} placeholder="ornek-proje" autoFocus />
        </label>
        <label>
          Aciklama
          <textarea value={form.description} onChange={(e) => onFormChange(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Proje aciklamasi..." />
        </label>
        <label>
          Tur
          <select value={form.type} onChange={(e) => onFormChange(f => ({ ...f, type: e.target.value }))}>
            <option value="web">Web Uygulamasi</option>
            <option value="mobile">Mobil Uygulama</option>
          </select>
        </label>
        <label>
          Emoji
          <input type="text" value={form.emoji} onChange={(e) => onFormChange(f => ({ ...f, emoji: e.target.value }))} placeholder={"\u{1F4E6}"} maxLength={4} />
        </label>
        <div className="modal__actions">
          <button type="button" className="btn" onClick={onClose}>Vazgec</button>
          <button type="submit" className="btn btn--primary" disabled={loading || !form.name.trim()}>
            {loading ? "Olusturuluyor..." : "Olustur"}
          </button>
        </div>
      </form>
    </div>
  );
});
