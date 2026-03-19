import React from "react";
import { ProjectChecklist } from "../ProjectChecklist";

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

export interface ProjectDetailPanelProps {
  project: Project;
  onClose: () => void;
  onChecklistUpdate: (projectId: string, checklist: any[]) => void;
  formatDuration: (createdAt?: string, completedAt?: string, buildStartedAt?: string, buildCompletedAt?: string) => string | null;
}

export const ProjectDetailPanel = React.memo(function ProjectDetailPanel({
  project: sel,
  onClose,
  onChecklistUpdate,
  formatDuration,
}: ProjectDetailPanelProps) {
  return (
    <div className="project-detail">
      <div className="project-detail__header">
        <span className="project-detail__emoji">{sel.emoji}</span>
        <h3 className="project-detail__title">{sel.name}</h3>
        <button className="project-detail__close" onClick={onClose}>{"\u2715"}</button>
      </div>

      <div className="project-detail__grid">
        <div className="project-detail__section">
          <h4>Genel Bilgiler</h4>
          <table className="project-detail__table">
            <tbody>
              <tr><td>Durum</td><td>{sel.serviceStatus === "active" ? "Calisiyor" : "Durmus"}</td></tr>
              <tr><td>Servis</td><td><code>{sel.service}</code></td></tr>
              {sel.type !== "mobile" && <tr><td>Port</td><td>{sel.ports.frontend}{sel.ports.backend ? ` (frontend) / ${sel.ports.backend} (backend)` : ""}</td></tr>}
              {sel.type !== "mobile" && sel.domain && <tr><td>Domain</td><td><a href={`https://${sel.domain}`} target="_blank" rel="noopener noreferrer">{sel.domain}</a></td></tr>}
              {sel.type === "mobile" && <tr><td>Platform</td><td>React Native / Expo</td></tr>}
              <tr><td>Repo</td><td><code>{sel.repo}</code></td></tr>
              {sel.github && <tr><td>GitHub</td><td><a href={sel.github} target="_blank" rel="noopener noreferrer">{sel.github.replace("https://github.com/", "")}</a></td></tr>}
              <tr><td>Olusturan</td><td>{sel.createdBy}</td></tr>
              <tr><td>Tarih</td><td>{sel.createdAt}{sel.completedAt ? ` → ${sel.completedAt.slice(0, 10)}` : ""}</td></tr>
              <tr><td>Sure</td><td>{formatDuration(sel.createdAt, sel.completedAt, sel.buildStartedAt, sel.buildCompletedAt) ?? "-"}{!sel.completedAt && !sel.buildCompletedAt ? " (devam ediyor)" : ""}</td></tr>
              {sel.workflowRunId && <tr><td>Workflow Run</td><td><code>{sel.workflowRunId}</code></td></tr>}
              {sel.pr && <tr><td>Pull Request</td><td><a href={sel.pr} target="_blank" rel="noopener noreferrer">PR #1</a></td></tr>}
            </tbody>
          </table>
        </div>

        {/* Project Checklist */}
        {sel.checklist && (
          <div className="project-detail__section">
            <ProjectChecklist
              projectId={sel.id}
              checklist={sel.checklist}
              onUpdate={(updated) => onChecklistUpdate(sel.id, updated)}
            />
          </div>
        )}

        {sel.prd && (
          <div className="project-detail__section">
            <h4>Urun Tanimi (PRD)</h4>
            <p className="project-detail__prd">{sel.prd}</p>
          </div>
        )}

        <div className="project-detail__section">
          <h4>Ozellikler</h4>
          <ul className="project-detail__list">
            {sel.features.map((f, i) => <li key={i}>{f}</li>)}
          </ul>
        </div>

        {sel.tasks.length > 0 && (
          <div className="project-detail__section">
            <h4>Gorevler / User Stories</h4>
            <ul className="project-detail__list project-detail__list--tasks">
              {sel.tasks.map((t, i) => (
                <li key={i}>
                  <span className="project-detail__task-check">{"\u2713"}</span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
});
