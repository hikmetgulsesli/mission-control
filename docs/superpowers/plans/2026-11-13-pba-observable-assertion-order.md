# Product Authority Assertion Ordering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Make MC accept valid canonical native assertion ordering while retaining all semantic and hash guards.

**Architecture:** Canonicalize only a copy of ProductSpec assertions at the graph relationship check. Require unique phase/property identities, exact graph order and unchanged payloads.

**Tech Stack:** Existing TypeScript, node:test and tsx; no new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-13-pba-observable-assertion-order-design.md`

## Global Constraints

- Return the original wire unchanged.
- Keep all envelope, source-map, selector, evidence, element, role, productObservableHash and assertionsHash checks.
- No dependencies, transport/default-schema changes, credentials, source guards or live run edits.
- Preserve the task workspace and all new records.
- Full workflow success remains unqualified.

## File Map

- Modify `server/services/product-build-authority-v3-parser.ts`: local canonical copy and uniqueness guards at native productObservable comparison.
- Modify `server/services/product-build-authority-v3-parser.test.ts`: full-parser positive and semantic negatives using synthetic native Stitch authority.
- Optional create `server/services/product-build-authority-v3-assertion-fixture.test-support.ts`: deterministic synthetic resealing helper if keeping that responsibility separate makes the test clearer; no runtime imports of tests or sibling repositories.
- Root-owned documentation and `.superpowers` records capture verification and review. No generated project edits.

### Task 1: Align native assertion relationship validation

**Interfaces:** Existing `parseProductBuildAuthorityV3` and `parseProductBuildAuthority` signatures and return identity remain unchanged. Test helpers consume only existing synthetic `native_stitch` corpus and the existing canonical hash function.

- [ ] Add a full-wire synthetic regression with two distinct assertions in reverse ProductSpec order and canonical graph order. Update the dependent hashes from leaves to parents using the existing native wire relationships; do not merely refresh enclosing hashes or commit live output. Assert the parser returns the exact original object and neither assertions list mutates.
- [ ] Run `node --import tsx --test server/services/product-build-authority-v3-parser.test.ts`, capturing the original exit/output. The positive case must fail specifically at `native.designGraph.productObservable:relationship_mismatch` on the unchanged parser.
- [ ] Add a local generic canonicalizer, preserving the exact producer ordering:

```ts
function canonicalAssertions<T extends { phase: string; property: string }>(values: readonly T[]): T[] {
  return [...values].sort((left, right) => {
    const a = `${left.phase}\0${left.property}`;
    const b = `${right.phase}\0${right.property}`;
    return a < b ? -1 : a > b ? 1 : 0;
  });
}
```

At the observable relationship, call existing `requireUnique` on the phase/property identity of each list, then compare `observable.assertions` to `canonicalAssertions(productObservable.assertions)`. Keep the original ProductSpec observable hash and stored graph assertions hash checks. Never sort the graph or mutate either payload.

- [ ] Add focused full-parser negatives with genuinely refreshed affected relationships: changed expected/operator, missing/extra assertion, duplicate identities on graph/product/both, noncanonical graph order and corrupted inner hashes. Check the intended guard, not accidental stale wrappers.
- [ ] Run the focused parser and existing V3 HTTP/client contract tests once on final code, plus `git diff --check`. Record original PIDs, exits and output. Do not repeat unrelated or already passed suites.
- [ ] Freeze exact files/hashes and report for Root's task review. Root alone stages/commits/delivers. Reviewers do not rerun the same tests.

## Root delivery

- [ ] Task review, then one whole-branch review against base75c1966a; resolve concrete findings with scoped re-review only.
- [ ] Scoped commit/push/PR/normal merge. Build clean merged source once with `npm run build`; retain genuine failures if any.
- [ ] Prepare/review a concrete MC-only normal transition using actual old/new source/build identities and unchanged current installation206 environment. No force, Setfarm controls, credential changes or old-run repair.
- [ ] Verify loaded MC identity, live V3 authority200, page screenshot and unchanged protected services/history. Update continuity with exact current model blocker separately.
