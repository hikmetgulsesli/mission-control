import { parseProductBuildAuthorityResponse, type ProductBuildAuthorityState } from "./product-build-authority.js";

export async function fetchProductBuildAuthority(runId: string, fetchImpl: typeof fetch, baseUrl: string, headers: Record<string, string>): Promise<Exclude<ProductBuildAuthorityState, { status: 'loading' }>> {
  try {
    const res = await fetchImpl(`${baseUrl}/api/setfarm/runs/${encodeURIComponent(runId)}/product-build-authority?schema=v3`, {
      headers,
      cache: 'no-store',
    });
    const text = await res.text();
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return {
        status: 'upstream_error',
        code: 'SETFARM_PRODUCT_BUILD_AUTHORITY_UPSTREAM_ERROR',
        reason: 'invalid_json',
        upstreamStatus: res.status,
      };
    }
    return parseProductBuildAuthorityResponse(res.status, body, runId);
  } catch {
    return {
      status: 'unavailable',
      code: 'SETFARM_PRODUCT_BUILD_AUTHORITY_UNAVAILABLE',
      reason: 'network',
    };
  }
}
