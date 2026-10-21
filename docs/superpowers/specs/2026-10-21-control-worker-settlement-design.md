# Original control worker settlement

## Context and scope

The final selected UI, activation and full-eight runs need evidence from the original fixed Node worker. The current broker retains that ChildProcess but discards its exit code and signal. Its output listeners close redacted log files without recording stream EOF. `ui_final` is accepted before the worker exits, while the native lifecycle's root exit belongs to Chromium. No ordinary readback can reconstruct those missing Node facts.

Root adopts this as a causal refinement of the user's authorized objective to finish and verify Setfarm. Standing Owner Authorization v1 permits the necessary scoped source/test fix. This is not a new user-specific design approval or authority for credential, role, service or guard changes. PR44's current-view UI fix is merged at `0fecb6fc401a4648d4ed7ba30ce0efc97347d26b`; its branch build passed. The merged-main build, rollout and final selected runs remain unqualified.

## Decision

Observe the existing original ChildProcess in its holder, and publish one private, canonical `original-worker-settlement.json` in its existing job directory after the original `close` event. Attach listeners synchronously before setup awaits; retain them through natural closure even when subsequent setup fails. Bind the independently observed original owner only after the existing parent, owner and selected-source checks succeed.

An external wrapper would change the fixed spawn/owner contract. Existing final frames and browser settlement describe different boundaries. Neither alternative supplies the missing original Node observation without changing established authority.

The record binds job/kind, channel, intent, selection, SF source, MC source/build, executable hash, broker PID and the original observed owner/owner hash. It records the actual exit and process-close tuples separately, stdout/stderr `end` and `close` observations, and a bounded set of fixed observation/log error codes. It contains no raw output, environment, token, nonce or arbitrary error text.

`observedFactsComplete` means that owner binding, matching observed exit/close tuples, both real stream EOFs and closes, and error-free observation are present. It does not mean the test passed. A naturally observed nonzero exit remains nonzero; final GO additionally requires the outcome-appropriate numeric exit and null signal. Missing events, owner binding or readable complete publication remain unknown. Absence, HTTP completion, log-file closure and Chromium exit never substitute for Node facts.

Keep existing redacted output logging and its 65536-byte per-log cap. Report log or observation faults through the existing unavailable/error path. Prepend stream-close observation and log-close handlers so log fsync/close and any fixed log error are observed before Node's existing stream-close accounting can emit the original process-close event. Publish with the existing owned-directory/O_EXCL/O_NOFOLLOW/0600 canonical storage primitive and read back exact bytes. Preserve failed artifacts; do not retry, overwrite or delete them. The private record establishes observed facts; its presence does not assert historical success of a failed storage operation.

Catch publisher exceptions inside the original-close listener and invoke the existing fault callback without throwing into the Mission Control event loop. This includes failure after bytes already exist. Preserve those bytes, attempt no replacement publication, and do not reinterpret presence as successful return of the publisher.

Keep the job receipt/final-ACK protocol, public DTOs, UI, channel authentication, fixed argv/cwd, environment stripping, process observation, source checks, cancellation, browser lifecycle and every runtime gate unchanged. Do not add signals, forced timeouts, retries, arbitrary executables, public routes or process adoption. No effects occur merely by importing the new helper.

## File Map

| File | Responsibility |
| --- | --- |
| `server/services/control-worker-settlement.ts` | Inert helper that attaches to one actual ChildProcess, binds its validated owner, observes original events and invokes one private publisher. |
| `server/services/control-jobs.ts` | Attach the helper to the existing spawn, bind the existing observed owner, report existing log faults and publish the fixed private filename. |
| `server/services/control-jobs.test.ts` | Extend the existing actual fixed-child probe to retain its real exit/close/EOF observations and inspect the private record. Add focused integration RED and bounded inert negative cases. |
| This spec and matching plan | Causal scope, evidence boundaries, TDD, review and delivery requirements. |

## Interface

`createControlWorkerSettlementV1(input)` accepts the existing ChildProcess, immutable job/source/channel identity, the fixed executable hash, a private synchronous publisher and a fixed-code fault callback. It returns only `bindOwner(originalChild)` and `noteError(code)`. It exposes no method that can manufacture exit, EOF or close events. It retains the original handle through its registered listeners and emits at most one immutable record.

The helper's owner input is the existing observed owner, verified against the original child's PID and executable. The port continues to obtain and validate that owner itself; worker messages cannot supply this binding. Type-only references must not introduce an import cycle.

## Acceptance and verification

1. Before production edits, a focused actual fixed-child test naturally settles the original exit/close and both stream EOFs, then fails because the private settlement record is absent. Import/setup failures are not RED.
2. After the minimal implementation, the same test passes and the file exactly matches that original PID/owner, intent/channel/source/build and actual event tuples. A nonzero natural fixture exit remains observable as nonzero.
3. Inert negative cases withhold completeness for close without EOF, stream/process/log faults, absent or mismatched owner and mismatched exit/close tuples. A publisher-throws case, before and after simulated byte publication, must invoke the fault path without an uncaught event-loop exception or retry. These are unit simulations, never native qualification or runtime records.
4. Complete focused broker regressions pass on Node22 and Node26 without weakening the existing environment, authentication, idempotency, publication, cancellation or UI-proof assertions. All actual probe children settle naturally under their original handles; no fixture or prior record is deleted.
5. Independent source and actual build review, a clean stock build and ordinary reviewed PR/main delivery precede one current-state guarded MC rollout. Prefer a single rollout containing both PR44 and this necessary evidence fix. The ultimate merged-main stock build must include both; a branch build does not substitute for it.
6. Final selected317, activation and full-eight runs remain unrun until that rollout is qualified. Root then reads the complete original-worker record and joins it to channel/intent/current build and the actual semantic/native outcomes. Keep the old eight failed cases, PM-scalar unrun state and thirteen retained UNKNOWN families separate.
