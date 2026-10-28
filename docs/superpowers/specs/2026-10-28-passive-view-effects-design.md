# Passive view effects

## Objective and authority

Complete the already approved operator UI read/effect separation. All technical tools remain available. Opening a plan or polling a board must not imply provider retrieval, unrelated task activity, or a V3-triggered legacy lifecycle rescan. Existing ordinary reversible source/test delivery is covered by the owner's prior UI approval and Standing Owner Authorization v1. This narrows source-confirmed defects in that objective; it authorizes no live provider invocation, credential change, worker test, data cleanup or service action.

## Confirmed source behavior

At source370376, InlinePlanView fetches Design in its shared mount/3s Promise.all even on Contract; the Design tab is hidden until screens exist. Design GET conditionally lists provider screens, creates/copies cache and downloads artifacts, including a provider fallback before local inspection. A slow response also delays Contract. The Tasks GET sync touches updated_at on every in-progress row when any active run has stories, making unrelated work appear active in TaskBoard. Pipeline transition detection includes V3 completions before calling a legacy-only rescan; V3 rows are excluded later, but their completion can trigger work on other legacy runs. These are source facts; no live occurrence or provider call was induced during the audit.

## Chosen design

A local read plus explicit retrieval is the complete Design fix. Client-only tab gating would still make a view invoke providers and can strand a hidden Design tab. Background automatic retrieval would add worker ownership and provider policy beyond this task. Keep existing local viewing and retrieval functionality, with their effects explicitly separated.

### Tasks activity

Remove only the blanket in-progress timestamp touch. Actual matched status transitions still update their own status and timestamp; manual edits keep existing behavior. Preserve story mapping, throttling, selected preprovision checks, restricted-store behavior and legacy schema setup. This is not a redesign of task/story association or a claim all Tasks GET paths are pure reads.

### Pipeline transitions

Newly finished/started V3 runs must not trigger the legacy auto-sync/create paths. Preserve legacy transition behavior, cache/stale-refresh behavior, sync-state persistence, explicit POST synchronization and canonical V3 scheduling/transfers. Do not disable lifecycle synchronization globally or rewrite project/run visibility. A mixed transition still performs the required legacy work once.

### Design read and retrieve

Existing GET /api/setfarm/runs/:id/design reads recorded metadata and already available local artifacts only. It must not invoke provider commands or create/copy/download cache artifacts. Existing guarded artifact URLs and tokens remain usable for saved files; missing files are represented as local absence, not proof that the provider has no design.

Local discovery and guarded URL projection must also work without a provider project ID when a completed usable Design record and repo-local manifest, screen map or HTML artifacts identify saved files. Retain the incomplete/no-output short circuit and every selected-path guard; a missing project ID must not prematurely return raw metadata when local files can be resolved safely.

Add POST /api/setfarm/runs/:id/design/retrieve for the existing retrieval work. It returns the same Design response shape after retrieval. Keep selected-installation, project/screen ID, path, symlink, source/repository and metadata rechecks at their existing sensitive boundaries. No new credentials, provider permissions, generation, run control or relaxed path fallback. Preserve the existing no-design/incomplete-run short circuit; errors must be visible to the caller rather than an invented successful empty result. Retrieval remains an explicit user action, never polling, mount or retry of a local read.

Provider listing/population/download failures return a non-success response with a safe visible error; do not swallow them into200 empty or successful retrieval. Missing retrieval prerequisites must also be explicit. On partial failure keep existing and successfully retrieved local artifacts, perform no destructive rollback, and let subsequent local GET show what is available. A valid empty provider response is distinct from an exception or malformed response. The client retains accepted local screens while showing retrieval failure.

### Client behavior

Contract/Overview/other plan tabs do not call Design GET or retrieval during their shared3s polling. Design has its own read lifecycle when explicitly selected. The Design tab and an Overview route to it remain reachable even before data is loaded or when plan/contract loading fails; show a count only for accepted local data. Preserve the existing story fallback inside the reachable view rather than letting an early return hide Design. Preserve all other tabs, tokens, screenshots, HTML links and existing styling. A slow Design read cannot block Contract.

The Design panel distinguishes loading, local empty, read error and retrieval pending/error. Its existing-style Retrieve design button performs exactly one POST per explicit click and is disabled while pending. No duplicate retrieval from double click, polling or StrictMode-like setup/cleanup. Run replacement/unmount invalidates stale reads and retrieval completions; late work may finish on the server but cannot update the wrong run. Retry of a local read is separate from provider retrieval. Do not add implementation paths or credential text to the product UI.

## Verification and delivery

Use actual source callbacks and component lifecycle at modeled SQL/clock/FS/provider/API ports; do not import/start an operational server or call live DB/provider services. Establish causal before/after tests for each changed behavior. Preserve existing selected-path/traversal/refusal tests and update their old GET-population expectation to explicit POST. Test client passive access, explicit read/retrieve, pending deduplication, slow Design independence, run-change/unmount fences, and reachable empty/error states. Existing SSR-only render checks do not qualify effects; use the repository's lifecycle harness and report its scope.

No new dependency or broad refactor. Reuse the existing isolated sole writer and installed dependencies, use a scoped PR branch, serialize code changes and independent task review, and run focused checks plus one final stock build. Private runtime evidence and source-qualification helpers remain untouched and uncommitted. Current live370 remains running during implementation. Any later internal rollout is a separate Root-owned guarded step; full8/annual/overall limits and the cancelled extra worker stage remain unchanged.
