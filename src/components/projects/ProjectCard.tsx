import React from "react";

interface Project {
  id: string;
  name: string;
  emoji: string;
  type?: "web" | "mobile";
  description: string;
  ports: { frontend?: number; backend?: number };
  domain: string;
  repo: string;
  stack: string[];
  service: string;
  serviceStatus?: string;
  createdBy: string;
  workflowRunId?: string;
  runNumber?: number;
  latestRunNumber?: number;
  setfarmRunIds?: string[];
  createdAt: string;
  completedAt?: string;
  status?: string;
  stories?: { total: number; done: number };
  pr?: string;
  features: string[];
  tasks: string[];
  prd?: string;
  github?: string;
  category?: string;
  checklist?: any[];
  buildStartedAt?: string;
  buildCompletedAt?: string;
}

export interface ProjectCardProps {
  project: Project;
  selected: boolean;
  toggling: boolean;
  onSelect: () => void;
  onToggle: (e: React.MouseEvent) => void;
  onExport: () => void;
  onDelete: (e: React.MouseEvent) => void;
}

export const ProjectCard = React.memo(function ProjectCard({
  project: p,
  selected,
  toggling,
  onSelect,
  onToggle,
  onExport,
  onDelete,
}: ProjectCardProps) {
  return (
    <div
      className={`project-card ${selected ? "project-card--selected" : ""} ${p.status === "building" ? "project-card--building" : p.status === "failed" ? "project-card--failed" : ""} ${p.type === "mobile" ? "project-card--mobile" : `project-card--${p.serviceStatus === "active" ? "online" : "offline"}`}`}
      onClick={onSelect}
    >
      <div className="project-card__header">
        <span className="project-card__emoji">{p.emoji}</span>
        {(p.latestRunNumber || p.runNumber) ? (
          <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--neon-cyan, #0ff)", background: "rgba(0,255,255,0.12)", border: "1px solid rgba(0,255,255,0.3)", padding: "1px 7px", borderRadius: "3px", marginRight: "8px", fontFamily: "var(--font)", letterSpacing: "0.5px" }}>#{p.latestRunNumber || p.runNumber}</span>
        ) : null}
        <span className="project-card__name">{p.name}</span>
        {p.type === "mobile" ? (
          <span className="project-card__status project-card__status--mobile">MOBILE</span>
        ) : p.status === "building" ? (
          <span className="project-card__status project-card__status--building">BUILDING</span>
        ) : (
          <button
            className={"project-card__toggle " + (p.serviceStatus === "active" ? "project-card__toggle--on" : "project-card__toggle--off")}
            onClick={onToggle}
            disabled={toggling || p.id === "mission-control"}
            title={p.serviceStatus === "active" ? "Durdur" : "Baslat"}
          >
            <span className="project-card__toggle-knob" />
            <span className="project-card__toggle-label">
              {toggling ? "..." : p.serviceStatus === "active" ? "ON" : "OFF"}
            </span>
          </button>
        )}
      </div>

      <p className="project-card__desc" title={p.description}>{p.description}</p>

      <div className="project-card__meta">
        {p.type !== "mobile" && (
          <div className="project-card__meta-row">
            <span className="project-card__label">PORT</span>
            <span className="project-card__value">
              {p.ports.frontend}{p.ports.backend ? ` / ${p.ports.backend}` : ""}
            </span>
          </div>
        )}
        {p.type !== "mobile" && p.domain && (
          <div className="project-card__meta-row">
            <span className="project-card__label">DOMAIN</span>
            <a className="project-card__link" href={`https://${p.domain}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
              {p.domain}
            </a>
          </div>
        )}
        {p.type === "mobile" && p.repo && (
          <div className="project-card__meta-row">
            <span className="project-card__label">REPO</span>
            <span className="project-card__value">{p.repo.split("/").pop()}</span>
          </div>
        )}
        <div className="project-card__meta-row">
          <span className="project-card__label">STACK</span>
          <div className="project-card__tags">
            {(p.stack || []).map((s) => <span key={s} className="project-card__tag">{s}</span>)}
          </div>
        </div>
        {p.github && (
          <div className="project-card__meta-row">
            <span className="project-card__label">GITHUB</span>
            <a className="project-card__link" href={p.github} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
              {p.github.replace("https://github.com/", "")}
            </a>
          </div>
        )}
        {p.stories && p.stories.total > 0 && (
          <div className="project-card__meta-row">
            <span className="project-card__label">STORIES</span>
            <span className="project-card__value">{p.stories.done}/{p.stories.total}</span>
          </div>
        )}

        {(p.createdAt || p.completedAt) && (
          <div className="project-card__meta-row">
            <span className="project-card__label">TARIH</span>
            <span className="project-card__value project-card__dates">
              {p.createdAt && <span>{p.createdAt.slice(0, 10)}</span>}
              {p.createdAt && p.completedAt && <span> → </span>}
              {p.completedAt && <span>{p.completedAt.slice(0, 10)}</span>}
            </span>
          </div>
        )}
      </div>

      {/* Checklist progress mini */}
      {p.checklist && p.checklist.length > 0 && (
        <div className="project-card__checklist-mini">
          <div className="project-card__checklist-bar">
            <div className="project-card__checklist-fill" style={{
              width: `${Math.round((p.checklist.filter((c: any) => c.completed).length / p.checklist.length) * 100)}%`
            }} />
          </div>
          <span className="project-card__checklist-text">
            {p.checklist.filter((c: any) => c.completed).length}/{p.checklist.length}
          </span>
        </div>
      )}

      {/* Card actions */}
      <div className="project-card__actions" onClick={(e) => e.stopPropagation()}>
        <button className="btn btn--tiny" onClick={() => onExport()} title="Export JSON">EXPORT</button>
        {p.id !== "mission-control" && (
          <button className="btn btn--tiny btn--danger" onClick={onDelete} title="Projeyi sil">SIL</button>
        )}
      </div>
    </div>
  );
});
