import { useEffect, useState } from "react";
import { api } from "../lib/api";
import {
  shouldPollProductBuildAuthority,
  type ProductBuildAuthorityState,
} from "../lib/product-build-authority";

export function useProductBuildAuthority(
  runId: string | null | undefined,
  intervalMs = 5_000,
): ProductBuildAuthorityState {
  const [state, setState] = useState<ProductBuildAuthorityState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    let timeoutId: number | undefined;
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
      if (cancelled) return;
      setState(result);
      if (shouldPollProductBuildAuthority(result)) {
        timeoutId = window.setTimeout(load, intervalMs);
      }
    };
    void load();
    return () => {
      cancelled = true;
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, [runId, intervalMs]);

  return state;
}
