# Controls selected-job reports — accepted design

Root accepts Option A as a causal refinement of the user-approved full UI audit. Actual selecting completed activationjob40c6d573 displays its completed receipt, but report panels remain globalUnconfigured while exact-job API contains6passing checks. This is an access/binding gap, not corrupted evidence. Preserve deliberate backend latest-versus-exact semantics. Existing user approval and standing owner authorization cover this reversible UI source fix; no credentials/backend/runtime authority changes. Cost if this presentation choice is wrong is reviewed source rework.

Current Source base12299dde8d4dd83152015c3162489729259a4139 already contains separately reviewed cron count fix. One sole MC writer, same branch; combine ordinary source delivery when all mapped tasks pass. Live I5/MC546/SF5a and its actual full8 remain immutable. Required stock build must be in separate nonlive clone because writer dist is referenced by retained unrelated fixtures. All original/new records remain protected.

## Accepted contract

### 1. Visible scope and authority

**Chosen Option A:** Existing report panels show the selected job's exact evidence whenever a selected job ID exists. With no selected job they keep the existing global/latest report view. Add a short visible scope line: `Reports for selected job <jobId>` or `Reports for latest job`. Loading/error copy names the selected job. Keep the three report headings and direct-child `.controls__top` / `.controls__evidence` layout unchanged.

Selected readiness, `session.setSelection`, confirmation invalidation, the manual-check selection hash, and History continue to use only the accepted global envelope. Never write `receipt.selectionHash` or a selected-job envelope's top hash into launch authority. Report scope changes are GET-only and never imply a launch, retry, cancel, `prepareNew`, new idempotency key, or pending-storage clear.

During selected loading, there is no previous-job or global report fallback. Existing `noReport` placeholders may remain, but a separate explicit selected loading status distinguishes local not-loaded from a returned server `unconfigured` state. On selected read error, show the selected job and actual bounded client error code, detach any report not verified for the current accepted receipt, and retain current global readiness/history. A server-returned missing/invalid/unsafe/unconfigured projection remains that projection, including its code.

**Alternative B:** Add a separate selected-job report area while leaving the existing global panels visible. It is sound but duplicates layout and labels, expands visual QA, and makes the immediate operator action harder to follow. **Alternative C:** Rename the current global panels only. This explains the mismatch but does not provide the requested selected report access. Neither is preferred for this small root fix.

### 2. Selected read ownership

Use a small `ControlSelectedEvidenceV1` owner, with injected GET functions and state callback. It owns only reads and local state, has no timers/storage/session/mutation APIs, and performs no request in construction (SSR/import stays inert).

Proposed interface to freeze:

```ts
type SelectedControlEvidenceStateV1 = Readonly<{
  boundJobId: string | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  receipt: ControlJobReceiptV1 | null;
  envelope: ControlEvidenceEnvelopeV1 | null;
  error: string | null;
}>;
type SelectedControlEvidenceDepsV1 = Readonly<{
  readReceipt: (jobId: string) => Promise<ControlJobReceiptV1>;
  readEvidence: (jobId: string) => Promise<ControlEvidenceEnvelopeV1>;
  publish: (state: SelectedControlEvidenceStateV1) => void;
  acceptedReceipt: (receipt: ControlJobReceiptV1) => void;
}>;
// class ControlSelectedEvidenceV1:
// constructor(deps: SelectedControlEvidenceDepsV1)
// activate(): void
// dispose(): void
// select(jobId: string | null, seed?: ControlJobReceiptV1): void
// refresh(): Promise<void>              // receipt GET then forced evidence GET
// refreshReceipt(): Promise<void>       // receipt GET; evidence read on stamp advance
// acceptReceipt(receipt: ControlJobReceiptV1): void
```

`activate` changes no selection and starts no request. `select` always increments the scope epoch, immediately clears old local envelope/error/receipt, then refreshes only when active and job ID is non-null. An optional matching launch seed is accepted through the same revision/ref rules and starts its evidence read. `dispose` increments the epoch and invalidates all success and rejection handlers, including after `activate` is called again on the same instance. Null selection publishes idle and makes no selected GET. Re-selecting the same job is a fresh scope, so A→B→A and same-ID reconnect are safe.

Every receipt read captures `{boundJobId, scopeEpoch}` and a monotonically increasing receipt request sequence. A result/error is usable only while its scope still belongs to the owner. Older sequence responses may advance a strictly newer receipt revision; they may never regress accepted revision, replace a definitive terminal receipt with a preterminal equal/lower revision, or overwrite a newer selected error/success. This receipt rule matters because retaining an ID-only `chooseJob` handler would leave the new evidence lifecycle exposed to A→B→A receipt errors.

An accepted receipt must match `boundJobId`. Its stamp includes revision, state, `finishedAt`, and all four ordered optional report refs (`activationHash`, `resultHash`, `gateHash`, `uiReportHash`), so a safety projection/ref change at the same revision is not ignored. Reject lower revisions. A stamp advance invalidates any evidence request against the older stamp and triggers an evidence read. `acceptedReceipt` is invoked only for an accepted current receipt; the page uses its existing `session.acceptReceipt` and pending synchronization, preserving the session's exact-request checks.

Each evidence read captures `{boundJobId, scopeEpoch, evidenceRequestSequence, acceptedReceiptStamp}`. Success and failure must still own all four before publishing. Starting a new evidence read increments its sequence. The selected state's bound ID is local request provenance, not a fabricated server field. Abort may be added as an optimization, but logical ownership checks remain mandatory.

`refreshReceipt` must not block receipt polling behind a held evidence GET: its returned promise settles with the receipt read, while its evidence request is separately owned and rejection-handled. Keep the page's existing single-flight three-second receipt interval and stop it after the existing definitive terminal predicate. Stop neither the stamp-triggered terminal evidence read nor manual Refresh for a terminal receipt.

### 3. Receipt/report reconciliation and terminal closure

The envelope does not prove a receipt revision. Before publishing an **available** selected report, bind its content to the accepted receipt's refs:

| Report | Required equality |
| --- | --- |
| Activation | `receipt.reportRefs.activationHash === report.hash` |
| Evaluation | `receipt.reportRefs.resultHash === report.resultHash` and `(receipt.reportRefs.gateHash ?? null) === report.gateHash` |
| UI | `receipt.reportRefs.uiReportHash === report.hash` |

Unavailable reports are valid even when the receipt contains the corresponding ref: missing/unsafe/invalid reports must remain visible as unavailable, never manufactured as pass. No ref plus an available report means that evidence is ahead of, or inconsistent with, the accepted receipt. Do not infer terminal state or manufacture refs. Perform at most one reconciliation receipt GET and one follow-up evidence GET for that triggering read; accept newer receipt state through the same rules. If no stable matching pair is reached, show local `CONTROL_SELECTED_EVIDENCE_OUT_OF_SYNC` and no qualified/pass report for that attempt. A subsequent actual receipt advance or manual Refresh may retry. There is no new polling loop or automatic POST.

For the critical terminal race: request E1 begins while A revision 5 has empty refs; A revision 6 is then accepted terminal with final activation hash; E2 reads and displays its report. E1's later unconfigured result **and** later rejection are discarded by the stamp/request ownership checks. Conversely, if an available evidence response arrives before the final receipt, the bounded reconciliation path first obtains/accepts the receipt and matches its hashes.

Different-selection/source/build jobs remain viewable. Preserve the server's `compatibility`, qualification, availability, check rows, and UI provenance exactly, plus the existing different-selection historical warning. This is a read-only report view: historical completion or activation PASS cannot grant workflow GO, launch confirmation, current-source qualification, or access beyond existing controls. Do not add a new stale-job launch/cancel policy as part of this fix.

### 4. Page integration without mutation changes

- Instantiate the owner in a ref without effects in construction; feed its publish callback into one selected-state React state value. Its accepted-receipt callback performs the existing session receipt acceptance/pending synchronization.
- Mount: activate owner, select restored ID once, and independently refresh global evidence/jobs. Cleanup: dispose owner alongside existing session cleanup. New lifetime invalidates every old selected response.
- Recent jobs: keep `session.chooseJob`, selected state/storage ownership, and call selected owner `select(id)`; remove the ID-only receipt promise handler.
- Receipt polling: call `refreshReceipt` under the existing active/in-flight interval ownership. Use the owner's accepted receipt for terminal stop and Owned progress.
- Manual Refresh: independently start global evidence/jobs refresh and selected owner `refresh`. Only global completion may call `session.setSelection`. Global errors and selected read errors have separate ownership and messages.
- Launch: preserve the existing POST, pending mapping, and `result.reveal` decision. Only in the existing reveal branch select the accepted job with its seed receipt. A non-reveal delayed POST must not switch report scope. Preserve the existing explicit session handling of its POST result.
- Cancel: preserve its POST body, gate, and exact selected job behavior. Feed a current returned receipt through selected acceptance; its eventual terminal/ref transition requests evidence. Do not generate a second mutation.
- Render: `globalEnvelope.evidence` supplies reports only if selected ID is null; otherwise use an owned ready selected envelope or local not-loaded placeholders. Render History from global envelope only. Leave report qualification components unchanged.

## Minimal File Map

One coherent source task; do not split delivery into API-only or owner-only commits claiming the operator defect is fixed.

| File | Change |
| --- | --- |
| `src/lib/api.ts` | Add `jobEvidence(jobId: string): Promise<ControlEvidenceEnvelopeV1>` using `controlJobId`, `controlRequest`, strict parser. Existing method/body contracts unchanged. |
| `src/lib/control-selected-evidence.ts` (new) | Small injected selected read owner described above; no timers, storage, session, DOM, or mutation methods. |
| `src/pages/Controls.tsx` | Integrate owner, separate report/global scopes and error ownership, scope text, final ref refresh. Preserve launch/cancel/idempotency gates. |
| `tests/control-evidence-client.test.ts` | Sixth-method wire behavior and refusal cases using mocked fetch only; keep fixed launch/cancel keyset checks. |
| `tests/control-selected-evidence.test.ts` (new) | Deterministic actual-owner promise races, receipt/ref binding, reconciliation, lifetime and no-effect construction. |
| `tests/controls-render.test.tsx` | Only if scope text needs an extracted pure presentational prop boundary; preserve actual existing panel coverage. Do not claim page effects from SSR. |
| `scripts/ui-regression-fixtures.mjs` | Exact `/jobs/:id/evidence` compatibility route before generic receipt route; separate per-job evidence map and conservative unavailable default for known jobs with no final refs. Missing jobs return 404; nonempty refs without configured fixture evidence fail explicitly. Never alias selected evidence to global report data. Keep canonical 317 behavior IDs. |
| `tests/controls-selected-evidence-fixture.test.ts` (new) | Inert actual `fixtureResponse` extraction/evaluation, using existing repository TypeScript-AST/VM testing pattern; exact route, no global alias, strict shape, known empty refs and unknown ID. Do not create a listener. |
| `tests/fixtures/controls-selected-evidence.tsx`, `tests/fixtures/controls-selected-evidence.html` (new) | Tiny actual Controls mount/unmount fixture; imports actual page/CSS, exposes remount only, no Layout/data-sync/backend graph. Root source-browser qualification only. |
| `tests/controls-selected-evidence-browser.test.ts` (new) | Explicitly gated Root qualification of actual page with fully intercepted GET-only per-job/global APIs and controlled held responses. One separately owned browser session; no canonical catalog edits. |
| `tests/fixtures/controls-selected-evidence-owned.ts` (new, Root-owned scope) | Supplemental selected-evidence native custody profile using existing `createUiNativeLifecycleV1`/artifact store and strict manifest of this focused source graph; no old responsive pin changes, canonical worker receipt fabrication, or guard bypass. |
| `docs/superpowers/specs/2026-10-20-controls-selected-evidence-design.md` and matching `docs/superpowers/plans/2026-10-20-controls-selected-evidence.md` | Root writes accepted contract, exact File Map and task/evidence limits in sole writer before implementation. This outside-repo draft is not committed. |

Production backend/Setfarm, report parsing DTOs, session implementation, worker/runtime/credential files, package dependencies, canonical 317 assertion catalog, existing responsive helper pins, `dist`, and `dist-server` are outside the source-change map. If the executor finds a need to change any, return the causal reason and refine the map before edits.


## Evidence and limits

Root actual screenshots/DOM before implementation are in logs/2026-10-20-reviewed-source-release-v1/live-i5-page-audit-v1/07-controls-activation-selected.*. They document the causal live observation, not a fabricated automated RED. A new focused actual-page fixture must obtain genuine causal RED before product implementation; a missing export is unit RED only. Root owns native/browser admission and execution. No wildcard test, real control mutation, paid provider call, DB, selected runtime effect, canonical317 weakening or old responsive helper pin bypass by builders. Strict selected request/ref/epoch and global launch separation is acceptance, not optional polish.
