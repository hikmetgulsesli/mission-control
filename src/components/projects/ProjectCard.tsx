import React from "react";
import { normalizeVisibleVisualStatus } from "../../lib/status";

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
  stories?: { total: number; done?: number; completed?: number; verified?: number; failed?: number; skipped?: number };
  pr?: string;
  features: string[];
  tasks: string[];
  prd?: string;
  github?: string;
  category?: string;
  checklist?: any[];
  buildStartedAt?: string;
  buildCompletedAt?: string;
  supervisor?: {
    available: boolean;
    status: string;
    openBlockers: number;
    warnings: number;
    pendingInterventions: number;
    checklistItems: number;
    checklistPassed: number;
    visual: {
      status: "pass" | "fail" | "skipped" | "missing";
      issueCount: number;
      controlsChecked: number;
      routesChecked: string[];
    };
  };
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
  const isSetfarmRun = p.category === "setfarm" || p.createdBy === "setfarm-run" || p.createdBy === "setfarm-workflow" || Boolean(p.latestRunNumber || p.workflowRunId);
  const isServiceProject = !isSetfarmRun && p.type !== "mobile" && Boolean(p.service || p.ports?.frontend || p.ports?.backend);
  const isLocalSetfarmProject = isSetfarmRun && p.type !== "mobile" && Boolean(p.repo);
  const runStatus = (p.status || p.serviceStatus || "unknown").toLowerCase();
  const storyDone = p.stories?.verified ?? p.stories?.completed ?? p.stories?.done ?? 0;
  const supervisor = p.supervisor;
  const supervisorStatus = supervisor?.available ? supervisor.status : "missing";
  const visualStatus = normalizeVisibleVisualStatus(supervisor?.visual.status);
  const supervisorTone = supervisorStatus === "passed" || supervisorStatus === "done"
    ? "pass"
    : supervisorStatus === "blocked" || visualStatus === "fail"
      ? "fail"
      : supervisorStatus === "fixing"
        ? "fixing"
        : "muted";
  const displayEmoji = isSetfarmRun
    ? runStatus === "completed"
      ? "✅"
      : runStatus === "failed"
        ? "❌"
        : runStatus === "cancelled" || runStatus === "canceled"
          ? "⏹"
          : runStatus === "building" || runStatus === "running" || runStatus === "pending"
            ? "🏗️"
            : p.emoji
    : p.emoji;

  return (
    <div
      className={`project-card ${selected ? "project-card--selected" : ""} ${p.status === "building" ? "project-card--building" : p.status === "failed" ? "project-card--failed" : ""} ${p.type === "mobile" ? "project-card--mobile" : isSetfarmRun ? `project-card--run-${runStatus}` : `project-card--${p.serviceStatus === "active" ? "online" : "offline"}`}`}
      onClick={onSelect}
    >
      <div className="project-card__header">
        <span className="project-card__emoji">{displayEmoji}</span>
        {(p.latestRunNumber || p.runNumber) ? (
          <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--neon-cyan, #0ff)", background: "rgba(0,255,255,0.12)", border: "1px solid rgba(0,255,255,0.3)", padding: "1px 7px", borderRadius: "3px", marginRight: "8px", fontFamily: "var(--font)", letterSpacing: "0.5px" }}>#{p.latestRunNumber || p.runNumber}</span>
        ) : null}
        <span className="project-card__name">{p.name}</span>
        {isSetfarmRun ? (
          <span className={`project-card__status project-card__status--${runStatus}`}>
            {runStatus.toUpperCase()}
          </span>
        ) : p.type === "mobile" ? (
          <span className="project-card__status project-card__status--mobile">MOBILE</span>
        ) : p.status === "building" ? (
          <span className="project-card__status project-card__status--building">BUILDING</span>
        ) : isServiceProject ? (
          <button
            className={"project-card__toggle " + (p.serviceStatus === "active" ? "project-card__toggle--on" : "project-card__toggle--off")}
            onClick={onToggle}
            disabled={toggling || p.id === "mission-control"}
            title={p.serviceStatus === "active" ? "Stop" : "Start"}
          >
            <span className="project-card__toggle-knob" />
            <span className="project-card__toggle-label">
              {toggling ? "..." : p.serviceStatus === "active" ? "ON" : "OFF"}
            </span>
          </button>
        ) : (
          <span className="project-card__status project-card__status--unknown">LOCAL</span>
        )}
        {isLocalSetfarmProject && (
          <button
            className={"project-card__toggle " + (p.serviceStatus === "active" ? "project-card__toggle--on" : "project-card__toggle--off")}
            onClick={onToggle}
            disabled={toggling}
            title={p.serviceStatus === "active" ? "Stop local app" : "Start local app"}
          >
            <span className="project-card__toggle-knob" />
            <span className="project-card__toggle-label">
              {toggling ? "..." : p.serviceStatus === "active" ? "ON" : "OFF"}
            </span>
          </button>
        )}
      </div>

      <p className="project-card__desc" title={p.description}>{p.description}</p>

      {supervisor?.available && (
        <div className={`project-card__supervisor project-card__supervisor--${supervisorTone}`}>
          <span className="project-card__supervisor-label">SUPERVISOR</span>
          <span className="project-card__supervisor-status">{supervisorStatus.toUpperCase()}</span>
          <span>{supervisor.openBlockers} blockers</span>
          <span>{visualStatus.toUpperCase()} visual</span>
        </div>
      )}

      <div className="project-card__meta">
        {isSetfarmRun && p.repo && (
          <div className="project-card__meta-row">
            <span className="project-card__label">REPO</span>
            <span className="project-card__value">{p.repo.split("/").pop()}</span>
          </div>
        )}
        {p.type !== "mobile" && (p.ports.frontend || p.ports.backend) && (
          <div className="project-card__meta-row">
            <span className="project-card__label">PORT</span>
            {p.ports.frontend ? (
              <a
                className="project-card__link"
                href={`http://127.0.0.1:${p.ports.frontend}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
              >
                {p.ports.frontend}{p.ports.backend ? ` / ${p.ports.backend}` : ""}
              </a>
            ) : (
              <span className="project-card__value">{p.ports.backend}</span>
            )}
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
        {p.type !== "mobile" && !p.domain && p.ports.frontend && (
          <div className="project-card__meta-row">
            <span className="project-card__label">LOCAL</span>
            <a className="project-card__link" href={`http://localhost:${p.ports.frontend}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
              {`localhost:${p.ports.frontend}`}
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
            <span className="project-card__value">{storyDone}/{p.stories.total}</span>
          </div>
        )}

        {(p.createdAt || p.completedAt) && (
          <div className="project-card__meta-row">
            <span className="project-card__label">DATE</span>
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
          <button className="btn btn--tiny btn--danger" onClick={onDelete} title="Delete project">DELETE</button>
        )}
      </div>
    </div>
  );
});
