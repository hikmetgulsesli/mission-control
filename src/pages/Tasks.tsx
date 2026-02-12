import { useState, useEffect, useCallback } from "react";
import type { Task } from "../lib/types";
import { api } from "../lib/api";
import { TaskBoard } from "../components/TaskBoard";
import { TaskDetailModal } from "../components/TaskDetailModal";

export function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [selected, setSelected] = useState<Task | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api.tasks();
      setTasks(data.map((t: any) => ({
        ...t,
        images: typeof t.images === "string" ? JSON.parse(t.images) : (t.images || []),
      })));
    } catch (e) {
      console.error("Failed to load tasks:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    api.agents().then(setAgents).catch(() => {});
    const interval = setInterval(refresh, 10000);
    return () => clearInterval(interval);
  }, [refresh]);

  if (loading) return <div className="page-loading">Loading tasks...</div>;

  return (
    <div className="tasks-page">
      <div className="tasks-page__header">
        <h2 className="glitch" data-text="TASKS">TASKS</h2>
        <div className="tasks-page__stats">
          <span className="stat-badge">{tasks.length} total</span>
          <span className="stat-badge">{tasks.filter(t => t.status === "in_progress").length} active</span>
        </div>
        <button className="btn btn--primary" onClick={() => { setSelected(null); setShowModal(true); }}>
          + NEW TASK
        </button>
      </div>

      <TaskBoard
        tasks={tasks}
        onRefresh={refresh}
        onSelect={(task) => { setSelected(task); setShowModal(true); }}
      />

      {showModal && (
        <TaskDetailModal
          task={selected}
          agents={agents}
          onClose={() => setShowModal(false)}
          onSaved={refresh}
        />
      )}
    </div>
  );
}
