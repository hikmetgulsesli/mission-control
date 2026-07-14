import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { OperationalSnapshotState } from "../lib/operational-snapshot";

export function useOperationalSnapshot(runId: string | null | undefined, intervalMs = 5_000): OperationalSnapshotState {
  const [state, setState] = useState<OperationalSnapshotState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    if (!runId) {
      setState({
        status: "unavailable",
        code: "SETFARM_OPERATIONAL_SNAPSHOT_NOT_FOUND",
        reason: "not_found",
      });
      return () => { cancelled = true; };
    }

    setState({ status: "loading" });
    const load = async () => {
      const result = await api.runOperationalSnapshot(runId);
      if (!cancelled) setState(result);
    };

    void load();
    const interval = window.setInterval(load, intervalMs);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [runId, intervalMs]);

  return state;
}

export function useOperationalSnapshots(runIds: string[], intervalMs = 5_000): Record<string, OperationalSnapshotState> {
  const idsKey = JSON.stringify([...new Set(runIds)].sort());
  const [states, setStates] = useState<Record<string, OperationalSnapshotState>>({});

  useEffect(() => {
    let cancelled = false;
    const ids = JSON.parse(idsKey) as string[];

    if (ids.length === 0) {
      setStates({});
      return () => { cancelled = true; };
    }

    setStates((previous) => Object.fromEntries(ids.map((id) => [id, previous[id] || { status: "loading" }])));
    const load = async () => {
      const results = await Promise.all(ids.map(async (id) => [id, await api.runOperationalSnapshot(id)] as const));
      if (!cancelled) setStates(Object.fromEntries(results));
    };

    void load();
    const interval = window.setInterval(load, intervalMs);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [idsKey, intervalMs]);

  return states;
}
