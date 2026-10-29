import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";

const blocked = /\/server\/(?:config|services\/(?:setfarm-operational-snapshot|setfarm-product-build-authority))\.(?:ts|js)$/;
registerHooks({
  resolve(specifier, context, nextResolve) {
    const result = nextResolve(specifier, context);
    if (result.url.startsWith("file:") && blocked.test(fileURLToPath(result.url))) {
      const error = new Error("PBA_TEST_OPERATIONAL_IMPORT_FORBIDDEN");
      error.code = "PBA_TEST_OPERATIONAL_IMPORT_FORBIDDEN";
      error.blockedPath = fileURLToPath(result.url);
      throw error;
    }
    return result;
  },
});
globalThis[Symbol.for("setfarm.pba.inert-import-guard.v1")] = true;
