# Telemetry Safe Read Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use test-driven-development,
> using-git-worktrees, requesting-code-review and verification-before-completion
> task-by-task. Root executes inline as sole writer; agents only research/review.

**Goal:** Replace executable/false-healthy telemetry with an honest steps-only
read that safely carries opaque IDs from client through actual HTTP to SQL.

**Architecture:** The existing route normalizes two parameterized steps SELECTs.
The API validates a bounded versioned response; a pure actual React consumer
renders limited/unavailable truth. One owned actual-source harness proves all
three consumers without loading real config, driver or Setfarm output.

**Tech Stack:** Node26.4, TypeScript5.9.3, Express5.2.1, postgres3.4.8,
React19.2.4/Recharts2.15.4, PostgreSQL17.10. No dependency changes.

**Spec:** `docs/superpowers/specs/2026-10-02-mc-telemetry-safe-read-design.md`.

## Global constraints and File Map

Exactly nine files listed in the amended spec. Root writes only the new own-Git clone
`.worktrees/mission-control-telemetry-safe-read-20261003-v1` on
`fix/mc-telemetry-safe-read`, baselineb677c470/tree da0143. Preserve all old
roots/builds/dirty contents. Package/lock changes are root engine metadata only:
`^22.18.0 || >=24.3.0`, with every dependency and script unchanged. No globalDB/
config/index/auth/service/native changes. Stream limit1048576 decoded bytes; ID limit256UTF8bytes; schema
mission-control.pipeline-telemetry.v1; exact closed wire/reason/SQL/calendar
contracts in spec are requirements for every task.

## Task1: Own the test harness and prove genuine transport RED

**Files:** Create server/routes/telemetry.test.ts and tests/telemetry-render.test.ts.
**Consumes:** exact unmodified route/API/chart plus both actual API local imports.
**Produces:** exported test-only runTelemetryConsumerV1(options) returning actual
owned consumer observations after complete child closure, never a fake response.

- [x] Read/pin raw sources and physical approved dependency leaves; transpile
  in memory with fixed TypeScript options. Syntax diagnostics are harness faults.
- [x] Admit only the reviewed Express/React/Recharts/SSR closure and its pinned
  literal import/require edges; installed-file membership is not execution
  permission. Deny native-addon/dlopen/worker/subprocess/tool/driver origins
  before imports; final manifest must match the original admitted generation.
- [x] Implement one exact synchronous registerHooks mapping; test SQL/config/
  exec ports are explicit, sticky faults cannot be swallowed by route try/catch.
- [x] Gate route test registration to the direct canonical argv[1] entry.
  Independently import-only witness the shared module from an owned child:
  helper export exists, no route registrations or real-SQL selection occurs.
- [x] Prove default/named exports, actual module evaluation once, JSX/SSR parity,
  known secret read and unknown-edge/config/driver denial before delegation.
- [x] Prove server/body/socket/hook/child exit+close/twoEOF settlement. Inject
  port faults only in owned test ports; they are not genuine native failures.
- [x] Execute genuine mounted legacy handler with hand fixture250ms/AVG100ms,
  nominated missing history/denied exec; require versioned limited output:

```ts
const observed = await runTelemetryConsumerV1({ request: '/api/telemetry/run-contract' });
assert.equal(observed.httpStatus, 200);
assert.equal(observed.body.status, 'available_limited');
assert.equal(observed.body.history.reasonCode, 'PRECISE_TRANSITION_HISTORY_UNAVAILABLE');
```

- [x] Separately prove missing query transport returns404 baseline (not unsafe
  handler proof), and actual api.telemetry uses wrong path baseline:

```ts
assert.equal(observed.clientUrl, '/api/telemetry?runId=run-contract');
```

- [x] Run Node26 `--test server/routes/telemetry.test.ts tests/telemetry-render.test.ts`
  with credential-free exact environment; read failures and complete closure.
  Expected semantic assertion failures, not loader/config/DB execution errors.
- [x] Independent harness/RED review before production code.

## Task2: Minimal route and strict client GREEN

**Files:** Modify server/routes/telemetry.ts and src/lib/api.ts; extend route tests.
**Consumes:** existing pgSql tag and validated opaque runId.
**Produces:** shared query/path handler and api.telemetry Promise<TelemetryResult>;
exported telemetry wire/result types, parseTelemetryResponse and ID validator.

- [x] Add tests for quoted/percent/dot/delimiter/plus/Unicode IDs through standard
  URL -> actual fetch -> mounted route -> exact bound parameter. Invalid, duplicate,
  bracketed, malformed, oversize and surrogate IDs perform zero SQL/exec.
- [x] Compatibility tests retain case/trailing-slash/GET/implicit HEAD, and
  malformed path escapes refuse before parameter/SQL processing.
- [x] Implement raw-query single decode and compatibility path normalization;
  request-local400/503; remove subprocess/path/config/history imports and queries.
- [x] Execute exactly two steps-only bound queries; UTC text and numeric day
  plus time-of-day difference; terminal positive finite samples, raw >2AVG before round.
- [x] Add independent exact wire fixtures; reject extra/missing/nested-invalid
  keys, unknown schema/status, malformed calendar, nonfinite/numeric strings,
  duplicate-ID assumptions, wrong run echo and status/body contradictions.
- [x] Implement streamed1048576-byte cap and fatalUTF8 decoding, exact error
  precedence; cancellation/release faults preserve primary normalized failure.
- [x] Content-Type fixtures: application/json and one optional UTF8 charset
  (case-insensitive/quoted allowed) accept; missing/vendor/nonUTF8/extra/duplicate
  parameter/comma-list refuse as invalid_response on expected HTTP statuses.
- [x] Run complete focused tests; inspect actual body/SQL capture and zero exec.
- [x] Execute coherent raw-source mutants for ID decoding/binding, status echo,
  cap boundary, status/body precedence, threshold strictness/current inclusion,
  duration0/calendar/aggregation. Each must fail its real consumer assertion.
- [x] Independent route/client review; fix all critical/important findings.

## Task3: Actual rendered truth, including empty results

Causally required root refinement: an independently found inherited-property
lookup in STEP_SHORT mislabels valid arbitrary human IDs such as constructor,
toString and __proto__. Same chart source file and actual SSR test file; use
own-property lookup, retain group association. Actual RED36/35P/1F at the
expanded boundary/render checkpoint precedes this minimal fix. This remains
part of truthful telemetry rendering, not an unrelated feature.

**Files:** Modify TelemetryChart.tsx; extend tests/telemetry-render.test.ts.
**Consumes:** validated TelemetryResult, unchanged runId prop/api.telemetry.
**Produces:** pure exported TelemetryResult({result}), used by actual chart.

- [x] Write SSR RED: unavailable is never no-data/healthy; limited-history notice
  appears with empty steps, no-duration and valid completed-duration data.
- [x] Implement notice outside empty/no-duration returns, zero-valid bars,
  finite ordered totals; preserve cancellation/loading/reset behaviour.
- [x] Real ReactDOM SSR focused GREEN; actual result-export removal/wrongbranch/
  missingnotice/zero-filter/overflow mutants fail. No mock chart result component.
- [x] Independent actual-consumer review and focused route/client/render rerun.

## Task4: Execute the separately admitted real read-only SQL witness

Actual arithmetic RED after warm refinement: maximum-date one-microsecond
delta expected0.001ms returned0. Independent frozen expectations are retained.
Causally required same-file-map root fix changes both query duration formulas
to UTC integer-day difference cast to numeric before multiplication, plus
numeric time-of-day epoch difference. This avoids timestamp interval overflow
and the whole timestamp-epoch division's fractional loss near the maximum.
Update independently reviewed exact query byte allowlists, never expectations;
require fresh actual SQL proof and exact-source review before delivery.

Historical setup checkpoint: real mode was explicitly selected once and refused
SQL_RESERVE_TIMEOUT (1FAIL/11453.391292ms); no arithmetic qualification. Actual
postgres3.4.8 ReadyForQuery clears initial.reserve and returns without onopen
when fetch_typesfalse, which can strand its queue unless incidental drain
rescues it. This is a source-backed hypothesis consistent with the timeout,
not a captured driver stack or proof that every such reservation fails.
Causally required same-file witness refinement: explicitly whitelist a sole
SELECT 1::integer AS connection_admitted under startup read-only defaults,
require exact one row/value1, then reserve that already-open same backend.
Keep fetch_typesfalse, all seven exact statement bytes/parameters, one socket,
strict deadlines, journal/identity/results and natural cleanup requirements.
No implicit catalog queries, driver mutation or production-file change.

Complete ordinary run100tests/99PASS/0FAIL/1 declared real-SQL skip is not
arithmetic qualification. Driver/secret/network/filesystem admission controls
pass, with real mode requiring explicit MC_TELEMETRY_REAL_SQL_V1=1. Pure
diagnostic projection followed actual missing-helper RED and now preserves
primary, distinct guard and every ordered cleanup error with the first cause.
Fresh selected controls14tests/13PASS/1declaredSQLskip and strict server noemit
pass. Exact-source independent admission and actual live output remain required.

Preparation checkpoint: ordinary route/API/SSR86PASS/0skip is not real SQL.
The separate driver-admission helper has only admission and unconnected-socket
modes at this checkpoint, with no reserve/query/connect code. Actual missing
helper RED then five no-connection controls passed; missing socket-mode RED
then six admission/factory controls passed. Driver construction includes an
inert Subscribe companion: top-level no_subscribe is discarded by parseOptions.
Only a later reviewed implementation may add explicit opt-in real mode.

Frozen migration31 expectation is source-nominated, never current-DB-derived:
031_operational_failure_cause_authority_v3 /
7fba6cf62e2201dc12e64175611e3a77fe780bc5af98a62f5f353281e075ab8f.
Retained Setfarm source d40fa6b9 has an actual getter assertion in
tests/execution-attempts/pre32-journal-identity.test.ts (SHAf0ca10ebc92c11cef13e7a5570c65e3d821448030c7ca30038d7105592840bf3)
and independent receipt-source literal (SHA729d4686b077772c450d9cfd1df0346a99f229383a70b465c93f35147218d0db).
The original ALL includes the unguarded helper test in execution group21.
This avoids a new broad migration-module import; it is not a freshly computed
getter result. A LIMIT32 ordered terminal1–31 journal read checks observed head
and approved v31, not every historical checksum unless explicitly compared.

Real cleanup must attempt ROLLBACK on the same reserved session, release once,
await root client end, then independently await the original raw-socket close.
Every timeout/forced destruction remains failed cleanup despite later closure.
The socket factory owns its5s connect deadline; the driver timer starts only
after that factory resolves. backofffalse is zero delay, never no-retry proof.

**Files:** Existing new server/routes/telemetry.test.ts only; document evidence here.
**Consumes:** exact captured final two query bytes and parameter arrays.
**Produces:** successful PostgreSQL arithmetic/calendar rows and definite closure.

- [x] Independent exact query/typed fixture/whitelist/backend/source checksum
  review before the explicitly selected real witness. No implicit live SQL in
  ordinary tests. Missing opt-in is a declared skip, not qualified arithmetic.
- [x] Fixed primary/user/database/data directory, no secrets/config/discovery/
  retry, one owned connection with read-only startup, one reserved transaction.
- [x] Supply options.socket factory: one pinned raw socket/close promise before
  connect, sticky-deny every subsequent factory request before allocation or
  connect; backofffalse alone does not prohibit internal driver reconnects.
- [x] Verify literal identity/migration31; compose exact unchanged SELECT inside
  outer steps literal VALUES CTE, no placeholder renumbering or actual step rows.
- [x] Compare multiplicity-preserving results for250/400/450, subms, invalid/
  nonterminal, duplicate IDs, BC/AD, wide microseconds/extrema/full-range pair.
- [x] Under the sole opt-in owner, follow mandatory positive SQL with a fresh
  closed exclude-current actual-source mutation. Independently admit only that
  exact candidate, retain24 Q1 rows/parameters, kill normal13-average assertion
  with AssertionError and require all five hand-frozen historical-only averages.
  This control is not ordinary positive SQL qualification.
- [x] Always await ROLLBACK, end and raw socket close; preserve cleanup errors.
  Auth/identity/query failure remains failed and prevents delivery.
- [x] Independent literal output and cleanup review; record actual result only.

## Task5: Scoped verified delivery, preserving runtime authority

Actual PR33 review refinement before merge: remove the workstation UID/GID
constants, not generation comparisons, O_NOFOLLOW, SHA256 or nlink1 protection.
Retain synchronous hooks and actual import-only raw-TS witness; align only
package/lock root engines to the warning-free default stripping floors above.

- [x] Add an actual held-read consumer of realpath(process.execPath); current
  GID80 must expose the existing GID20 assertion as genuine RED. Add existing
  node_modules/.bin/tsc symlink refusal, without creating/deleting any fixture.
- [x] Remove only fixed UID/GID assertions; same actual handle/path metadata,
  one-link, length and SHA256 remain pinned. Observe focused GREEN.
- [x] Check old engine range accepts unsupported22.14/23.4 with npm's actual
  semver consumer. Amend package/lock root metadata only; check unsupported
  versions refuse and22.18/24.3/26.4 admit. This is configuration verification,
  not an executed older-runtime compatibility matrix.
- [x] Run the complete selected focused suite, strict noemit and normal build;
  independently review the exact amended nine-file scope before commit/push.
- [ ] Reply to both actual review threads with evidence and the retained alias
  restriction; request fresh exact-head Codex review and read all feedback.

Current post-review selected verification:120tests/119PASS/0FAIL/1skip,
100200.851292ms. The actual complete current footer is authoritative; earlier
125/124 counters in the historical operational record are not reconciled and
are not used as this head's coverage proof. Both newly added held-read consumers
passed. Strict server noemit and normal isolated build also completed exit0;
the existing chunk-size warning remains visible. Package/root-lock diff changes
only engine metadata, not dependencies or scripts.
The sole skip is the missing-opt-in negative, inapplicable with the real flag
selected. That negative consumer was previously observed passing without the
flag; earlier default116/115 aggregate counters are also historical and
unreconciled, not this head's coverage proof.
The final sole SQL owner completed positive24/13 frozen results and a fresh
current-exclusion semantic control, with exact five historical-only averages
and natural owned closure in both children. Earlier separate combined SQL
also passed1test/0skip2641.8075ms. Earlier
reserve/arithmetic failures remain failed evidence, not erased or counted GREEN.
Normal isolated dirty build passed checks/Vite/server TypeScript; frontend
strict noemit and six compiled unchanged adjacent tests passed. Dirty build
identity is not clean source binding. Final scoped commit/PR/merge and separate
clean-main build remain pending; no live rollout or cutover is claimed.

**Files:** All nine amended scoped files only.
**Consumes:** genuine RED/GREEN/mutants/realSQL and independent reviews.
**Produces:** reviewed normal PR and clean-main build; NOT live cutover proof.

- [x] Run focused tests and proportional unchanged adjacent tests under approved
  exact environment; inspect every skip/failure/closure, no hidden real config.
- [x] Run normal npmrunbuild only in this new isolated root (build deletes its
  own dist/dist-server). Check package/lock and canonical retained hashes.
- [ ] Review diff/filemap/public hygiene; no external logs/journals/PIDs/paths/
  credentials/runtime data. Stage exact nine; conventional scoped commit.
- [ ] Normalpush/PR, request Copilot/Gemini under existing convention, read all
  comments/threads/checks; request acceptance/quota/silence is not review approval.
- [ ] Independent exact-head review, normal SHA-bound merge, noadmin/force/delete.
- [ ] Separate own clean-main binding/build admission and actual build evidence.
  Preserve branch/worktree and old archives. Update external master ledger.
- [ ] Proceed to separately reviewed ordinary P2a slice; native/host effects
  remain under their own exact gates. Never bypass runtime guards for a smoke.
