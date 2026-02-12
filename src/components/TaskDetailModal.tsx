import { useState, useEffect } from "react";
import type { Task } from "../lib/types";
import { api } from "../lib/api";

const STATUSES: Task["status"][] = ["backlog", "todo", "in_progress", "review", "done"];
const PRIORITIES: Task["priority"][] = ["low", "medium", "high", "critical"];

interface Props {
  task: Task | null;
  agents: { id: string; name: string; identityEmoji: string }[];
  onClose: () => void;
  onSaved: () => void;
}

export function TaskDetailModal({ task, agents, onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    assigned_agent: "",
    priority: "medium" as Task["priority"],
    status: "backlog" as Task["status"],
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (task) {
      setForm({
        title: task.title,
        description: task.description,
        assigned_agent: task.assigned_agent,
        priority: task.priority,
        status: task.status,
      });
    } else {
      setForm({ title: "", description: "", assigned_agent: "", priority: "medium", status: "backlog" });
    }
  }, [task]);

  const isNew = !task;

  const handleSave = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      if (isNew) {
        await api.createTask(form);
      } else {
        await api.updateTask(task!.id, { ...form, images: task!.images });
      }
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!task) return;
    setDeleting(true);
    try {
      await api.deleteTask(task.id);
      onSaved();
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal task-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="task-detail-modal__header">
          <h3>{isNew ? "New Task" : "Edit Task"}</h3>
          <button className="agent-edit-modal__close" onClick={onClose}>X</button>
        </div>

        <label>
          TITLE
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Task title..."
          />
        </label>

        <label>
          DESCRIPTION
          <textarea
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Task description..."
          />
        </label>

        <label>
          ASSIGNED AGENT
          <select
            value={form.assigned_agent}
            onChange={(e) => setForm({ ...form, assigned_agent: e.target.value })}
          >
            <option value="">Unassigned</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.identityEmoji} {a.name}
              </option>
            ))}
          </select>
        </label>

        <div style={{ display: "flex", gap: "12px" }}>
          <label style={{ flex: 1 }}>
            PRIORITY
            <select
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value as Task["priority"] })}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>{p.toUpperCase()}</option>
              ))}
            </select>
          </label>
          <label style={{ flex: 1 }}>
            STATUS
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as Task["status"] })}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s.replace("_", " ").toUpperCase()}</option>
              ))}
            </select>
          </label>
        </div>

        {task && task.images && task.images.length > 0 && (
          <div className="task-detail-modal__images">
            <label>ATTACHMENTS</label>
            <div className="task-detail-modal__thumbs">
              {task.images.map((img, i) => (
                <div key={i} className="task-detail-modal__thumb">
                  <img src={`/uploads/${img}`} alt={img} />
                  <button
                    className="task-detail-modal__thumb-delete"
                    onClick={async () => {
                      await api.deleteTaskImage(task.id, img);
                      onSaved();
                    }}
                    title="Remove"
                  >X</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {task && (
          <div className="task-detail-modal__upload">
            <label>UPLOAD IMAGE</label>
            <input
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = async () => {
                  const base64 = (reader.result as string).split(",")[1];
                  await api.uploadTaskImage(task.id, base64, file.name);
                  onSaved();
                };
                reader.readAsDataURL(file);
                e.target.value = "";
              }}
            />
          </div>
        )}

        <div className="modal__actions">
          {!isNew && (
            <button className="btn" onClick={handleDelete} disabled={deleting} style={{ color: "var(--neon-red)" }}>
              {deleting ? "DELETING..." : "DELETE"}
            </button>
          )}
          <div style={{ flex: 1 }} />
          <button className="btn" onClick={onClose}>CANCEL</button>
          <button className="btn btn--primary" onClick={handleSave} disabled={saving || !form.title.trim()}>
            {saving ? "SAVING..." : isNew ? "CREATE" : "SAVE"}
          </button>
        </div>
      </div>
    </div>
  );
}
