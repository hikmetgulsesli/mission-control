# Original control worker settlement Implementation Plan

> **For agentic workers:** One coherent task with serialized source edits. Root owns actual commands, native/process evidence, delivery and rollout. A scoped author may write only the named test file before Root's RED; independent reviewers remain non-delivery roles.

**Goal:** Persist the original fixed Node worker's actual exit and real stdout/stderr EOF facts for reliable final Setfarm validation.

**Architecture:** Add one inert original-handle observer and integrate it into the existing fixed worker port. Bind the port's already validated owner and publish one private canonical record after actual process close. Preserve semantic receipts and all existing runtime contracts.

**Tech Stack:** TypeScript, Node ChildProcess/Readable events, existing private control storage and Node test runner/tsx.

**Spec:** `docs/superpowers/specs/2026-10-21-control-worker-settlement-design.md`

## Global constraints

- Sole MC writer is the existing W worktree, branch `fix/control-worker-settlement-20261021`, base merged main `0fecb6fc401a4648d4ed7ba30ce0efc97347d26b`.
- The File Map is exactly the two production files, one existing test file and these two docs. Do not modify public schemas, worker/channel/browser protocol, lifecycle, launch authority, credentials, dependencies, generated products or live releases.
- Retain the original fixed spawn and environment/owner/source guards. No signals, forced timeout, retry, adoption, fake EOF, new route or raw secret output.
- The helper is import-inert and attaches synchronously. It publishes at most once with the existing private storage primitive and exact readback.
- `observedFactsComplete` is observational completeness; numeric nonzero exit never becomes PASS. Existing final frames and Chromium settlement remain separate evidence.
- Preserve every test/cache/artifact and old W/live products. Use a fresh admitted nonlive build location; no wildcard test command.
- PR44's branch build is qualified, but its merged-main build and live button QA remain pending. The final merged-main build/rollout will include both causal fixes.

## Task 1: Capture the existing original and prove the record

**Files:** The exact File Map in the spec.

**Interface:** `createControlWorkerSettlementV1(input)` returns `bindOwner(originalChild)` and `noteError(code)`. The input holds the actual ChildProcess and immutable context plus fixed-code fault/private publish callbacks. The record's explicit schema, actual exit/close tuples, EOF/close booleans, original owner and context must be typed in the helper; no test-only production methods.

The helper exports these exact types. `ChildProcess`, `WorkerChannelBindingV1` and `UiObservedOwnerV1` are type-only imports from Node, the existing broker and the unchanged UI worker protocol respectively.

```ts
export type ControlWorkerSettlementErrorV1 = 'CHILD_ERROR' | 'STDOUT_ERROR'
  | 'STDERR_ERROR' | 'STDOUT_LOG_ERROR' | 'STDERR_LOG_ERROR' | 'OWNER_BINDING_ERROR';
type ExitTupleV1 = Readonly<{ code: number | null; signal: string | null }>;
type StreamFactsV1 = Readonly<{ endObserved: boolean; closeObserved: boolean }>;
export type ControlOriginalWorkerSettlementV1 = Readonly<{
  schema: 'mission-control.control-original-worker-settlement.v1';
  subject: 'original_fixed_node_worker';
  jobId: string; kind: WorkerChannelBindingV1['kind']; channelId: string;
  intentHash: string; selectionHash: string; sourceSha: string;
  mcSourceSha: string; mcBuildHash: string; executableHash: string;
  brokerPid: number; originalChild: UiObservedOwnerV1 | null; ownerHash: string | null;
  exit: ExitTupleV1 | null; processClose: ExitTupleV1 | null;
  stdout: StreamFactsV1; stderr: StreamFactsV1;
  errors: readonly ControlWorkerSettlementErrorV1[];
  observedFactsComplete: boolean; recordedAtUTC: string;
}>;
export type ControlWorkerSettlementInputV1 = Readonly<{
  child: ChildProcess; binding: WorkerChannelBindingV1; executable: string;
  executableHash: string; selectionHash: string; sourceSha: string;
  mcSourceSha: string; mcBuildHash: string;
  hashOwner(owner: UiObservedOwnerV1): string;
  publish(record: ControlOriginalWorkerSettlementV1): void;
  onFault(): void;
}>;
export function createControlWorkerSettlementV1(input: ControlWorkerSettlementInputV1): Readonly<{
  bindOwner(owner: UiObservedOwnerV1): void;
  noteError(code: ControlWorkerSettlementErrorV1): void;
}>;
```

- [x] Extend `probeWorkerEnvironment` in the existing broker test with actual original stdout/stderr `end` promises alongside its existing exit/close promises. Await all originals before restoring mocks/environment. Inspect `original-worker-settlement.json` only after settlement, returning null when absent. Retain every fixture.
- [x] Add the actual integration assertion under the exact name `fixed real child records original exit and both output EOF`. Reuse activation/UI fixed synthetic worker fixtures; compare the record to real original observations and bound intent/channel/source values. Keep any new helper import inside separately selected unit callbacks so the old product's RED is the missing file, not a loader error.
- [x] Root reviews/freezes the exact tests plus existing broker/dependencies and admits the fixed private Node-only fixture. Run physical Node22 with `--import tsx --test --test-name-pattern '^fixed real child records original exit and both output EOF$' server/services/control-jobs.test.ts`. Preserve actual exit and both original streams. Require the missing-record assertion after successful original settlement.
- [x] Implement the typed helper with synchronous listeners for original child exit/error/close and both streams' end/error/close. Keep facts immutable at publication. Bind only the existing validated original owner; reject mismatched PID/executable or repeat binding. Accumulate fixed bounded codes and withhold observational completeness for missing/error/mismatched facts.
- [x] Catch synchronous publisher failures inside the original child-close listener, invoke the existing fault path, and return without retry, overwrite or uncaught callback exception. Add inert publisher-throws tests both before and after simulated bytes exist; preserve the fact-only meaning of any retained record.

```ts
const settlementFile = path.join(dir, 'original-worker-settlement.json');
const settlement = createControlWorkerSettlementV1({
  child: childHandle,
  binding, executable, executableHash,
  selectionHash: selected.selectionHash, sourceSha: selected.sourceSha,
  mcSourceSha: selected.mcSourceSha, mcBuildHash: selected.mcBuildHash,
  hashOwner: selected.channel.hashObservedControlWorkerOwnerV1,
  publish(record) {
    const bytes = controlBytesV1(record);
    exclusive(settlementFile, record);
    if (!readControlPrivateFileV1(settlementFile, 16384).equals(bytes))
      fail('CONTROL_STORE_UNCERTAIN');
  },
  onFault() { enqueue({ reason: 'error' }); },
});
// Existing parent/owner checks and selected.assertUnchanged remain authoritative.
settlement.bindOwner(originalChild);
```

- [x] Integrate that observer in `createFixedManualWorkerPortV1` before setup awaits. Keep the existing message/disconnect/exit/error queue, redacted log handlers and environment/spawn statements. Add fixed-code `noteError` calls to existing log failure branches; do not expose raw error messages.
- [x] After genuine RED, run the identical focused integration to GREEN. Run the complete explicit broker test file on Node22 and Node26, including existing full8 environment subprocess coverage. Add the inert negative cases required by the spec and a natural nonzero original case. Do not credit skipped native tests or simulated events as runtime closure.
- [ ] Review the complete diff against the spec and obtain independent specification/quality review. Fix concrete findings with their own focused verification.
- [ ] Root commits/pushes the scoped branch under Standing Owner Authorization v1, qualifies a clean stock build in a fresh physical nonlive checkout and delivers through normal reviewed PR/main. Do not claim the optional GitHub automatic review complete while it is running; monitor actual comments and repair actionable findings.
- [ ] Qualify the final actual merged-main stock build containing both fixes. Use its actual identity/counts/original capture in the binding-only successor MC actor/outer/collector; preserve all predicates, source/material/native/role/DB/control/legacy/SF guards and the 64-recipe cap.
- [ ] After current admission and actual guarded rollout/settlement, verify the live current-view button click and reload. Then run final selected317, activation and full8, requiring the new original-worker evidence as well as the existing semantic and native proofs.

## Root self-review

This task adds missing observations in the process that actually owns the handles. It does not reinterpret a browser or HTTP result. The File Map owns both the observer and its integration; tests reuse the existing real fixed-child probe rather than introducing a replacement transport. Delaying the single final rollout until this causal evidence fix is included avoids repeating the protected service transition. No required final test, main build, cutover or overall GO is claimed complete.

## Verified progress before complete broker regressions

Root observed the exact missing-record RED on Node22 test command43168 after synthetic original worker43172 naturally exited0/null with both stream EOFs and closes. The unchanged focused testcase passed on command48406 after the implementation; original worker48413 exited0/null, and its1379-byte canonical0600 record matched original events, owner/hash, intent, executable and fixture context. The actual broker PID was48408, separate from the test command PID. Initial implementation review was C0/I0/M0.

The log-close handler is prepended after the observer close handler, yielding log fsync/close and error note, observer stream-close fact, then Node internal close accounting. The existing process-close event remains the publication boundary.

Natural exit7, healthy UI/full8 record checks and bounded inert negative cases are authored in the existing test file. Fresh complete Node22/26 execution passed; final review delivery remains pending. Inert events supply no native/runtime qualification. The synthetic probes deliberately retain ownership_unknown semantic receipts; their observational completeness supplies no real activation/full8/GO credit. Final merged-main build, rollout and selected317/activation/full8 remain unrun.

The first complete broker run on Node26 passed74/74, including the isolated full8 environment harness19/19. Node22 passed73/74; its full8 harness used the existing `exports` mock option, which produces no named config on Node22. Root preserved the failed result and made a test-only compatibility correction: Node22 uses `namedExports`, while Node26 retains `exports`. The mock target, mutable config, restoration, actual child transport and every environment assertion remain unchanged. Fresh complete runs passed; final review delivery remains pending. Official references: [Node22 mock.module](https://nodejs.org/download/release/v22.23.1/docs/api/test.html#mockmodulespecifier-options), [Node26 mock.module](https://nodejs.org/download/release/v26.4.0/docs/api/test.html#mockmodulespecifier-options).

Fresh complete broker commands57883(Node22) and58146(Node26) each naturally exited0 with both original capture EOFs, no capture errors, no signals and no forced timeout. Both reported74PASS/0FAIL/0SKIP; their isolated full8 environment harnesses each reported19PASS/0FAIL. Root read all output and independently rejoined each natural0/7 private record to actual original events, canonical0600 bytes, owner/intent/executable hashes and fixture context. The failed first Node22 result remains preserved. Unit simulations and synthetic environment cases supply no live/provider/native-browser or final-selected run credit. Final Source review seal/readback, stock build, normal PR/main delivery and guarded rollout remain pending.
