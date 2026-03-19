import React, { useState } from "react";

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
          {steps.map((step, i) => (
            <div key={step.id} className="rd-pipe-row">
              {i > 0 && <div className="rd-pipe-connector" />}
              <div
                className={`rd-pipe-step rd-pipe-step--${step.status} ${selectedStep === step.id ? "rd-pipe-step--selected" : ""}`}
                onClick={() => setSelectedStep(selectedStep === step.id ? null : step.id)}
              >
                <div className="rd-pipe-icon">
                  {step.status === "done" ? "\u2713" : step.status === "pending" || step.status === "running" ? "\u25B6" : step.status === "failed" ? "\u2717" : "\u25CB"}
                </div>
                <div className="rd-pipe-info">
                  <div className="rd-pipe-name">{step.id}</div>
                  <div className="rd-pipe-agent">{step.agent}</div>
                </div>
                <div className="rd-pipe-meta">
                  <span className={`rd-pipe-badge rd-pipe-badge--${step.status}`}>{step.status}</span>
                  {step.retryCount > 0 && <span className="rd-pipe-retry">retry: {step.retryCount}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Step output panel */}
      {stepDetail && (
        <div className="rd-step-output">
          <h3 className="rd-section-title">
            {stepDetail.id.toUpperCase()} — {stepDetail.agent}
            <span className={`rd-pipe-badge rd-pipe-badge--${stepDetail.status}`}>{stepDetail.status}</span>
          </h3>
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
