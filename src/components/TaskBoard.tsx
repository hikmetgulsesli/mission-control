import { useState } from "react";
import type { Task } from "../lib/types";
import { api } from "../lib/api";

const COLUMNS: { key: Task["status"]; label: string }[] = [
  { key: "backlog", label: "BACKLOG" },
  { key: "todo", label: "TO DO" },
  { key: "in_progress", label: "IN PROGRESS" },
  { key: "review", label: "REVIEW" },
  { key: "done", label: "DONE" },
];

const PRIORITY_COLORS: Record<string, string> = {
  critical: "var(--neon-red)",
  high: "var(--neon-orange)",
  medium: "var(--neon-cyan)",
  low: "var(--text-dim)",
};

interface Props {
  tasks: Task[];
  onRefresh: () => void;
  onSelect: (task: Task) => void;
}

export function TaskBoard({ tasks, onRefresh, onSelect }: Props) {
  const [moving, setMoving] = useState<string | null>(null);

  const moveTask = async (task: Task, direction: -1 | 1) => {
    const idx = COLUMNS.findIndex((c) => c.key === task.status);
    const next = COLUMNS[idx + direction];
    if (!next) return;
    setMoving(task.id);
    try {
      await api.updateTaskStatus(task.id, next.key);
      onRefresh();
    } finally {
      setMoving(null);
    }
  };

  return (
    <div className="task-board">
      {COLUMNS.map((col) => {
        const colTasks = tasks.filter((t) => t.status === col.key);
        return (
          <div key={col.key} className="task-board__column">
            <div className="task-board__column-header">
              <span className="task-board__column-title">{col.label}</span>
              <span className="task-board__column-count">{colTasks.length}</span>
            </div>
            <div className="task-board__cards">
              {colTasks.map((task) => (
                <div
                  key={task.id}
                  className={`task-card ${moving === task.id ? "task-card--moving" : ""}`}
                  onClick={() => onSelect(task)}
                >
                  <div className="task-card__header">
                    <span
                      className="task-card__priority"
                      style={{ background: PRIORITY_COLORS[task.priority] }}
                    />
                    <span className="task-card__title">{task.title}</span>
                  </div>
                  {task.description && (
                    <div className="task-card__desc">
                      {task.description.slice(0, 80)}
                      {task.description.length > 80 ? "..." : ""}
                    </div>
                  )}
                  <div className="task-card__footer">
                    {task.assigned_agent && (
                      <span className="task-card__agent">{task.assigned_agent}</span>
                    )}
                    {task.images && task.images.length > 0 && (
                      <span className="task-card__images">{task.images.length} img</span>
                    )}
                    <span className="task-card__arrows">
                      {col.key !== "backlog" && (
                        <button
                          className="task-card__arrow"
                          onClick={(e) => { e.stopPropagation(); moveTask(task, -1); }}
                          title="Move left"
                        >
                          ←
                        </button>
                      )}
                      {col.key !== "done" && (
                        <button
                          className="task-card__arrow"
                          onClick={(e) => { e.stopPropagation(); moveTask(task, 1); }}
                          title="Move right"
                        >
                          →
                        </button>
                      )}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
