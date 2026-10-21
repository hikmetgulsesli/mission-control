# Controls: return to current evidence

Root accepts this small causal refinement of the already approved UI audit and selected-evidence design. The live fdd9 installation has no jobs, but the origin-wide remembered UUID selects a job from the previous installation. Its correct 404 leaves all report panels scoped to that missing job, with no way to return to the successfully fetched current envelope. Current observations are retained in `logs/2026-10-20-reviewed-source-release-v1/mc-auth-order-controls-stale-job-static-triage-v1.md` in the parent workspace. The user approved the full UI work, uses every technical tool, and asked to continue autonomously. No new authority or new design approval is claimed.

## Decision

Add **Show current evidence** beside Refresh evidence when a job is selected. Route it through the same local selection handler with a null job ID. Clear only the remembered browsing selection. The existing selected-read owner already supports null selection and fences its late reads; the session must accept the nullable browsing choice so its version also fences delayed launch reveal. Keep pending request identity, its stored mapping, selection authority, confirmation, cancellation and backend job state unchanged.

No selected report is replaced by global evidence until the user explicitly changes view. A valid historical job remains selectable and labelled historical. Current/latest evidence uses the already accepted global envelope and its actual availability codes. Missing source/build identity stays unknown; this fix does not invent identity fields.

Alternatives considered: automatic reset on an absent job would hide an intentional historical selection/error; removing remembered selection entirely would discard useful operator continuity. The explicit action is the smallest reversible fix and keeps all technical tools available.

## File Map

| File | Responsibility |
| --- | --- |
| `src/pages/Controls.tsx` | Conditional return action and nullable local selection handler; existing storage/read-owner/epoch path clears the view. |
| `src/lib/control-job-session.ts` | Permit null in `chooseJob`; preserve its existing version fence and every pending/launch rule. |
| `tests/controls-render.test.tsx` | Actual page SSR with an isolated remembered old UUID exposes the missing action; no-selection view omits it. SSR proves visibility only. |
| `tests/control-job-session.test.ts` | Deferred launch after explicit null selection cannot reveal/reselect; pending request and exact key remain reconnectable. |
| `tests/control-selected-evidence.test.ts` | Null selection clears a missing-job error and rejects delayed receipt/evidence completions without starting requests. |
| `tests/controls-selected-evidence-browser.test.ts` | Add one tightly scoped actual-page case for preserving a global Evidence error across explicit return. Reuse the existing private GET-only fixture, original response-consumption barrier and every native/socket closure gate. |
| This spec and matching plan | Scope, acceptance, exact verification and evidence limits. |

No backend, parser, protocol, runtime artifact, credential, dependency, canonical 317 fixture, existing owned browser profile or generated output edit is in scope. The existing sole MC writer is reused on a new PR branch from reviewed main d5f58ace; live releases and the old fixture worktree remain untouched. Root serializes edits and owns actual commands, build, delivery and live QA.

## Acceptance

1. A remembered selected UUID renders the explicit return action; the ordinary current view does not need it.
2. Clicking it clears the selected ID and its persisted browsing key, restores current/latest scope, and causes no launch/cancel/new-request mutation.
3. Late selected reads cannot restore the previous job or its reports. A delayed launch retains its exact pending identity but cannot take over the cleared view.
4. Historical selection and missing-job errors remain truthful before explicit return; current global availability codes are displayed afterward.
5. Focused inert regressions and stock build pass. Root live QA after reviewed delivery verifies click, reload persistence, current availability and no new job. The old broader UI fixtures and final selected 317/preflight/full8 are separate gates.

SSR action visibility is the genuine pre-implementation RED for this presentation defect. Existing session/owner behavior checks may already pass at runtime despite the old non-null TypeScript signature; do not label them newly fixed failures. No browser interaction or live current-envelope result is inferred from SSR.

## Review refinement: unrelated errors stay visible

Independent review found that reusing `chooseJob(null)` also reuses its unconditional shared `setError(null)`. That would hide global Evidence/Jobs or uncertain launch/cancel errors without resolving them. For null selection, preserve the shared error; the selected owner already clears only its own selected error. Keep existing non-null selection behavior.

Qualify this through the existing owned source-browser harness: first establish exact selected A evidence, then deliver a held global Evidence503 with an exact public error and observe its original response/body consumption and visible alert. Explicitly return to current view. The same alert must remain; the current scope, cleared selected browsing key, unchanged pending bytes and GET-only ledger must also hold. Add a narrow current-view causal RED predicate only for this observed missing-alert bug after positive setup and strict cleanup. Acquisition, consumption, native, socket, source-pin or cleanup uncertainty remains UNKNOWN. Do not change canonical lifecycle/protocol pins, zero/peer closure rules, origin/method guards, idle-timeout policy or existing scenario semantics. The old general selected-error fallback remains outside this fix.
