# Native V3 Overview Provenance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Make the live Overview show selected active V3 work and correctly scope its independent Kimi quota monitor.

**Architecture:** Reuse the existing selected Setfarm run reader and operational-status predicate. Permit native V3 active rows independently of Project receipt admission, retaining the legacy intersection. Change display wording without new credential or status readers.

**Tech Stack:** TypeScript, Express, React, Node test runner with existing module-isolated HTTP fixture.

**Spec:** `docs/superpowers/specs/2026-11-09-native-v3-overview-provenance-design.md`

## Global Constraints

- Sole Mission Control writer: `/Users/setrox/ai/setrox/.worktrees/mission-control-auth-order-test-20261021-v1`, branch `fix/native-v3-overview-provenance-20261109`, base `2b57007867d1e358a5c87b7d17d90cfe54fc381f`.
- No Setfarm source, generated-project, credential, role, auth, Projects admission or runtime-guard changes.
- Preserve existing operational-status semantics, nonempty-ID checks, deduplication and legacy Project-bound policy.
- Only `protocol: 'v3'` may use the native no-Project read path.
- Keep all technical tools and existing quota refresh/staleness/error details.
- No live service changes, model/provider calls, dependency installation, new previews or paid activity by implementers/reviewers.
- Preserve existing `.superpowers` artifacts and dirty/untracked files; no cleanup.
- Root alone stages, commits, pushes, creates/merges PRs and delivers reviewed builds.

## File Map

| File | Responsibility |
| --- | --- |
| `server/routes/overview.ts` | Actual authenticated Overview read projection and active native/legacy run selection |
| `server/routes/overview.test.ts` | Existing real HTTP route fixture; regression and unchanged legacy/status/dedup behavior |
| `src/pages/Overview.tsx` | `ACTIVE` workflow wording only |
| `src/components/KimiQuotaBanner.tsx` | Quota-monitor scope and `NO_TOKEN` display advice only |
| `tests/overview-truth.test.tsx` | Existing UI truth checks; adjust only assertions directly affected by accurate wording |

## Task 1: Correct active-run projection and monitor wording

**Interfaces:** Consumes existing `getRuns()`, `readProjectApiProjections()` and `isSetfarmOperationalActiveRunStatusV1`; produces the existing `/api/overview` response shape unchanged.

- [ ] Add a regression inside the existing actual-HTTP fixture before changing production. Use `runs = [{ id: 'native-untransferred', protocol: 'v3', status: 'running', steps: [] }]` and `projected = []`; assert `activeRunCount === 1` and `activeRuns.map(run => run.id)` equals `['native-untransferred']`. Cover Projects-unavailable with the same valid native row. Retain/extend nearby legacy, terminal, unknown, missing-ID and duplicate cases as needed without duplicating the selector implementation.
- [ ] Run `node --import tsx --test server/routes/overview.test.ts`; capture original PID, exit status and output. The new native count assertion must fail with actual zero before production changes; fixture errors are not RED.
- [ ] In the existing active-runs filter, require a nonempty ID and existing operational status, reject duplicates, and apply Project expected-status equality only when `run.protocol !== 'v3'`. Native V3 status comes from the existing selected run reader. Do not change Projects or Work/native-authority modules.
- [ ] In `Overview.tsx`, change the workflow counter label from `RUNNING` to `ACTIVE`; keep its data and navigation unchanged.
- [ ] In `KimiQuotaBanner.tsx`, use `KIMI QUOTA MONITOR`; clarify tooltip scope. For `snapshot.error?.code === 'NO_TOKEN'`, display `Quota monitor credentials are unavailable. Subscription workflow authentication is shown in Work.` Preserve existing detail generation for all other states, error code display, refresh and stale behavior. Do not add a secret reader or render environment-variable/sign-in setup advice for this state.
- [ ] Run the covering Overview HTTP test and existing `tests/overview-truth.test.tsx` using their existing runner flags. Capture original exit/output. Run one `npm run build` in this writer with the current Setfarm release path supplied through the existing build configuration if required. Verify generated output directories resolve inside this writer before the stock build cleans them. Never launch Vite against canonical/shared dependencies.
- [ ] Write a task report under this plan's workspace with files changed, original RED/GREEN/build receipts, limits and exact next review step. No Git mutation by implementer.

## Delivery

Root performs task review, then one broad whole-branch review; any final fix wave receives one scoped re-review. Root delivers by reviewed PR and clean release build. A successful unit/build result is not a claim that the currently running MC service has changed. Root decides the normal service transition separately while preserving the active canary and current ports.
