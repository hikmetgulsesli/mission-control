import React, { useState } from "react";
import { normalizeVisibleWorkflowStatus } from "../../lib/status";

interface StepDetail {
  id: string;
  agent: string;
  status: string;
  output: string | null;
  retryCount: number;
  updatedAt?: string;
  createdAt?: string;
}

export interface StepTimelineProps {
  steps: StepDetail[];
  progressLog?: string;
}

export const StepTimeline = React.memo(function StepTimeline({ steps, progressLog }: StepTimelineProps) {
  const [selectedStep, setSelectedStep] = useState<string | null>(null);
  const stepDetail = steps.find(s => s.id === selectedStep);

  return (
    <div className="rd-overview">
      {/* Pipeline visualization */}
      <div className="rd-pipeline">
        <h3 className="rd-section-title">PIPELINE</h3>
        <div className="rd-pipeline-steps">
          {steps.map((step, i) => {
            const stepStatus = normalizeVisibleWorkflowStatus(step.status);
            return (
              <div key={step.id} className="rd-pipe-row">
                {i > 0 && <div className="rd-pipe-connector" />}
                <div
                  className={`rd-pipe-step rd-pipe-step--${stepStatus} ${selectedStep === step.id ? "rd-pipe-step--selected" : ""}`}
                  onClick={() => setSelectedStep(selectedStep === step.id ? null : step.id)}
                >
                  <div className="rd-pipe-icon">
                    {stepStatus === "done" ? "\u2713" : stepStatus === "pending" || stepStatus === "running" ? "\u25B6" : stepStatus === "failed" ? "\u2717" : "\u25CB"}
                  </div>
                  <div className="rd-pipe-info">
                    <div className="rd-pipe-name">{step.id}</div>
                    <div className="rd-pipe-agent">{step.agent}</div>
                  </div>
                  <div className="rd-pipe-meta">
                    <span className={`rd-pipe-badge rd-pipe-badge--${stepStatus}`}>{stepStatus}</span>
                    {step.retryCount > 0 && <span className="rd-pipe-retry">retry: {step.retryCount}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Step output panel */}
      {stepDetail && (
        <div className="rd-step-output">
          {(() => {
            const stepStatus = normalizeVisibleWorkflowStatus(stepDetail.status);
            return (
          <h3 className="rd-section-title">
            {stepDetail.id.toUpperCase()} — {stepDetail.agent}
            <span className={`rd-pipe-badge rd-pipe-badge--${stepStatus}`}>{stepStatus}</span>
          </h3>
            );
          })()}
          {stepDetail.output ? (
            <pre className="rd-output-pre">{stepDetail.output}</pre>
          ) : (
            <div className="rd-empty">No output yet</div>
          )}
        </div>
      )}

      {/* Progress log */}
      {progressLog && (
        <div className="rd-progress-section">
          <h3 className="rd-section-title">PROGRESS LOG</h3>
          <pre className="rd-output-pre rd-output-pre--compact">{progressLog}</pre>
        </div>
      )}
    </div>
  );
});
