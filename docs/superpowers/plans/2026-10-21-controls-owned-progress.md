# Controls owned progress implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Root executes verification; workers author Source only.

**Goal:** Make accepted selected-job progress, Recent jobs and cancellation controls reflect the same canonical receipt without changing pending intent or backend lifecycle.

**Architecture:** Use the validated selected receipt for the selected list row; apply one explicit cancel eligibility predicate in the view and handler; distinguish accepted pending intent from unresolved submission. Keep the existing selected evidence owner and session as authority.

**Tech Stack:** React19/TypeScript, node:test, existing owned Playwright/Vite HTTP fixture.

**Spec:** ../specs/2026-10-21-controls-owned-progress-design.md

## Global Constraints

- Existing sole MC writer worktree; branch fix/controls-owned-progress-20261021 based on4a8458316b9826545cdf8508bbab43e80f161f37. Preserve all technical tools/pages.
- Root alone executes tests/native/HTTP/runtime and Git delivery. Source-only workers make no service or storage effects and spawn no agents.
- Preserve UNKNOWN as nonterminal, same idempotency key, both persisted pending values, exact selected ownership/epoch checks and broker fail-closed admission.
- No production backend, auth, session terminal rules, fixture custody guards, native launcher, credential, provider or retained-record changes.
- No live rollout until the current Setfarm orphan reservation is correctly retired and current evidence gates pass.

## File Map

| File | Role |
|---|---|
| src/pages/Controls.tsx | Minimal selected row consistency, bound pending copy, cancel eligibility predicate and handler guard. |
| tests/controls-selected-evidence-browser.test.ts | Real mounted Controls regression via existing owned fixture; preserve its acquisition/cleanup and existing cases. |

### Task 1: Write the failing browser regression

- [ ] Read existing owned browser fixture and current selected-evidence tests. Add one case `selected unknown progress updates recent jobs and prevents repeat cancellation` without editing production or ownership helpers.
- [ ] Initial list returns starting revision2,0of8 for selected full8 job; selected GET next returns revision14,ownership_unknown,1of8,cancelRequested=true,finishedAt=null. Use fixture HTTP controls and real UI/session launch or existing canonical test setup, not injected React state or hidden storage mutation that bypasses the real flow.
- [ ] Keep an older list response delayed until after the newer selected receipt. Assert Owned progress and the selected Recent jobs button both display ownership unknown and1of8 after it arrives. Assert the cancel control unavailable and no cancel POST; accepted-pending text accurate. Snapshot both actual pending storage bytes before polling and compare after. No PASS/cancelled/closed inference.
- [ ] Preserve a known-live cancellation positive control and existing pending-key tests. Scope API request observations to this fixture. Report exact changed file and expected first failing assertion; do not run tests or modify production.
- [ ] Root reviews the frozen diff then runs the existing guarded owned-browser test recipe; capture original process/exit/streams/fixture closure. Skips/launcher failures are not RED.

### Task 2: Apply the minimal UI fix after genuine RED

- [ ] In Controls.tsx use exact job identity plus nonregressing receipt revision to project the selected recent row from validated selected receipt; do not duplicate parsing/authority logic or add network polling.
- [ ] Add one cancel eligibility predicate used in rendering and handler. Require known live receipt, cancelRequested=false, not terminal and not busy before key creation/API call.
- [ ] Distinguish bound accepted pending text from unresolved submission using existing pending/job identity; do not clear or rewrite pending storage.
- [ ] Root reruns the same browser case and focused session/evidence/render tests, then independent review. Root commits Source, performs required stock build from clean branch and retains raw captures. No Source/helper guard weakening to get GREEN.

## Delivery limit

This fixes presentation and duplicate action affordances only. It does not retire an orphan owner or qualify full8. Reviewed branch/PR delivery and service rollout retain their existing independent Source/build/runtime guards.
