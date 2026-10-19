# Overview Observed Agent Truth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the actually observed roster and honest workflow mappings instead of inventing a working CEO or replacing an observed agent name.

**Architecture:** Reuse the roster and canonical active-run observations already gathered by `/overview`. Produce one summary row per observed agent, explicitly distinguish unavailable input, and label step mappings as mappings. Keep the existing technical panels and static Setfarm role templates; identify bundled model configuration as local defaults.

**Tech Stack:** TypeScript ESM, Express, React SSR, existing Node test/module-mock conventions.

**Spec:** User-approved page audit and functional correctness objective; existing `docs/superpowers/specs/2026-10-19-operator-workspace-design.md`. Concrete causal Source proposal is `.superpowers/sdd/2026-10-19-controls-jobs-ui-regression/overview-roster-model-truth-readonly-proposal-v1.md`, SHA256 `e76bc346233ad127bf069319f699876c96ccc12c5e0bf4bc1f2f4306523221c9`.

## Global Constraints

- Root observed live I4: one registered `main` agent named Rune and zero runs, while Overview displayed Arya / CEO orchestration /1 of14 ACTIVE. Preserve that historical observation.
- No provider/price updates, billing discovery, credentials, SQL, service actions, new routes, CSS redesign or changes to shared static agent catalogs.
- Preserve `AgentMiniGrid` and its explicit Static default / Provider unknown contract.
- Reuse the existing canonical operational active-run filter. Do not infer actual agent ownership or activity from a workflow-role mapping or recent session timestamp.
- Source changes are serialized after the worker-environment task. Do not modify that task's files.
- Actual providers, live ports, real SQL and private credential reads are prohibited in tests. Existing dummy-module/ephemeral-local-HTTP fixtures are permitted.
- No test-only production props, exports, environment selectors or generic observation framework.

## File Map

- Modify `server/routes/overview.ts`: observed roster summary using the existing gathered inputs, without a second getRuns or forced main activity.
- Modify `src/lib/types.ts`: minimal observed identity and availability fields consumed by Overview.
- Modify `src/pages/Overview.tsx`: observed names/counts, distinct empty/unavailable/mapped states, local-config provenance and unknown quota display.
- Modify `server/routes/overview.test.ts`: causal actual route producer regression with dummy modules and owned HTTP.
- Create `tests/overview-truth.test.tsx`: actual Overview SSR against controlled existing store/polling/API module seams.
- This plan documents scope; no other Source files may change without Root's concrete ruling.

### Task 1: Derive and render observed agent summaries

**Interfaces:** Preserve the existing `/overview` route and other data fields. `agentSummary` may be `null` when the roster was unavailable and `[]` only after a successful empty roster. Summary identities must prefer observed `identityName`, then observed `name`, then the actual ID; no AGENT_MAP name replacement. Add only the identity/availability typing required by the existing consumer.

- [x] **Step 1: Causal RED.** Extend the existing isolated route fixture: observed main/Rune, no sessions and zero runs must produce one row, zero work mappings and no CEO orchestration. Exercise the actual route producer, not a hand-authored summary. Add actual SSR checks for Rune and the observed denominator. Retain original failing output before implementation.
- [x] **Step 2: Minimal producer repair.** Pass the successfully gathered roster and canonical activeRuns into the summary builder. Remove the unconditional main working entry and static14-row expansion. Preserve observed additional IDs rather than filtering them through the role catalog. Reuse session data only for lastActivity. A matching running step may produce a clearly prefixed `Mapped running step` label, never a claim of observed ownership. Unknown/terminal steps produce no mapping. Unavailable runs yield unknown mapping state; unavailable roster yields null, not a manufactured idle/empty roster. If agentCount previously collapsed unavailable to zero, make that count nullable and render unknown explicitly.
- [x] **Step 3: Minimal presentation repair.** Render observed identity or ID, with a neutral fallback icon when an observed icon is absent. Use an explicitly named running-step mapping count instead of ACTIVE. Distinguish observed empty roster, unavailable roster, no mapped running step and unknown mapping state. Preserve all existing cards, links and technical tools.

  Relabel MODEL LIMITS as `LOCAL MODEL CONFIGURATION`. Add visible text that plans, prices and agent assignments are configured defaults and account billing is not verified. Preserve their values. Missing quota must display `Usage unavailable`, with no zero-valued usage/progress claim; an explicit observed used=0 must still display0. No external billing/provider query.

- [x] **Step 4: GREEN and boundaries.** Check actual producer behavior for one Rune/zero runs, successful[], unavailable roster, additional observed ID, mapped running step, terminal/unknown step, unavailable runs and no duplicate getRuns. Check actual SSR identity/count/escaping, empty versus unavailable states, explicit mapped wording, local-config provenance and missing quota versus explicit0. Keep existing mini-grid tests unchanged and passing.
- [x] **Step 5: Verification and review package.** Run the changed route/SSR tests, existing mini-grid model tests, client/server type checks and diff check, with dummy config only. Retain exact originals, original child/server settlement, command/source hashes and full outputs. No provider or live service effects. Root performs independent task review, scoped commits, final whole-branch review/build and PR delivery.

## Actual post-delivery verification

Root checks the real Overview at390/768/1440 widths after the new MC release is deployed. Current SF83/I4 and its approved private Stitch binding remain unchanged. Actual selected activation must be repeated after the worker fix, and its stored report must pass before full8 admission. Existing historical UI317/owned Task4/compiled17 evidence is not relabeled as rerun on this new build.

## Scope decisions

- Ruling: Correcting invented Overview work is required by the user's approved page-by-page accuracy audit. Cost if wrong: revert the small producer/display change; preserve the original live observation.
- Ruling: The clearly labeled static Setfarm role templates stay available because the user uses all technical tools. Cost if wrong: a later explicit presentation preference can collapse them; no technical capability is removed now.
- Ruling: Local model configuration receives a provenance label and missing-data treatment; no provider pricing is asserted or changed. Cost if wrong: adjust the label without altering configured values.

## Progress ledger

- Task 1: source and focused verification complete; original causal RED retained; final route/SSR and unchanged mini-grid pass, client/server types and diff check exit0.
- Task 1: independent spec compliant / Approved; C0 I0 M2, report SHA256 `0a76043197f7398a8853a8d64233221bd5e972990fb55aeb22963a02b86ec701`.
- Task 1: minor (deferred): unavailable-run/projection tests use every without explicit retained roster cardinality; final whole-branch review must triage.
- Task 1: minor (deferred): exact expected test-only Node module-mocking warnings retained, not product failure.
- Post-delivery responsive geometry, actual activation report and full8 remain pending. Current live MC remains0e323e79; no deployed-fix claim.
