import { api } from '../lib/api';

interface ChecklistItem {
  id: string;
  label: string;
  completed: boolean;
  completedAt?: string;
  link?: string;
  notes?: string;
}

export function ProjectChecklist({ projectId, checklist, onUpdate }: {
  projectId: string;
  checklist: ChecklistItem[];
  onUpdate: (updated: ChecklistItem[]) => void;
}) {
  const completed = checklist.filter(c => c.completed).length;
  const total = checklist.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  const handleToggle = async (itemId: string, currentState: boolean) => {
    try {
      const result = await api.updateProject(projectId, {
        checklistToggle: { itemId, completed: !currentState },
      });
      if (result.checklist) onUpdate(result.checklist);
    } catch (err) {
      console.error('Checklist toggle failed:', err);
    }
  };

  return (
    <div className="project-checklist">
      <div className="project-checklist__header">
        <span className="project-checklist__title">CHECKLIST</span>
        <span className="project-checklist__progress-text">{completed}/{total} ({pct}%)</span>
      </div>
      <div className="project-checklist__bar">
        <div className="project-checklist__bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="project-checklist__items">
        {checklist.map((item) => (
          <div
            key={item.id}
            className={`project-checklist__item ${item.completed ? 'project-checklist__item--done' : ''}`}
            onClick={() => handleToggle(item.id, item.completed)}
          >
            <span className="project-checklist__check">
              {item.completed ? '\u2713' : '\u25CB'}
            </span>
            <span className="project-checklist__label">{item.label}</span>
            {item.link && (
              <a
                className="project-checklist__link"
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
              >
                {"\u2197"}
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
