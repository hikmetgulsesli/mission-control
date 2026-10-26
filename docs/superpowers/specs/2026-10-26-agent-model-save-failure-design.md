# Agent model save failure design — 2026-10-26

Private design for Root's approved UI/functionality objective; no implementation or execution. M=/Users/setrox/ai/setrox/.worktrees/mission-control-auth-order-test-20261021-v1. Source evidence: mc-agent-model-save-readonly-audit-20261026-v1.md, SHA2565574d61cd11ee70ffbd27c8c67eeec80fc29f92b8a66ab4f3fcf71f8d7432660. SourceM b422 is retained source/build identity; live4a is separate. Four audited flow files are identical; no live PATCH was reproduced.

## Root cause and scope

M/server/routes/agents.ts:131-180 writes profiles, suppresses every model get/parse/index/set failure, then returns HTTP200 success with the requested model. M/src/pages/Agents.tsx:58-69 trusts any2xx, bypasses the authenticated shared client, and invokes refresh; AgentEditModal.tsx:58-69 then displays Saved! and schedules close. A refresh failure cannot revoke success.

Fresh-selected loadProfiles returns{} (:49-50), but saveProfiles (:67-81) still accesses legacy configuration before runCli's fence. This is a causal boundary defect in the same save flow: selected installations must refuse before profile access, rather than adding mutable selected-config support.

## Options

1. Recommended: early selected409; retain ordinary profile-before-model ordering; fail model errors with sanitized502, invalidate potentially changed caches, route the caller through the authenticated client, and validate the success receipt. Small surface; explicitly preserves possible partial persistence.
2. Move model first. Prevents profile persistence when model fails but reverses the partial-write problem when profile saving fails; adds ordering change without atomicity. Reject for this bounded repair.
3. Introduce transactional save orchestration/readback/rollback. Could improve certainty but spans independent stores, race/timeout semantics and guard integration. Too broad; rollback could undo another actor's change.

## Final contract

PATCH /api/agents/:id retains known-agent validation and ordinary alias/raw-ID mapping. For an accepted known ID, check freshMissionControlSelectedV1 before loadProfiles, saveProfiles, CLI or cache effects. Return409 `{success:false,error:'AGENT_SETTINGS_UNSUPPORTED'}`; no legacy access, child call or cache invalidation.

Ordinary mode retains profile-before-model order. Mark a profile-write attempt before calling saveProfiles. In finally invalidate profiles and agents caches whenever that attempt occurred, including write exceptions. A write can fail after changing storage; no claim of rollback. Model get/parse/index/set/no-spawn failures return502 `{success:false,error:'AGENT_MODEL_SAVE_FAILED',profileUpdate:'may_have_saved',modelUpdate:'unconfirmed'}`. This deliberately does not assert model unchanged after a timeout. Profile failures return500 `{success:false,error:'AGENT_PROFILE_SAVE_FAILED',profileUpdate:'unconfirmed',modelUpdate:'not_attempted'}`. No raw error or requested model appears in failures. Success is200 `{success:true,id}`; it means existing save operations returned, not that a model is active, provider available, or a matching legacy gateway necessarily changed. No model/changes echo.

Use existing fetchApi authentication via one optional per-call error-mapper argument; other callers retain existing behavior. Add fetchAgentSave(id,changes):Promise<void> and api.updateAgent=fetchAgentSave. It uses JSON PATCH, encoded ID, inherited X-MC-Token, and accepts only success===true plus matching id. Known409 becomes “Agent settings cannot be changed in this installation.” Known502 becomes “Model update could not be confirmed. Profile changes may already be saved. Reload before retrying.” Known500 becomes “Profile update could not be confirmed. The model update was not attempted. Reload before retrying.” All network, malformed/negative2xx, unknown HTTP or parse failures use “Save could not be confirmed. Profile changes may already be saved. Reload before retrying.” No raw response text reaches this flow's UI. No retry. Agents awaits api.updateAgent before refresh; modal's existing awaited callback keeps errors visible and schedules close only on valid success.

The auth repair is causally necessary: source PATCH omits X-MC-Token while common GETs include it; token-configured servers reject the save before the route. Reusing the existing auth mechanism changes no credential or access rule. Current configuration remains unread.

## Global Constraints

Source-only delivery; no service activation, live PATCH, OpenClaw execution, provider call, credential change, or runtime-guard bypass.
Fresh-selected PATCH returns 409 before any profile read/write, CLI call, or cache invalidation.
Preserve existing nonfresh model aliases and exact custom model IDs.
No provider/model catalog refresh, new setting, dependency, or mutable selected-installation support.
All failure responses are non2xx, sanitized, and contain no requested model or raw error.
Profile and model writes are not atomic; partial or unknown persistence must stay visible.

## Validation and review

One coupled task changes route and its caller. Tests compile actual source declarations/callbacks with synthetic ports, following tests/prd-workflow-prelaunch-errors.test.ts and server/services/agent-identity.test.ts. No application import, real fs profile access, HTTP listener or subprocess is needed. Assert zero selected effects, ordinary failure/cache contracts, alias/custom-ID argv, authenticated request and receipt validation, and actual modal callback failure/success behavior. Focused tests, browser TypeScript check, required build and diff check are future sole-writer actions. No verification has run in this document phase. Root reviews these drafts before execution; no extra user approval or runtime authority is inferred. Self-review: one scope, no mutable selected support, no atomicity claim, no provider/catalog change.
