import React, { useState, useEffect, useCallback } from "react";
import { StoryChecklist } from "../StoryChecklist";
import { api } from "../../lib/api";
import { normalizeVisibleText, normalizeVisibleWorkflowStatus } from "../../lib/status";

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

interface ContractItem {
  id: string;
  label: string;
  status: "pass" | "fail" | "pending" | "deferred" | string;
  owner: string;
  evidence?: string;
  blocker?: string;
  storyId?: string;
  stepId?: string;
}

interface RunContractData {
  schema?: string;
  progress?: Record<string, number>;
  project?: { displayName?: string; techStack?: string; repo?: string; branch?: string; uiLanguage?: string };
  stackPack?: { id?: string; label?: string; confidence?: string; evidence?: string[] };
  phases?: Array<{ id: string; label: string; status: string; items: ContractItem[] }>;
  stories?: Array<{ storyId: string; title: string; status: string; ownsScreens?: string[]; scopeFiles?: string[]; deferred?: boolean; blocker?: string }>;
  artifacts?: Record<string, any>;
  blockers?: string[];
  updatedAt?: string;
  reason?: string;
}

const STORY_STATUS_BADGES: Record<string, { color: string; label: string }> = {
  done: { color: "#00ff41", label: "DONE" },
  running: { color: "#4488ff", label: "RUNNING" },
  failed: { color: "#ff0040", label: "FAILED" },
  pending: { color: "#555570", label: "PENDING" },
  verified: { color: "#22c55e", label: "VERIFIED" },
  skipped: { color: "#ff0040", label: "FAILED" },
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
  skipped: "#ff0040",
};

const CONTRACT_STATUS_LABELS: Record<string, string> = {
  pass: "PASS",
  fail: "FAIL",
  pending: "PENDING",
  deferred: "DEFERRED",
  na: "PENDING",
};

function normalizeVisibleStatus(status: unknown): string {
  const value = String(status || "pending").trim().toLowerCase();
  if (value === "na" || value === "n/a" || value === "not_applicable") return "pending";
  if (value === "skipped" || value === "skip") return "fail";
  return value || "pending";
}

function contractStatusLabel(status: string): string {
  const visibleStatus = normalizeVisibleStatus(status);
  return CONTRACT_STATUS_LABELS[visibleStatus] || String(visibleStatus || "UNKNOWN").toUpperCase();
}

function contractItemSummary(items: ContractItem[] = []): string {
  if (items.length === 0) return "0 checks";
  const statuses = items.map((item) => normalizeVisibleStatus(item.status));
  const pass = statuses.filter((status) => status === "pass").length;
  const fail = statuses.filter((status) => status === "fail").length;
  if (fail > 0) return `${fail} failed`;
  return `${pass}/${items.length} checks`;
}

function formatContractValue(value: unknown): string {
  if (value == null) return "";
  if (Array.isArray(value)) return normalizeVisibleText(value.map(formatContractValue).filter(Boolean).join(", "));
  if (typeof value !== "object") return normalizeVisibleText(value);
  const entry = value as Record<string, any>;
  const name = formatContractValue(entry.name || entry.title || entry.label || entry.screenName);
  const type = formatContractValue(entry.type || entry.deviceType || entry.kind);
  const id = formatContractValue(entry.screenId || entry.screen_id || entry.id || entry.path || entry.status);
  if (name && type) return normalizeVisibleText(`${name} (${type})`);
  if (name) return normalizeVisibleText(name);
  if (id) return normalizeVisibleText(id);
  try {
    return normalizeVisibleText(JSON.stringify(value));
  } catch {
    return normalizeVisibleText(value);
  }
}

function formatContractList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(formatContractValue).map((item) => item.trim()).filter(Boolean);
}

export interface InlinePlanViewProps {
  runId: string;
  onRetry?: (storyId: string) => void;
  initialTab?: "overview" | "contract" | "prd" | "design" | "stories" | "raw" | "memory";
}

export const InlinePlanView = React.memo(function InlinePlanView({ runId, onRetry, initialTab = "overview" }: InlinePlanViewProps) {
  const [tab, setTab] = useState<"overview" | "contract" | "prd" | "design" | "stories" | "raw" | "memory">(initialTab);
  const [planData, setPlanData] = useState<PlanData | null>(null);
  const [designData, setDesignData] = useState<any>(null);
  const [contractData, setContractData] = useState<RunContractData | null>(null);
  const [storyList, setStoryList] = useState<StoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(() => {
    Promise.all([
      api.runPlan(runId),
      api.runDesign(runId).catch(() => null),
      api.runStories(runId).catch(() => []),
      api.runContract(runId).catch(() => null),
    ]).then(([plan, design, stories, contract]) => {
      setPlanData(plan);
      if (design) setDesignData(design);
      if (contract) setContractData(contract);
      if (Array.isArray(stories)) setStoryList(stories);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [runId]);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 10_000);
    return () => clearInterval(id);
  }, [fetchData]);

  useEffect(() => {
    setTab(initialTab);
  }, [runId, initialTab]);

  const planStories = Array.isArray(planData?.stories) ? planData.stories : [];

  if (loading) return <div className="af-inline-plan__loading">Loading plan data...</div>;
  if (!planData || (!planData.prd && planStories.length === 0 && !contractData)) {
    return <StoryChecklist runId={runId} onRetry={onRetry} />;
  }

  const safePlan: PlanData = { prd: planData?.prd || "", stories: planStories, rawOutput: planData?.rawOutput || "", projectMemory: planData?.projectMemory, stepDurations: planData?.stepDurations, storyStats: planData?.storyStats };
  const storyCount = safePlan.stories.length || contractData?.stories?.length || 0;
  const prdExcerpt = safePlan.prd ? safePlan.prd.slice(0, 500) + (safePlan.prd.length > 500 ? "..." : "") : "";
  const contractProgress = contractData?.progress || {};
  const contractTotal = Number(contractProgress.total || 0);
  const contractPass = Number(contractProgress.pass || 0);
  const contractFail = Number(contractProgress.fail || 0);
  const contractPending = Number(contractProgress.pending || 0);

  return (
    <div className="af-inline-plan">
      <div className="af-inline-plan__tabs">
        <button className={`af-inline-plan__tab ${tab === "overview" ? "af-inline-plan__tab--active" : ""}`} onClick={() => setTab("overview")}>OVERVIEW</button>
        {contractData && (
          <button className={`af-inline-plan__tab ${tab === "contract" ? "af-inline-plan__tab--active" : ""}`} onClick={() => setTab("contract")}>
            CONTRACT {contractFail > 0 ? `(${contractFail})` : contractTotal > 0 ? `(${contractPass}/${contractTotal})` : ""}
          </button>
        )}
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
                {safePlan.prd && safePlan.prd.length > 500 && (
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
              {(storyList.length > 0 ? storyList : safePlan.stories).length > 0 ? (
                <div className="af-plan-overview__story-list">
                  {(storyList.length > 0 ? storyList : safePlan.stories).map((story: any, idx: number) => {
                    const status = normalizeVisibleStatus(story.status || "pending");
                    const badge = STORY_STATUS_BADGES[status] || { color: "#888", label: status.toUpperCase() };
                    const storyKey = formatContractValue(story.id || story.storyId || story.story_id || idx);
                    const storyTitle = formatContractValue(story.title || story.name || story.id || `Story ${idx + 1}`);
                    const storyAgent = formatContractValue(story.agent);
                    return (
                      <div key={storyKey || idx} className="af-plan-overview__story-row">
                        <span className="af-plan-overview__story-idx">{idx + 1}</span>
                        <span
                          className="af-plan-overview__story-badge"
                          style={{ color: badge.color, borderColor: badge.color }}
                        >
                          {badge.label}
                        </span>
                        <span className="af-plan-overview__story-title">
                          {storyTitle || `Story ${idx + 1}`}
                        </span>
                        {storyAgent && (
                          <span className="af-plan-overview__story-agent">{storyAgent}</span>
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
                        <span className="af-plan-overview__token-val">{formatContractValue(value)}</span>
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
            {safePlan.prd.split("\n").map((line, i) => {
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

        {tab === "contract" && (
          contractData ? (
            <div className="af-contract">
                <div className="af-contract__summary">
                  <div className="af-contract__summary-main">
                    <span className="af-contract__kicker">RUN CONTRACT</span>
                  <strong>{formatContractValue(contractData.project?.displayName) || "Setfarm Project"}</strong>
                  <span>{formatContractValue(contractData.stackPack?.label || contractData.stackPack?.id) || "Unknown stack"}</span>
                  </div>
                <div className="af-contract__metrics">
                  <span className="af-contract__metric af-contract__metric--pass">{contractPass} checks pass</span>
                  <span className="af-contract__metric af-contract__metric--fail">{contractFail} checks fail</span>
                  <span className="af-contract__metric af-contract__metric--pending">{contractPending} checks pending</span>
                  {Number(contractProgress.deferred || 0) > 0 && (
                    <span className="af-contract__metric af-contract__metric--deferred">{contractProgress.deferred} checks deferred</span>
                  )}
                </div>
              </div>

              {contractData.blockers && contractData.blockers.length > 0 && (
                <div className="af-contract__blockers">
                  {contractData.blockers.map((blocker, idx) => (
                    <div key={idx} className="af-contract__blocker">{formatContractValue(blocker)}</div>
                  ))}
                </div>
              )}

              <div className="af-contract__subhead">Pipeline Phases</div>
              <div className="af-contract__phase-rail">
                {(contractData.phases || []).map((phase) => (
                  <div key={phase.id} className={`af-contract__phase af-contract__phase--${normalizeVisibleStatus(phase.status)}`}>
                    <span>{formatContractValue(phase.label || phase.id)}</span>
                    <b>{contractStatusLabel(phase.status)}</b>
                  </div>
                ))}
              </div>

              <div className="af-contract__subhead">Evidence Checks</div>
              <div className="af-contract__grid">
                {(contractData.phases || []).map((phase) => (
                  <section key={phase.id} className="af-contract__section">
                    <div className="af-contract__section-head">
                      <h4>{formatContractValue(phase.label || phase.id)}</h4>
                      <span className={`af-contract__badge af-contract__badge--${normalizeVisibleStatus(phase.status)}`}>{contractItemSummary(phase.items)}</span>
                    </div>
                    <div className="af-contract__items">
                      {(phase.items || []).map((contractItem) => {
                        const evidence = formatContractValue(contractItem.evidence);
                        const blocker = formatContractValue(contractItem.blocker);
                        return (
                          <div key={contractItem.id} className={`af-contract__item af-contract__item--${normalizeVisibleStatus(contractItem.status)}`}>
                            <span className="af-contract__item-status">{contractStatusLabel(contractItem.status)}</span>
                            <span className="af-contract__item-label">{formatContractValue(contractItem.label || contractItem.id)}</span>
                            <span className="af-contract__item-owner">{formatContractValue(contractItem.owner)}</span>
                            {evidence && <span className="af-contract__item-evidence" title={evidence}>{evidence}</span>}
                            {blocker && <span className="af-contract__item-blocker">{blocker}</span>}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>

              {contractData.stories && contractData.stories.length > 0 && (
                <section className="af-contract__section af-contract__section--wide">
                  <div className="af-contract__section-head">
                    <h4>Story Ownership</h4>
                    <span>{contractData.stories.length} stories</span>
                  </div>
                  <div className="af-contract__stories">
                    {contractData.stories.map((story) => {
                      const ownedScreens = formatContractList(story.ownsScreens);
                      const scopeFiles = formatContractList(story.scopeFiles);
                      const blocker = formatContractValue(story.blocker);
                      const storyStatus = normalizeVisibleStatus(story.status);
                      const storyId = formatContractValue(story.storyId);
                      const storyTitle = formatContractValue(story.title || story.storyId);
                      return (
                        <div key={storyId} className={`af-contract__story ${story.deferred ? "af-contract__story--deferred" : ""}`}>
                          <span className="af-contract__story-id">{storyId}</span>
                          <span className="af-contract__story-title">{storyTitle}</span>
                          <span className={`af-contract__badge af-contract__badge--${storyStatus}`}>{storyStatus.toUpperCase()}</span>
                          <span className="af-contract__story-meta" title={ownedScreens.join(", ")}>{ownedScreens.length} screens</span>
                          <span className="af-contract__story-meta" title={scopeFiles.join(", ")}>{scopeFiles.length} files</span>
                          {blocker && <span className="af-contract__item-blocker">{blocker}</span>}
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}
            </div>
          ) : (
            <div className="af-plan-overview__empty">No run contract data available yet.</div>
          )
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
                      <span className="af-design-token__val">{formatContractValue(value)}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
            {designData.designNotes && (
              <p className="af-design-notes">{designData.designNotes}</p>
            )}
            <div className="af-design-grid">
              {designData.screens.map((screen: any, idx: number) => {
                const screenId = formatContractValue(screen.screenId || screen.id || idx);
                const screenName = formatContractValue(screen.name || screen.title || `Screen ${idx + 1}`);
                const screenType = formatContractValue(screen.type || screen.deviceType || "desktop");
                const screenDescription = formatContractValue(screen.description);
                return (
                  <div key={screenId || idx} className="af-design-card">
                    <div className="af-design-card__header">
                      <span className="af-design-card__name">{screenName}</span>
                      <span className="af-design-card__type">{screenType}</span>
                    </div>
                    {screenDescription && <p className="af-design-card__desc">{screenDescription}</p>}
                    {screen.screenshotUrl ? (
                      <div className="af-design-card__img-wrap">
                        <img
                          src={screen.screenshotUrl}
                          alt={screenName}
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
                        <span className="af-design-card__size">{formatContractValue(screen.width)}x{formatContractValue(screen.height)}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === "stories" && (
          <StoryChecklist runId={runId} onRetry={onRetry} />
        )}

        {tab === "raw" && (
          <pre className="af-inline-plan__raw">{safePlan.rawOutput}</pre>
        )}

        {tab === "memory" && (
          <div className="af-inline-plan__memory">
            {/* Step Timeline */}
            {safePlan.stepDurations && safePlan.stepDurations.length > 0 && (
              <div className="af-memory-section">
                <h4 className="af-memory-section__title">Step Timeline</h4>
                <div className="af-memory-timeline">
                  {(() => {
                    const maxDur = Math.max(...safePlan.stepDurations.map(s => s.durationMs), 1);
                    return safePlan.stepDurations.map((step) => {
                      const stepStatus = normalizeVisibleWorkflowStatus(step.status);
                      return (
                        <div key={step.stepId} className="af-memory-timeline__row">
                          <span className="af-memory-timeline__label" style={{ color: STATUS_COLORS[stepStatus] || "#888" }}>
                            {step.stepId.toUpperCase()}
                          </span>
                          <div className="af-memory-timeline__bar-wrap">
                            <div
                              className="af-memory-timeline__bar"
                              style={{
                                width: `${Math.max((step.durationMs / maxDur) * 100, 2)}%`,
                                background: STATUS_COLORS[stepStatus] || "#555",
                                opacity: stepStatus === "pending" ? 0.3 : 0.8,
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
                      );
                    });
                  })()}
                </div>
              </div>
            )}

            {/* Story Stats */}
            {safePlan.storyStats && Object.keys(safePlan.storyStats).length > 0 && (
              <div className="af-memory-section">
                <h4 className="af-memory-section__title">Story Stats</h4>
                <div className="af-memory-stats">
                  {(() => {
                    const visibleStats = Object.entries(safePlan.storyStats || {}).reduce<Record<string, number>>((acc, [status, count]) => {
                      const visibleStatus = normalizeVisibleWorkflowStatus(status);
                      acc[visibleStatus] = (acc[visibleStatus] || 0) + Number(count || 0);
                      return acc;
                    }, {});
                    return Object.entries(visibleStats).map(([status, count]) => (
                      <span key={status} className="af-memory-stat" style={{ color: STATUS_COLORS[status] || "#888" }}>
                        <span className="af-memory-stat__count">{count}</span>
                        <span className="af-memory-stat__label">{status}</span>
                      </span>
                    ));
                  })()}
                  <span className="af-memory-stat" style={{ color: "#aaa" }}>
                    <span className="af-memory-stat__count">
                      {Object.values(safePlan.storyStats).reduce((a, b) => a + b, 0)}
                    </span>
                    <span className="af-memory-stat__label">total</span>
                  </span>
                </div>
              </div>
            )}

            {/* Total Abandon Count */}
            {safePlan.stepDurations && (() => {
              const totalAbandons = safePlan.stepDurations.reduce((sum, s) => sum + s.abandonedCount, 0);
              const totalDur = safePlan.stepDurations.reduce((sum, s) => sum + s.durationMs, 0);
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
            {safePlan.projectMemory && (
              <div className="af-memory-section">
                <h4 className="af-memory-section__title">Project Memory</h4>
                <pre className="af-inline-plan__raw">{safePlan.projectMemory}</pre>
              </div>
            )}
            {!safePlan.projectMemory && !safePlan.stepDurations?.length && (
              <pre className="af-inline-plan__raw">(no project memory yet)</pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
