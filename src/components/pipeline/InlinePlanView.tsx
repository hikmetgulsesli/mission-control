import React, { useState, useEffect, useCallback } from "react";
import { StoryChecklist } from "../StoryChecklist";
import { api } from "../../lib/api";

interface PlanData {
  prd: string;
  stories: any[];
  rawOutput: string;
  projectMemory?: string;
}

export interface InlinePlanViewProps {
  runId: string;
  onRetry?: (storyId: string) => void;
}

export const InlinePlanView = React.memo(function InlinePlanView({ runId, onRetry }: InlinePlanViewProps) {
  const [tab, setTab] = useState<"prd" | "design" | "stories" | "raw" | "memory">("prd");
  const [planData, setPlanData] = useState<PlanData | null>(null);
  const [designData, setDesignData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(() => {
    Promise.all([
      api.runPlan(runId),
      api.runDesign(runId).catch(() => null),
    ]).then(([plan, design]) => {
      setPlanData(plan);
      if (design) setDesignData(design);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [runId]);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 10_000);
    return () => clearInterval(id);
  }, [fetchData]);

  if (loading) return <div className="af-inline-plan__loading">Loading plan data...</div>;
  if (!planData || (!planData.prd && planData.stories.length === 0)) {
    return <StoryChecklist runId={runId} onRetry={onRetry} />;
  }

  const storyCount = planData.stories.length;

  return (
    <div className="af-inline-plan">
      <div className="af-inline-plan__tabs">
        <button className={`af-inline-plan__tab ${tab === "prd" ? "af-inline-plan__tab--active" : ""}`} onClick={() => setTab("prd")}>PRD</button>
        {designData && designData.screens && designData.screens.length > 0 && (
          <button className={`af-inline-plan__tab ${tab === "design" ? "af-inline-plan__tab--active" : ""}`} onClick={() => setTab("design")}>DESIGN ({designData.screens.length})</button>
        )}
        <button className={`af-inline-plan__tab ${tab === "stories" ? "af-inline-plan__tab--active" : ""}`} onClick={() => setTab("stories")}>STORIES ({storyCount})</button>
        <button className={`af-inline-plan__tab ${tab === "raw" ? "af-inline-plan__tab--active" : ""}`} onClick={() => setTab("raw")}>RAW</button>
        <button className={`af-inline-plan__tab ${tab === "memory" ? "af-inline-plan__tab--active" : ""}`} onClick={() => setTab("memory")}>MEMORY</button>
      </div>

      <div className="af-inline-plan__content">
        {tab === "prd" && (
          <div className="af-inline-plan__prd">
            {planData.prd.split("\n").map((line, i) => {
              if (line.match(/^#{1,3}\s/)) {
                return <h4 key={i} className="af-inline-plan__heading">{line.replace(/^#+\s*/, "")}</h4>;
              }
              if (line.match(/^[A-Z_]+:/)) {
                const [key, ...val] = line.split(":");
                return (
                  <div key={i} className="af-inline-plan__field">
                    <span className="af-inline-plan__key">{key}:</span>
                    <span className="af-inline-plan__val">{val.join(":").trim()}</span>
                  </div>
                );
              }
              if (line.trim() === "") return <br key={i} />;
              return <p key={i} className="af-inline-plan__text">{line}</p>;
            })}
          </div>
        )}

        {tab === "design" && designData && (
          <div className="af-inline-plan__design">
            {designData.designSystem && (
              <div className="af-design-system">
                <h4 className="af-design-system__title">Design System</h4>
                <div className="af-design-system__tokens">
                  {Object.entries(designData.designSystem).map(([key, value]: [string, any]) => (
                    <span key={key} className="af-design-token">
                      <span className="af-design-token__key">{key}</span>
                      <span className="af-design-token__val">{value}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
            {designData.designNotes && (
              <p className="af-design-notes">{designData.designNotes}</p>
            )}
            <div className="af-design-grid">
              {designData.screens.map((screen: any) => (
                <div key={screen.screenId} className="af-design-card">
                  <div className="af-design-card__header">
                    <span className="af-design-card__name">{screen.name || screen.title}</span>
                    <span className="af-design-card__type">{screen.type || screen.deviceType}</span>
                  </div>
                  {screen.description && <p className="af-design-card__desc">{screen.description}</p>}
                  {screen.screenshotUrl ? (
                    <div className="af-design-card__img-wrap">
                      <img
                        src={screen.screenshotUrl}
                        alt={screen.name || screen.title}
                        className="af-design-card__img"
                        loading="lazy"
                      />
                    </div>
                  ) : (
                    <div className="af-design-card__no-img">No screenshot available</div>
                  )}
                  <div className="af-design-card__actions">
                    {screen.htmlUrl && (
                      <a href={screen.htmlUrl} target="_blank" rel="noopener noreferrer" className="af-design-card__btn">
                        View HTML
                      </a>
                    )}
                    {screen.width && screen.height && (
                      <span className="af-design-card__size">{screen.width}x{screen.height}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "stories" && (
          <StoryChecklist runId={runId} onRetry={onRetry} />
        )}

        {tab === "raw" && (
          <pre className="af-inline-plan__raw">{planData.rawOutput}</pre>
        )}

        {tab === "memory" && (
          <pre className="af-inline-plan__raw">{planData.projectMemory || "(no project memory yet)"}</pre>
        )}
      </div>
    </div>
  );
});
