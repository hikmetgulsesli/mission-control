interface ChecklistItem {
  id: string;
  label: string;
  completed: boolean;
  completedAt?: string;
  link?: string;
  notes?: string;
}

export function ProjectChecklist({ checklist, disabled, onToggle }: {
  checklist: ChecklistItem[];
  disabled: boolean;
  onToggle: (itemId: string, currentState: boolean) => Promise<void>;
}) {
  const completed = checklist.filter(c => c.completed).length;
  const total = checklist.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

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
          >
            <button
              type="button"
              className="project-checklist__toggle"
              disabled={disabled}
              onClick={() => { void onToggle(item.id, item.completed); }}
              style={{
                alignItems: 'center', background: 'none', border: 0, color: 'inherit',
                cursor: disabled ? 'not-allowed' : 'pointer', display: 'flex', flex: 1,
                font: 'inherit', gap: '8px', padding: 0, textAlign: 'left',
              }}
            >
              <span className="project-checklist__check">
                {item.completed ? '\u2713' : '\u25CB'}
              </span>
              <span className="project-checklist__label">{item.label}</span>
            </button>
            {item.link && (
              <a
                className="project-checklist__link"
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
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
