import { prepareFreshMissionControlRuntimeV1, assertFreshMissionControlRuntimeV1, closeFreshMissionControlRuntimeV1 } from './services/fresh-installation-runtime.js';

try {
  await prepareFreshMissionControlRuntimeV1();
  assertFreshMissionControlRuntimeV1();
  await import('./app.js');
} catch {
  console.error('MC_STARTUP_UNAVAILABLE');
  process.exitCode = 1;
  // An app import may already own timers. Fence/close the captured pool, then
  // terminate this process; the fixed fallback also bounds failed cleanup.
  const deadline = setTimeout(() => process.exit(1), 6_000);
  try { await closeFreshMissionControlRuntimeV1(); } catch { /* Remains failed. */ }
  finally { clearTimeout(deadline); process.exit(1); }
}
