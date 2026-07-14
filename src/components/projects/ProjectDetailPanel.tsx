import React from "react";
import { ProjectChecklist } from "../ProjectChecklist";
import { OperationalEvidenceLoader } from "../run-detail/OperationalEvidence";
import { projectRuntimeObservation } from "../../lib/project-health";
import { normalizeVisibleVisualStatus } from "../../lib/status";

interface Project {
  id: string;
  name: string;
  emoji: string;
  type?: "web" | "mobile";
  description: string;
  ports: { frontend?: number; backend?: number };
  domain: string;
  deployUrl?: string;
  repo: string;
  stack: string[];
  service: string;
  serviceStatus?: string;
  observedServiceStatus?: string;
  observedServiceCheckedAt?: string;
  observedServiceReasonCode?: string;
  createdBy: string;
  productCompilerProtocol?: string;
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
  supervisor?: {
    available: boolean;
    status: string;
    scope?: string;
    provider?: string;
    fallbackProviders?: string[];
    supervisorSessionId?: string;
    workdir: string | null;
    stateRoot: string | null;
    updatedAt?: string;
    openBlockers: number;
    warnings: number;
    resolved: number;
    pendingInterventions: number;
    checklistItems: number;
    checklistPassed: number;
    visual: {
      status: "pass" | "fail" | "skipped" | "missing";
      issueCount: number;
      controlsChecked: number;
      routesChecked: string[];
      screenshots: string[];
      reportPath?: string;
    };
    artifacts: Record<string, string | undefined>;
    interventionText?: string;
    visualReportText?: string;
    source?: string;
  };
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
  const supervisor = sel.supervisor;
  const visualStatus = normalizeVisibleVisualStatus(supervisor?.visual.status);
  const isCanonicalV3 = sel.productCompilerProtocol === "v3"
    && sel.createdBy === "setfarm-v3-terminal-projector";
  const observedHealth = projectRuntimeObservation(sel);

  return (
    <div className="project-detail">
      <div className="project-detail__header">
        <span className="project-detail__emoji">{sel.emoji}</span>
        <h3 className="project-detail__title">{sel.name}</h3>
        <button className="project-detail__close" onClick={onClose}>{"\u2715"}</button>
      </div>

      <div className="project-detail__grid">
        <div className="project-detail__section">
          <h4>General Info</h4>
          <table className="project-detail__table">
            <tbody>
              {isCanonicalV3 ? (
                <>
                  <tr><td>Receipt status</td><td>{String(sel.serviceStatus || sel.status || "unknown").toUpperCase()} (immutable)</td></tr>
                  <tr>
                    <td>Observed live health</td>
                    <td>
                      {observedHealth.label}
                      {observedHealth.checkedAt ? ` · ${new Date(observedHealth.checkedAt).toLocaleString("en-US")}` : " · no observation"}
                      {sel.observedServiceReasonCode ? ` · ${sel.observedServiceReasonCode}` : ""}
                    </td>
                  </tr>
                </>
              ) : (
                <tr><td>Status</td><td>{sel.serviceStatus === "active" ? "Running" : "Stopped"}</td></tr>
              )}
              <tr><td>Service</td><td><code>{sel.service}</code></td></tr>
              {sel.type !== "mobile" && <tr><td>Port</td><td>{sel.ports.frontend}{sel.ports.backend ? ` (frontend) / ${sel.ports.backend} (backend)` : ""}</td></tr>}
              {sel.type !== "mobile" && sel.domain && <tr><td>Domain</td><td><a href={`https://${sel.domain}`} target="_blank" rel="noopener noreferrer">{sel.domain}</a></td></tr>}
              {sel.type !== "mobile" && sel.deployUrl && <tr><td>Deploy URL</td><td><a href={sel.deployUrl} target="_blank" rel="noopener noreferrer">{sel.deployUrl}</a></td></tr>}
              {sel.type === "mobile" && <tr><td>Platform</td><td>React Native / Expo</td></tr>}
              <tr><td>Repo</td><td><code>{sel.repo}</code></td></tr>
              {sel.github && <tr><td>GitHub</td><td><a href={sel.github} target="_blank" rel="noopener noreferrer">{sel.github.replace("https://github.com/", "")}</a></td></tr>}
              <tr><td>Created By</td><td>{sel.createdBy}</td></tr>
              <tr><td>Date</td><td>{sel.createdAt}{sel.completedAt ? ` -> ${sel.completedAt.slice(0, 10)}` : ""}</td></tr>
              <tr><td>Duration</td><td>{formatDuration(sel.createdAt, sel.completedAt, sel.buildStartedAt, sel.buildCompletedAt) ?? "-"}{!sel.completedAt && !sel.buildCompletedAt ? " (in progress)" : ""}</td></tr>
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
            <h4>Product Definition (PRD)</h4>
            <p className="project-detail__prd">{sel.prd}</p>
          </div>
        )}

        {sel.workflowRunId && (
          <div className="project-detail__section project-detail__section--wide project-detail__section--operational">
            <OperationalEvidenceLoader runId={sel.workflowRunId} />
          </div>
        )}

        {supervisor && (
          <div className="project-detail__section project-detail__section--wide">
            <h4>Supervisor</h4>
            <p className="project-detail__prd">Advisory artifact only. Canonical run authority is shown in Operational Evidence.</p>
            {supervisor.available ? (
              <>
                <div className="project-detail__supervisor-grid">
                  <div>
                    <span className="project-detail__supervisor-label">Status</span>
                    <strong className={`project-detail__supervisor-status project-detail__supervisor-status--${supervisor.status}`}>{supervisor.status}</strong>
                  </div>
                  <div>
                    <span className="project-detail__supervisor-label">Blockers</span>
                    <strong>{supervisor.openBlockers}</strong>
                  </div>
                  <div>
                    <span className="project-detail__supervisor-label">Warnings</span>
                    <strong>{supervisor.warnings}</strong>
                  </div>
                  <div>
                    <span className="project-detail__supervisor-label">Visual QA</span>
                    <strong>{visualStatus} / {supervisor.visual.issueCount} issues</strong>
                  </div>
                  <div>
                    <span className="project-detail__supervisor-label">Checklist</span>
                    <strong>{supervisor.checklistPassed}/{supervisor.checklistItems}</strong>
                  </div>
                  <div>
                    <span className="project-detail__supervisor-label">Interventions</span>
                    <strong>{supervisor.pendingInterventions}</strong>
                  </div>
                </div>
                <table className="project-detail__table project-detail__supervisor-table">
                  <tbody>
                    <tr><td>Source</td><td>{supervisor.source || "-"}</td></tr>
                    <tr><td>Scope</td><td>{supervisor.scope || "-"}</td></tr>
                    <tr><td>Provider</td><td>{supervisor.provider || "-"}</td></tr>
                    <tr><td>Workdir</td><td><code>{supervisor.workdir || "-"}</code></td></tr>
                    <tr><td>State</td><td><code>{supervisor.stateRoot || "-"}</code></td></tr>
                    {supervisor.visual.reportPath && <tr><td>Visual report</td><td><code>{supervisor.visual.reportPath}</code></td></tr>}
                    {supervisor.updatedAt && <tr><td>Updated</td><td>{supervisor.updatedAt}</td></tr>}
                  </tbody>
                </table>
                {(supervisor.interventionText || supervisor.visualReportText) && (
                  <div className="project-detail__supervisor-notes">
                    {supervisor.interventionText && <pre>{supervisor.interventionText}</pre>}
                    {supervisor.visualReportText && <pre>{supervisor.visualReportText}</pre>}
                  </div>
                )}
              </>
            ) : (
              <p className="project-detail__prd">No supervisor ledger exists for this run yet.</p>
            )}
          </div>
        )}

        <div className="project-detail__section">
          <h4>Features</h4>
          <ul className="project-detail__list">
            {sel.features.map((f, i) => <li key={i}>{f}</li>)}
          </ul>
        </div>

        {sel.tasks.length > 0 && (
          <div className="project-detail__section">
            <h4>Tasks / User Stories</h4>
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
