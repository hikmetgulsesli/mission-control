# Fresh workflow stop timeout implementation plan

> **For agentic workers:** Implement this single bounded task in the existing Mission Control sole writer. Root owns review, delivery, clean stock build and any operational effects.

**Goal:** Allow the selected guarded Setfarm workflow stop command to finish within the existing bounded 120-second workflow budget.

**Design:** `runCliRaw` already selects 120 seconds for selected Setfarm workflow run. Apply that same budget to selected workflow stop; ordinary/unselected commands and all other subcommands retain 25 seconds. Keep SIGKILL, buffer limits, queue/concurrency, deduplication, retry behavior, selected-entry checks and Source guards unchanged.

**Tech stack:** Existing TypeScript CLI consumer and Node/tsx component tests.

## Actual causal evidence

The retained operational evidence is in the Setfarm sole writer's `.superpowers/sdd/2026-11-04-subscription-operational-integration/`. `root-a17-maintained-stop-original-error-v1.log` records MC's snapshot-authorized stop starting at `2026-11-07T23:45:13.917Z` and ending at `23:45:38.962Z`: killed=true, SIGKILL, zero stdout/stderr bytes (25.045 seconds). The identical guarded standard Source CLI command in `root-a17-maintained-cli-stop-direct-v1.result.json` exited 0 from `23:46:47.241193Z` to `23:47:17.327898Z` (30.086705 seconds). The default MC 25-second budget terminates this valid selected stop before it can return. This fix addresses that observed consumer timeout only.

## File map

- `server/utils/cli.ts`: select the existing 120-second budget for selected workflow run or stop.
- `tests/fresh-workflow-run-acceptance.test.ts`: extend the existing actual `runCliRaw` component test to check selected stop and unchanged unselected/other-command budgets, without invoking a child, database or provider.
- This plan: causal evidence, scope and verification limits.

## Task 1: Bound selected stop with the workflow budget

- [x] Add selected stop=120000, unselected stop=25000 and selected resume=25000 cases at the actual CLI consumer boundary.
- [x] Run `node --import tsx --test tests/fresh-workflow-run-acceptance.test.ts`; require RED on selected stop receiving 25000 instead of 120000.
- [x] Rename the shared budget constant to `FRESH_WORKFLOW_TIMEOUT_MS`; admit only exact selected Setfarm workflow run/stop in the existing selector.
- [x] Run the same focused test GREEN, server TypeScript no-emit and `git diff --check`; retain original statuses and private captures.
- [x] Freeze the three file hashes and hand off to Root for independent review and delivery.

## Limits

No live stop, runtime rebuild, service restart, provider/model call, database effect, staging, commit, push or PR is performed by this implementation task. Root must complete independent review and the clean stock build before rollout. Unit/component success is not operational workflow qualification.

Implementation verification: RED process 38701 exited 1 (seven passed, selected stop failed with `25000 !== 120000`); GREEN process 39256 exited 0 (eight passed, no skips); server no-emit process 39255 exited 0; diff check process 40948 exited 0. Original command/status/log captures and the final file manifest are private files in `.superpowers/sdd/2026-11-08-fresh-workflow-stop-timeout-v1/`. Root review, clean stock build, delivery and operational verification remain outstanding.
