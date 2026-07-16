import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { ProductBuildAuthorityState } from "../lib/product-build-authority";

export function useProductBuildAuthority(
  runId: string | null | undefined,
  intervalMs = 5_000,
): ProductBuildAuthorityState {
  const [state, setState] = useState<ProductBuildAuthorityState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    if (!runId) {
      setState({
        status: "unavailable",
        code: "SETFARM_PRODUCT_BUILD_AUTHORITY_NOT_FOUND",
        reason: "not_found",
      });
      return () => { cancelled = true; };
    }
    setState({ status: "loading" });
    const load = async () => {
      const result = await api.runProductBuildAuthority(runId);
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
