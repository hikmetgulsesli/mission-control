import { useState, useEffect } from "react";
import type { Task } from "../lib/types";
import { api } from "../lib/api";
import { usePolling } from "../hooks/usePolling";
import { TaskBoard } from "../components/TaskBoard";
import { TaskDetailModal } from "../components/TaskDetailModal";

export function Tasks() {
  const [agents, setAgents] = useState<any[]>([]);
  const [selected, setSelected] = useState<Task | null>(null);
  const [showModal, setShowModal] = useState(false);
  const { data: tasks, error, loading, refresh } = usePolling<Task[]>(async () => {
    const data = await api.tasks();
    if (!Array.isArray(data)) throw new Error("Invalid tasks response");
    return data.map((task: any) => {
      if (task === null || typeof task !== "object" || Array.isArray(task)) {
        throw new Error("Invalid task record");
      }
      const images = typeof task.images === "string" ? JSON.parse(task.images) : (task.images ?? []);
      if (!Array.isArray(images) || !images.every(image => typeof image === "string")) {
        throw new Error("Invalid task images");
      }
      return { ...task, images };
    });
  }, 10000);

  useEffect(() => {
    let active = true;
    api.agents().then(data => { if (active) setAgents(data); }).catch(() => {});
    return () => { active = false; };
  }, []);

  if (loading) return <div className="page-loading">Loading tasks...</div>;

  return (
    <div className="tasks-page">
      <div className="tasks-page__header">
        <h2 className="glitch" data-text="TASKS">TASKS</h2>
        {tasks !== null && (
          <div className="tasks-page__stats">
            <span className="stat-badge">{tasks.length} total</span>
            <span className="stat-badge">{tasks.filter(t => t.status === "in_progress").length} active</span>
          </div>
        )}
        <button className="btn btn--primary" onClick={() => { setSelected(null); setShowModal(true); }}>
          + NEW TASK
        </button>
      </div>

      {error !== null && (
        <div role="status">
          <p>{tasks === null ? "Tasks unavailable." : "Task refresh failed. The last loaded data may be outdated."}</p>
          <button className="btn" onClick={refresh}>Retry</button>
        </div>
      )}

      {tasks !== null && (
        <TaskBoard
          tasks={tasks}
          onRefresh={refresh}
          onSelect={(task) => { setSelected(task); setShowModal(true); }}
        />
      )}

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
