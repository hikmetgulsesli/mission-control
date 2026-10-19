# UI clone observed readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing clone assertion observe the applied PRD intent before judging its exact value, while retaining failure for a permanently missing or wrong value.

**Architecture:** The existing fixture invokes the actual browser UI. URL navigation precedes the PRD passive initialization effect; a bounded DOM condition establishes that the one description textarea contains the exact expected description. Keep the subsequent exact assertion, History interaction, preservation assertion, and all existing fixture identities and guards.

**Tech Stack:** Existing Node/TypeScript tests, TypeScript AST extraction, node:vm, maintained browser fixture.

**Spec:** `docs/superpowers/specs/2026-10-19-operator-workspace-design.md`, outcome 5 and honest evidence constraints. This is a causally necessary correction to its existing clone/history regression, within the user's approved complete-audit objective.

## Global Constraints

- Root alone stages, commits, pushes, reviews delivery and changes services. One Source implementer in the existing sole MC writer; no live release edits.
- Live SF83/I4/MCfa41 remain frozen during actual full8. No service transition until its original owned job settles.
- Preserve the failed UI job/report and its 300 passes, one failure and 16 unexecuted behaviors. The failed textarea value was not captured; a transient race remains a diagnosis to test, not an observed original value.
- No provider calls, runtime mutation, real browser control, SQL, key/ACL changes, npm-ci, package changes, guard/suite weakening, broad cleanup or unrelated UI fixes in this task.
- Retain all 317 assertions, all 20 routes, three widths, 48 run tabs and 29 behaviors. Do not change fixture data or acceptance value to make the failure pass.
- The actual full8 recipe and admission/runtime/ownership gates are independent and unchanged. UI qualification remains failed until a fresh complete report passes.
- Use the existing source-language and path contracts. Preserve all scratch/evidence/worktrees.

## Evidence and File Map

Actual UI-origin job `051790e6-d7ce-475e-a0cc-15241bb2adad`, report `ba7508436942ec4338d4bbba53dc6e5fa3b4d7139f12d5ebe11d64182089b870`, stopped at first clone equality. Original public capture: workspace `logs/2026-10-20-mc-only-rollout-v1/ui-job-first-complete-original-v1.json`. No clone capture exists, so the later History preservation equality was not reached. Producer, initializer, store and PRD page are unchanged by PR37. Root's live CUA clone action populated the real A101 title/description, but uses different data and does not by itself prove the original fixture transient.

| File | Responsibility |
|---|---|
| `scripts/ui-regression-fixtures.mjs` | Await exact observable clone description before the existing first equality in `prd.clone-a101`. |
| `tests/ui-regression-contract.test.ts` | Invoke the actual extracted private behavior and its actual DOM callback with delayed, missing and wrong independent inputs. |
| This plan | Causal scope, verification and recorded decisions. |

### Task 1: Exact clone form readiness

**Consumes:** Existing `behavior('prd.clone-a101', {page, loaded, capture})`, the fixed A101 fixture, and the current `assert` implementation. Follow the actual AST extraction pattern used by the agent-panel readiness test.

**Produces:** The same behavior and fixture contract, with bounded observed readiness. No new public endpoint or product API.

- [ ] Add deterministic tests before modifying the fixture. URL completion leaves a previous/empty description; hold rendering until a deferred promise is released. Prove the actual behavior waits, with no History action or capture before the expected value appears. Then release the expected value and verify the existing History/capture/close/preservation sequence completes.
- [ ] Add independent permanently wrong, missing and ambiguous textarea inputs. Execute the actual readiness callback against them, assert it remains false, simulate its bounded timeout, and require rejection with no History/capture. Include changed-after-History input to retain the existing preservation failure.

```ts
assert.equal(waitedBeforeRender, true);
assert.deepEqual(beforeReleaseEvents, ['loaded-scrape', 'clone', 'url']);
assert.equal(readyWhenDescriptionIsWrong, false);
assert.equal(readyWhenTextareaIsMissing, false);
assert.equal(readyWhenTextareaIsAmbiguous, false);
assert.equal(historyActionsBeforeReadiness, 0);
```

- [ ] Run the focused new test by its exact node:test name and retain original causal RED. The old behavior must fail because it reads the pre-render value without waiting, rather than from test setup/import failure.
- [ ] Add one bounded `page.waitForFunction` immediately after the existing `waitForURL`: require exactly one `textarea[placeholder="Project description, requests, details..."]` with value exactly `A101 shopping application`. Use an explicit 8000ms timeout. Retain both existing exact `inputValue()` assertions and the complete History sequence. No sleep/retry of the whole behavior and no catch that turns timeout into success.
- [ ] Run the new test plus existing `tests/prd-initialization.test.ts`, then the full covering `tests/ui-regression-contract.test.ts` once. Retain original exits/output, distinct failures and source pins. Use actual exit/EOF evidence rather than claimed success. No real native browser or provider is needed for these contract tests.
- [ ] Self-review exact diff and preserve all fixture assertion IDs/hash inputs. Give Root a report, U10 review package and hashes; do not stage/commit. Root obtains task/whole-diff review and performs stock build before delivery. A fresh native/browser report is a later delivery gate, never inferred from unit tests.

## Rulings

Ruling: Correct the premature test oracle without changing PRD product behavior — the producer/effect/initializer contract is sound in inspected Source, the recorded original identifies the premature first equality, and deterministic delayed-render coverage will test that cause — if wrong, the bounded exact-value wait still fails and its preserved diagnostic requires further product investigation.

Ruling: Start unchanged full8 on the frozen activated live release while this isolated fixture correction proceeds — UI and workflow qualifications are separate in the approved spec and no workflow guard is bypassed — if a causal server/product defect is later found, preserve this original and rerun the affected qualification after the root fix.
