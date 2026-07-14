import assert from "node:assert/strict";
import test from "node:test";

import { SingleFlightBackgroundIntervalOwner } from "./background-interval-owner.js";

test("background owner runs without HTTP, prevents overlap, and stops cleanly", async () => {
  let intervalTick: (() => void) | null = null;
  let intervalCleared = false;
  let calls = 0;
  let releaseFirst!: () => void;
  const first = new Promise<void>((resolve) => { releaseFirst = resolve; });
  const owner = new SingleFlightBackgroundIntervalOwner({
    intervalMs: 30_000,
    async run() {
      calls += 1;
      if (calls === 1) await first;
    },
    setIntervalImpl: ((callback: () => void) => {
      intervalTick = callback;
      return { unref() {} } as ReturnType<typeof setInterval>;
    }) as typeof setInterval,
    clearIntervalImpl: (() => { intervalCleared = true; }) as typeof clearInterval,
  });

  owner.start();
  await Promise.resolve();
  assert.equal(calls, 1, "startup owns the first tick; no request is required");
  (intervalTick as unknown as () => void)();
  (intervalTick as unknown as () => void)();
  await Promise.resolve();
  assert.equal(calls, 1, "interval ticks cannot overlap the active owner");

  releaseFirst();
  await new Promise<void>((resolve) => setImmediate(resolve));
  (intervalTick as unknown as () => void)();
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(calls, 2);

  await owner.stop();
  assert.equal(intervalCleared, true);
  (intervalTick as unknown as () => void)();
  await Promise.resolve();
  assert.equal(calls, 2, "a stopped lifecycle owner cannot schedule more work");
});
