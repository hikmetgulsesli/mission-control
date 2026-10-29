import type { ProductBuildAuthority, ProductBuildAuthorityFetchResult } from "./setfarm-product-build-authority-core.js";

export type ProductBuildAuthorityHttpResult =
  | { statusCode: 200; body: ProductBuildAuthority }
  | {
      statusCode: 404 | 409 | 501 | 502 | 503;
      body: {
        status: "unavailable" | "upstream_error" | "unsupported_schema";
        code: string;
        reason?: string;
        upstreamStatus?: number;
        upstreamCode?: string;
        schema?: string | null;
      };
    };

export function toProductBuildAuthorityHttpResult(result: ProductBuildAuthorityFetchResult): ProductBuildAuthorityHttpResult {
  switch (result.status) {
    case "ok":
      return { statusCode: 200, body: result.authority };
    case "unavailable": {
      let statusCode: 404 | 409 | 503;
      let code: string;
      switch (result.reason) {
        case "not_found":
          statusCode = 404;
          code = "SETFARM_PRODUCT_BUILD_AUTHORITY_NOT_FOUND";
          break;
        case "not_ready":
          statusCode = 409;
          code = "SETFARM_PRODUCT_BUILD_AUTHORITY_NOT_READY";
          break;
        default:
          statusCode = 503;
          code = "SETFARM_PRODUCT_BUILD_AUTHORITY_UNAVAILABLE";
      }
      return {
        statusCode,
        body: {
          status: "unavailable",
          code,
          reason: result.reason,
          ...(result.upstreamStatus === undefined ? {} : { upstreamStatus: result.upstreamStatus }),
          ...(result.upstreamCode === undefined ? {} : { upstreamCode: result.upstreamCode }),
        },
      };
    }
    case "upstream_error":
      return {
        statusCode: 502,
        body: {
          status: "upstream_error",
          code: "SETFARM_PRODUCT_BUILD_AUTHORITY_UPSTREAM_ERROR",
          reason: result.reason,
          ...(result.upstreamStatus === undefined ? {} : { upstreamStatus: result.upstreamStatus }),
          ...(result.upstreamCode === undefined ? {} : { upstreamCode: result.upstreamCode }),
        },
      };
    case "unsupported_schema":
      return {
        statusCode: 501,
        body: {
          status: "unsupported_schema",
          code: "SETFARM_PRODUCT_BUILD_AUTHORITY_UNSUPPORTED_SCHEMA",
          schema: result.schema,
        },
      };
  }
}


export function resolveProductBuildAuthoritySchema(query: unknown): "v1" | "v2" | "v3" {
  if (query === undefined) return "v2";
  if (query === "v1" || query === "v2" || query === "v3") return query;
  throw new Error("SETFARM_PRODUCT_BUILD_AUTHORITY_UNSUPPORTED_SCHEMA");
}

type InvalidSchemaHttpResult = {
  statusCode: 400;
  body: { status: "unsupported_schema"; code: "SETFARM_PRODUCT_BUILD_AUTHORITY_UNSUPPORTED_SCHEMA"; schema: string | null };
};

/** Pure route adapter. Only negotiation refusal is 400; client failures reach the route catch. */
export async function resolveProductBuildAuthorityHttpRequest(
  runId: string,
  schemaQuery: unknown,
  client: { get(runId: string, version: "v1" | "v2" | "v3"): Promise<ProductBuildAuthorityFetchResult> },
): Promise<ProductBuildAuthorityHttpResult | InvalidSchemaHttpResult> {
  let version: "v1" | "v2" | "v3";
  try {
    version = resolveProductBuildAuthoritySchema(schemaQuery);
  } catch {
    return { statusCode: 400, body: { status: "unsupported_schema", code: "SETFARM_PRODUCT_BUILD_AUTHORITY_UNSUPPORTED_SCHEMA", schema: typeof schemaQuery === "string" ? schemaQuery : null } };
  }
  return toProductBuildAuthorityHttpResult(await client.get(runId, version));
}
