import React, { useState, useEffect, useCallback } from "react";
import { StoryChecklist } from "../StoryChecklist";
import { api } from "../../lib/api";

interface StepDuration {
  stepId: string;
  status: string;
  durationMs: number;
  abandonedCount: number;
}

interface PlanData {
  prd: string;
  stories: any[];
  rawOutput: string;
  projectMemory?: string;
  stepDurations?: StepDuration[];
  storyStats?: Record<string, number>;
}

interface StoryItem {
  id: string;
  title: string;
  status: string;
  priority?: string;
  agent?: string;
}

const STORY_STATUS_BADGES: Record<string, { color: string; label: string }> = {
  done: { color: "#00ff41", label: "DONE" },
  running: { color: "#4488ff", label: "RUNNING" },
  failed: { color: "#ff0040", label: "FAILED" },
  pending: { color: "#555570", label: "PENDING" },
  verified: { color: "#22c55e", label: "VERIFIED" },
  skipped: { color: "#6b7280", label: "SKIPPED" },
  "in-progress": { color: "#4488ff", label: "IN PROGRESS" },
  blocked: { color: "#ff6600", label: "BLOCKED" },
};

function formatDuration(ms: number): string {
  if (ms <= 0) return "-";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

const STATUS_COLORS: Record<string, string> = {
  done: "#00ff41",
  running: "#4488ff",
  failed: "#ff0040",
  pending: "#555570",
  verified: "#22c55e",
  skipped: "#6b7280",
};

export interface InlinePlanViewProps {
  runId: string;
  onRetry?: (storyId: string) => void;
}

export const InlinePlanView = React.memo(function InlinePlanView({ runId, onRetry }: InlinePlanViewProps) {
  const [tab, setTab] = useState<"overview" | "prd" | "design" | "stories" | "raw" | "memory">("overview");
  const [planData, setPlanData] = useState<PlanData | null>(null);
  const [designData, setDesignData] = useState<any>(null);
  const [storyList, setStoryList] = useState<StoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(() => {
    Promise.all([
      api.runPlan(runId),
      api.runDesign(runId).catch(() => null),
      api.runStories(runId).catch(() => []),
    ]).then(([plan, design, stories]) => {
      setPlanData(plan);
      if (design) setDesignData(design);
      if (Array.isArray(stories)) setStoryList(stories);
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
  const prdExcerpt = planData.prd ? planData.prd.slice(0, 500) + (planData.prd.length > 500 ? "..." : "") : "";

  return (
    <div className="af-inline-plan">
      <div className="af-inline-plan__tabs">
        <button className={`af-inline-plan__tab ${tab === "overview" ? "af-inline-plan__tab--active" : ""}`} onClick={() => setTab("overview")}>OVERVIEW</button>
        <button className={`af-inline-plan__tab ${tab === "prd" ? "af-inline-plan__tab--active" : ""}`} onClick={() => setTab("prd")}>PRD</button>
        {designData && designData.screens && designData.screens.length > 0 && (
          <button className={`af-inline-plan__tab ${tab === "design" ? "af-inline-plan__tab--active" : ""}`} onClick={() => setTab("design")}>DESIGN ({designData.screens.length})</button>
        )}
        <button className={`af-inline-plan__tab ${tab === "stories" ? "af-inline-plan__tab--active" : ""}`} onClick={() => setTab("stories")}>STORIES ({storyCount})</button>
        <button className={`af-inline-plan__tab ${tab === "raw" ? "af-inline-plan__tab--active" : ""}`} onClick={() => setTab("raw")}>RAW</button>
        <button className={`af-inline-plan__tab ${tab === "memory" ? "af-inline-plan__tab--active" : ""}`} onClick={() => setTab("memory")}>MEMORY</button>
      </div>

      <div className="af-inline-plan__content">
        {/* OVERVIEW — Plan Drill-Down */}
        {tab === "overview" && (
          <div className="af-plan-overview">
            {/* PRD Excerpt */}
            <div className="af-plan-overview__section">
              <div className="af-plan-overview__section-header">
                <h4 className="af-plan-overview__title">PRD Excerpt</h4>
                {planData.prd && planData.prd.length > 500 && (
                  <button className="af-plan-overview__more" onClick={() => setTab("prd")}>View Full PRD &rarr;</button>
                )}
              </div>
              {prdExcerpt ? (
                <pre className="af-plan-overview__excerpt">{prdExcerpt}</pre>
              ) : (
                <p className="af-plan-overview__empty">No PRD data available yet.</p>
              )}
            </div>

            {/* Story List with Status Badges */}
            <div className="af-plan-overview__section">
              <div className="af-plan-overview__section-header">
                <h4 className="af-plan-overview__title">
                  Stories ({storyList.length || storyCount})
                </h4>
                <button className="af-plan-overview__more" onClick={() => setTab("stories")}>Full Details &rarr;</button>
              </div>
              {(storyList.length > 0 ? storyList : planData.stories).length > 0 ? (
                <div className="af-plan-overview__story-list">
                  {(storyList.length > 0 ? storyList : planData.stories).map((story: any, idx: number) => {
                    const status = story.status || "pending";
                    const badge = STORY_STATUS_BADGES[status] || { color: "#888", label: status.toUpperCase() };
                    return (
                      <div key={story.id || idx} className="af-plan-overview__story-row">
                        <span className="af-plan-overview__story-idx">{idx + 1}</span>
                        <span
                          className="af-plan-overview__story-badge"
                          style={{ color: badge.color, borderColor: badge.color }}
                        >
                          {badge.label}
                        </span>
                        <span className="af-plan-overview__story-title">
                          {story.title || story.name || story.id || `Story ${idx + 1}`}
                        </span>
                        {story.agent && (
                          <span className="af-plan-overview__story-agent">{story.agent}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="af-plan-overview__empty">No stories decomposed yet.</p>
              )}
            </div>

            {/* Design System Info */}
            {designData && (
              <div className="af-plan-overview__section">
                <div className="af-plan-overview__section-header">
                  <h4 className="af-plan-overview__title">Design System</h4>
                  {designData.screens && designData.screens.length > 0 && (
                    <button className="af-plan-overview__more" onClick={() => setTab("design")}>View Screens &rarr;</button>
                  )}
                </div>
                {designData.designSystem ? (
                  <div className="af-plan-overview__design-tokens">
                    {Object.entries(designData.designSystem).map(([key, value]: [string, any]) => (
                      <div key={key} className="af-plan-overview__token">
                        <span className="af-plan-overview__token-key">{key}</span>
                        <span className="af-plan-overview__token-val">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="af-plan-overview__empty">No design system data available.</p>
                )}
                {designData.designNotes && (
                  <p className="af-plan-overview__design-notes">{designData.designNotes}</p>
                )}
                {designData.screens && (
                  <div className="af-plan-overview__screen-summary">
                    {designData.screens.length} screen{designData.screens.length !== 1 ? "s" : ""} generated
                  </div>
                )}
              </div>
            )}
          </div>
        )}

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
          <div className="af-inline-plan__memory">
            {/* Step Timeline */}
            {planData.stepDurations && planData.stepDurations.length > 0 && (
              <div className="af-memory-section">
                <h4 className="af-memory-section__title">Step Timeline</h4>
                <div className="af-memory-timeline">
                  {(() => {
                    const maxDur = Math.max(...planData.stepDurations.map(s => s.durationMs), 1);
                    return planData.stepDurations.map((step) => (
                      <div key={step.stepId} className="af-memory-timeline__row">
                        <span className="af-memory-timeline__label" style={{ color: STATUS_COLORS[step.status] || "#888" }}>
                          {step.stepId.toUpperCase()}
                        </span>
                        <div className="af-memory-timeline__bar-wrap">
                          <div
                            className="af-memory-timeline__bar"
                            style={{
                              width: `${Math.max((step.durationMs / maxDur) * 100, 2)}%`,
                              background: STATUS_COLORS[step.status] || "#555",
                              opacity: step.status === "pending" ? 0.3 : 0.8,
                            }}
                          />
                        </div>
                        <span className="af-memory-timeline__dur">{formatDuration(step.durationMs)}</span>
                        {step.abandonedCount > 0 && (
                          <span className="af-memory-timeline__abandon" title="Abandon count">
                            {step.abandonedCount}x
                          </span>
                        )}
                      </div>
                    ));
                  })()}
                </div>
              </div>
            )}

            {/* Story Stats */}
            {planData.storyStats && Object.keys(planData.storyStats).length > 0 && (
              <div className="af-memory-section">
                <h4 className="af-memory-section__title">Story Stats</h4>
                <div className="af-memory-stats">
                  {Object.entries(planData.storyStats).map(([status, count]) => (
                    <span key={status} className="af-memory-stat" style={{ color: STATUS_COLORS[status] || "#888" }}>
                      <span className="af-memory-stat__count">{count}</span>
                      <span className="af-memory-stat__label">{status}</span>
                    </span>
                  ))}
                  <span className="af-memory-stat" style={{ color: "#aaa" }}>
                    <span className="af-memory-stat__count">
                      {Object.values(planData.storyStats).reduce((a, b) => a + b, 0)}
                    </span>
                    <span className="af-memory-stat__label">total</span>
                  </span>
                </div>
              </div>
            )}

            {/* Total Abandon Count */}
            {planData.stepDurations && (() => {
              const totalAbandons = planData.stepDurations.reduce((sum, s) => sum + s.abandonedCount, 0);
              const totalDur = planData.stepDurations.reduce((sum, s) => sum + s.durationMs, 0);
              return totalAbandons > 0 || totalDur > 0 ? (
                <div className="af-memory-section">
                  <h4 className="af-memory-section__title">Summary</h4>
                  <div className="af-memory-stats">
                    {totalDur > 0 && (
                      <span className="af-memory-stat" style={{ color: "#4488ff" }}>
                        <span className="af-memory-stat__count">{formatDuration(totalDur)}</span>
                        <span className="af-memory-stat__label">total time</span>
                      </span>
                    )}
                    {totalAbandons > 0 && (
                      <span className="af-memory-stat" style={{ color: "#ff6600" }}>
                        <span className="af-memory-stat__count">{totalAbandons}</span>
                        <span className="af-memory-stat__label">abandons</span>
                      </span>
                    )}
                  </div>
                </div>
              ) : null;
            })()}

            {/* Project Memory */}
            {planData.projectMemory && (
              <div className="af-memory-section">
                <h4 className="af-memory-section__title">Project Memory</h4>
                <pre className="af-inline-plan__raw">{planData.projectMemory}</pre>
              </div>
            )}
            {!planData.projectMemory && !planData.stepDurations?.length && (
              <pre className="af-inline-plan__raw">(no project memory yet)</pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
