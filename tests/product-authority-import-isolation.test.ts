import assert from "node:assert/strict";
import test from "node:test";

const marker = Symbol.for("setfarm.pba.inert-import-guard.v1");
test("PBA isolation: pre-import guard activation marker is present", () => {
  assert.equal(Reflect.get(globalThis, marker), true, "Use the required --import guard before --import tsx");
});

for (const modulePath of [
  "../server/config", "../server/services/setfarm-product-build-authority",
  "../server/services/setfarm-operational-snapshot",
]) {
  for (const extension of ["ts", "js"]) {
    test(`PBA isolation: rejects ${modulePath}.${extension} before evaluation`, async () => {
      assert.equal(Reflect.get(globalThis, marker), true, "Guard inactive: no operational import is permitted");
      const target = new URL(`${modulePath}.${extension}`, import.meta.url).href;
      await assert.rejects(() => import(target), (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(Reflect.get(error, "code"), "PBA_TEST_OPERATIONAL_IMPORT_FORBIDDEN", "Missing module/tsx errors are not isolation proof");
        assert.equal(error.message, "PBA_TEST_OPERATIONAL_IMPORT_FORBIDDEN");
        const blockedPath = Reflect.get(error, "blockedPath");
        assert.equal(typeof blockedPath, "string");
        const exactModule = modulePath.replace("..", "");
        assert.ok(blockedPath.endsWith(`${exactModule}.ts`) || blockedPath.endsWith(`${exactModule}.js`), "Guard must identify this exact prohibited module");
        return true;
      });
    });
  }
}
