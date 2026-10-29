import { config } from "../config.js";
import { SetfarmProductBuildAuthorityClient as CoreSetfarmProductBuildAuthorityClient } from "./setfarm-product-build-authority-core.js";

export {
  parseProductBuildAuthority,
  parseProductBuildAuthorityV1,
  parseProductBuildAuthorityV2,
  parseProductBuildAuthorityV3,
} from "./setfarm-product-build-authority-core.js";
export type {
  ProductBuildAuthority,
  ProductBuildAuthorityFetchResult,
  ProductBuildAuthorityV1,
  ProductBuildAuthorityV2,
  ProductBuildAuthorityV3,
  ProductBuildPacketAuthorityV3,
  ProductBuildRefusalV2,
} from "./setfarm-product-build-authority-core.js";

export interface SetfarmProductBuildAuthorityClientOptions {
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export class SetfarmProductBuildAuthorityClient extends CoreSetfarmProductBuildAuthorityClient {
  constructor(options: SetfarmProductBuildAuthorityClientOptions = {}) {
    super({ ...options, baseUrl: options.baseUrl ?? config.setfarmUrl });
  }
}

export const setfarmProductBuildAuthorityClient = new SetfarmProductBuildAuthorityClient();
