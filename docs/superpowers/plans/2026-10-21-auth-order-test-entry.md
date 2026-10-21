# Auth Order Test Entry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or execute the single scoped task under Root ownership. Review remains independent; workers do not deliver.

**Goal:** Restore delivery-evidence verification by checking middleware order in the actual application module.

**Architecture:** Correct the existing test's application source lookup and its Node22 module-mock options. Preserve all checks and real guarded-bootstrap HTTP fixtures; change no production behavior.

**Tech Stack:** TypeScript, Node test runner, tsx, existing Express fixtures.

**Spec:** `docs/superpowers/specs/2026-10-21-auth-order-test-entry-design.md`

## Global Constraints

- Root alone writes and delivers this branch; retained worktrees/releases remain untouched.
- No production, auth, rate, parser, runtime guard, credential or data changes.
- Use exactly the three focused files below, never a wildcard suite.
- Preserve actual failures and distinguish the existing branch-scoped skip.
- Build only a clean committed tree; deploy only a reviewed immutable merged-main release.

## File Map

| File | Responsibility |
| --- | --- |
| `server/routes/setfarm-operational.test.ts` | Read `app.ts` for existing mount/order checks; use supported mock options and isolate loaded-route subprocess test context. |
| `docs/superpowers/specs/2026-10-21-auth-order-test-entry-design.md` | Explain actual failure, scope and delivery boundary. |
| `docs/superpowers/plans/2026-10-21-auth-order-test-entry.md` | Track this single root fix and verification. |

### Task 1: Correct the middleware-order test entry

**Interfaces:** Consumes the real `server/app.ts` registration sequence. Produces the same existing assertions, with no production API change.

- [x] Observe the original failure: Node42916, natural exit1, both EOF, 14PASS/1FAIL/1SKIP; only stale lookup at test line550 failed.
- [x] Reproduce baseline in the clean isolated writer after locked dependency setup: Node45738, natural1, 14PASS/1FAIL/1SKIP.

Run with the Source's trusted environment (`PATH=/opt/homebrew/bin:/usr/bin:/bin`, `LANG=C`, `LC_ALL=C`):

```sh
/opt/homebrew/Cellar/node/26.4.0/bin/node --import tsx --test server/routes/setfarm-operational.test.ts server/services/setfarm-product-build-authority.test.ts tests/product-build-authority-render.test.tsx
```

Expected: the same middleware-order failure; retain the actual output.

- [x] Change the lookup to `readFile(new URL("../app.ts", import.meta.url), "utf8")` and rename the six local `indexSource` references in this test to `appSource`. Preserve every presence/order assertion.
- [x] Run the command on Node26, then Node22. Initial path fix passed Node26/46049 but Node22/46164 exposed 3 existing fixture failures. Preserve that original failure.
- [x] In the same file, replace mock option `exports` with `namedExports`; use `defaultExport: (_req, _res, next) => next()` for the two default-only live-feed mocks. Define the loaded-route `childEnv` before spawning and `delete childEnv.NODE_TEST_CONTEXT`, matching the existing two production fixture subprocesses. Do not change fixture assertions or runtime code.
- [x] Re-run the final exact three-file command: Node22/48024 and Node26/48215 each naturally closed0 with 15PASS/0FAIL/1SKIP, true stdout/stderr EOF and no capture errors. Existing skip remains distinct.
- [ ] Independently review the scoped diff, mutation sensitivity and actual results. Do not add a bootstrap source-text assertion.
- [ ] Commit/push this branch and deliver through a reviewed PR; no direct main commit.
- [ ] Build the clean merged-main immutable release, qualify material and a bounded MC-only rollout, then recheck loaded source/build, current selection and actual delivery endpoint. Keep final UI317/preflight/liveQA/full8 open until proven.

Self-review: this plan maps the observed false refusal to one existing test; all changed files are listed, no production change or missing authority is implied, and no skipped/old result receives new credit.
