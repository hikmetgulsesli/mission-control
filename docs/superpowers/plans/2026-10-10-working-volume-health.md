# Working-volume disk health

## Design and scope

The system-health audit reproduced `/api/health` reporting `52%` for `/`
while `df -k` on Mission Control's actual working directory reports `95%`.
On APFS, `statfs` does not reproduce `df`'s per-volume used-space accounting.
This is a causal health-reporting fix within the requested system checks,
not permission to delete more data or bypass Setfarm rollout gates.

Keep the existing health response, 90-percent disk warning threshold, three-second
probe timeout, and overall health policy. Measure the service's working volume
with asynchronous `execFile("df", ["-k", process.cwd()])`, never a shell string.
Reject missing/malformed/out-of-range percentages as `unknown` without echoing
command output. Do not change runtime configuration, auth, other mounts, project
visibility, service ports, or OpenClaw state. This probe is not a capacity
reservation or proof that every externally configured storage path is healthy.

File Map:

- `server/utils/disk-health.ts`: own the working-volume observation and classify it.
- `server/utils/disk-health.test.ts`: protect root-vs-working volume, thresholds,
  invalid output, and failed probes through the operating-system command boundary.
- `server/index.ts`: consume that observation in the existing registered health route.

## Execution

- [x] Observe live original failure: health `52%`, working-volume `95%`.
- [x] Use a new isolated Mission Control branch; preserve canonical main and all data.
- [x] Add tests, capture missing interface RED, implement the minimal owner/wiring.
- [ ] Verify focused tests and registered route behavior without starting MC's
  project-transfer scheduler or performing live database writes.
- [x] Obtain independent read-only review; resolve substantive findings.
- [ ] Commit scoped files, run the normal build on the clean branch, deliver a PR.
- [ ] Require reviewed integration and clean-main build before any live rollout.

Current OpenClaw candidate migration and Setfarm cutover plans remain unchanged.

## Evidence checkpoints

The original live route assertion fails with `52% !== 95%` using the same
`df -k` accounting as the existing route. The first isolated test load correctly
refuses the missing helper interface; after implementation all 12 tests pass.
Server TypeScript compilation and compiled real-volume smoke both pass;
the latter reports `{status: "warning", detail: "95%"}`. Neither starts the
transfer scheduler or changes live data. These initial checks used local
main `b677c470`; GitHub truth revealed reviewed telemetry merge `5c9e5dcd`
was not locally synchronized. Root fetched that exact object without changing
shared `origin/main`, and incorporated it ff-only into this isolated branch.
The unrelated telemetry changes and Node engine minimum remain intact. Final
verification is rerun on this current base, not silently credited from the old one.

Two independent read-only reviews found no critical/important issue. Their
bounded-probe test suggestion is implemented: assert exact executable/argv,
three-second timeout, 64-KiB output cap, and UTF-8 encoding. Current-base focused
12-test rerun and server TypeScript compilation pass. Registered live route and
clean-main rollout proof remain later gates; no live-health success is inferred.
