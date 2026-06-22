import React, { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";

interface AgentActivityDrawerProps {
  runId: string;
  stepId: string | null;
  label?: string;
  open: boolean;
  onClose: () => void;
}

function compact(value: unknown): string {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function formatTime(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function metric(value: unknown): string {
  if (value == null || value === "") return "-";
  return String(value);
}

export function AgentActivityDrawer({ runId, stepId, label, open, onClose }: AgentActivityDrawerProps) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const activeClaim = data?.claims?.[0] || null;

  useEffect(() => {
    if (!open || !stepId) return;
    let cancelled = false;
    const load = () => {
      setLoading(true);
      api.runAgentActivity(runId, stepId)
        .then((next) => {
          if (cancelled) return;
          setData(next);
          setError("");
        })
        .catch((err: any) => {
          if (cancelled) return;
          setError(err?.message || "Agent activity unavailable");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };
    load();
    const id = setInterval(load, 4_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [open, runId, stepId]);

  useEffect(() => {
    if (!open) {
      setData(null);
      setError("");
      setLoading(false);
    }
  }, [open]);

  const receivedRows = useMemo(() => {
    const received = data?.received || {};
    return [
      ["failure", received.failureCategory],
      ["mode", received.retryMode],
      ["scope", Array.isArray(received.scopeFiles) ? received.scopeFiles.join(", ") : ""],
      ["snapshot", received.sourceSnapshotBytes ? `${received.sourceSnapshotBytes} bytes` : ""],
      ["memory", received.supervisorMemoryChars ? `${received.supervisorMemoryChars} chars` : ""],
      ["review", received.actionableThreadCount == null ? "" : `${received.actionableThreadCount} actionable`],
    ].filter(([, value]) => compact(value));
  }, [data]);

  if (!open || !stepId) return null;

  return (
    <div className="af-agent-activity" role="dialog" aria-modal="false" aria-label="Agent activity">
      <div className="af-agent-activity__panel">
        <div className="af-agent-activity__head">
          <div>
            <span>AGENT ACTIVITY</span>
            <strong>{label || stepId}</strong>
            <em>{data?.step?.agentId || activeClaim?.agentId || "agent not claimed"}</em>
          </div>
          <button type="button" onClick={onClose} aria-label="Close agent activity">x</button>
        </div>

        {error && <div className="af-agent-activity__error">{error}</div>}
        {loading && !data && <div className="af-agent-activity__empty">Loading activity...</div>}

        <section className="af-agent-activity__section">
          <div className="af-agent-activity__section-head">
            <span>Active Claim</span>
            <b>{data?.step?.status || activeClaim?.outcome || "unknown"}</b>
          </div>
          {activeClaim ? (
            <div className="af-agent-activity__claim">
              <span>{activeClaim.storyId || stepId}</span>
              <strong>{activeClaim.outcome || "running"}</strong>
              <em>{formatTime(activeClaim.claimedAt)} - {formatTime(activeClaim.abandonedAt)}</em>
              {activeClaim.diagnosticPreview && <p>{activeClaim.diagnosticPreview}</p>}
            </div>
          ) : (
            <div className="af-agent-activity__empty">No claim row found for this step.</div>
          )}
        </section>

        <section className="af-agent-activity__section">
          <div className="af-agent-activity__section-head">
            <span>Agent Received</span>
            <b>{receivedRows.length} signals</b>
          </div>
          <div className="af-agent-activity__grid">
            {receivedRows.length === 0 ? (
              <div className="af-agent-activity__empty">No bootstrap or retry context detected.</div>
            ) : receivedRows.map(([key, value]) => (
              <div key={key} className="af-agent-activity__metric">
                <span>{key}</span>
                <strong title={String(value)}>{metric(value)}</strong>
              </div>
            ))}
          </div>
          {data?.received?.feedbackPreview && (
            <pre className="af-agent-activity__pre">{data.received.feedbackPreview}</pre>
          )}
        </section>

        <section className="af-agent-activity__section">
          <div className="af-agent-activity__section-head">
            <span>Live Trace</span>
            <b>{data?.trace?.length || 0} events</b>
          </div>
          <div className="af-agent-activity__trace">
            {(data?.trace || []).length === 0 ? (
              <div className="af-agent-activity__empty">No transcript events detected yet.</div>
            ) : data.trace.map((entry: any, index: number) => (
              <div key={`${entry.kind}-${index}`} className={`af-agent-activity__trace-row af-agent-activity__trace-row--${entry.kind}`}>
                <span>{formatTime(entry.ts)}</span>
                <strong>{entry.label}</strong>
                {entry.detail && <em title={entry.detail}>{entry.detail}</em>}
              </div>
            ))}
          </div>
        </section>

        <section className="af-agent-activity__section">
          <div className="af-agent-activity__section-head">
            <span>Raw Pointers</span>
            <b>{loading ? "refreshing" : "live"}</b>
          </div>
          <div className="af-agent-activity__paths">
            <span title={data?.raw?.transcriptPath || ""}>transcript: {data?.raw?.transcriptPath || "-"}</span>
            <span title={data?.raw?.claimSummaryPath || ""}>claim summary: {data?.raw?.claimSummaryPath || "-"}</span>
          </div>
          {data?.raw?.transcriptPreview && <pre className="af-agent-activity__raw">{data.raw.transcriptPreview}</pre>}
        </section>
      </div>
    </div>
  );
}
