# Task6A Private Selected-CLI No-Spawn Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. The user's root-only-writer instruction selects inline execution; agents may only research/review read-only.

**Goal:** Prove two selected Mission Control CLI entry points cannot spawn a child when a separate private Task6A no-spawn flag is present.

**Architecture:** A startup-only policy module denies the generic `runCli` utility before queueing and refuses PRD start-run in its first router middleware. A disposable executable and Express child test the real behavior. This is a selected-path negative proof, not whole-app child credential separation.

**Tech Stack:** Node 26, TypeScript ESM, Express, `node:test`.

**Spec:** `docs/superpowers/specs/2026-09-28-task6a-mc-selected-cli-private-no-spawn-design.md`.

## Global Constraints

- Root alone edits, commits, pushes and delivers. Preserve every existing dirty file/worktree; no reset/revert or direct main commit.
- `MC_TASK6A_SELECTED_CLI_NO_SPAWN_V1` absent means ordinary behavior unchanged. Any present value denies selected CLI paths; no flag is enabled on a live service.
- No live PostgreSQL, credential, role, service, selected binary, OS owner or admission change. Tests use an explicit child environment and never launch host `setfarm`.
- Denial occurs before child spawn, queue acquisition, PRD DB access or filesystem project/task effects. Errors are fixed and contain no credential data.
- No claim of terminal/project/scraper/evidence subprocess or Setfarm spawner isolation.

## File Map

- Create `server/utils/task6a-selected-cli-fence.ts`: exact startup flag and fixed refusal error.
- Modify `server/utils/cli.ts`: reject at `runCli` entry before in-flight/queue/exec.
- Modify `server/routes/prd-generator.ts`: early exact start-run HTTP 503 guard.
- Create `server/utils/task6a-selected-cli-no-spawn.test.ts`: real disposable executable marker RED/GREEN for flag-present, invalid flag, and flag-absent behavior.
- Create `server/routes/task6a-selected-cli-no-spawn-child.ts`: isolated PRD-only HTTP harness with no live DB URL.
- Create `server/routes/task6a-selected-cli-no-spawn.integration.test.ts`: POST start-run denial before input validation and case aliases; absent-flag 400 characterization and unrelated route reachability.

## Task 1: Generic CLI negative proof

**Interfaces:** `task6aSelectedCliNoSpawn` is a startup Boolean; `TASK6A_SELECTED_CLI_NO_SPAWN` is the fixed refusal code. `runCli(cmd,args)` preserves its signature.

- [ ] **Step 1: Write RED test.** In the new utility test, create a bounded `/tmp/mc-task6a-cli-*` fixture with executable `probe` that writes a marker and prints `CHILD_RAN`. Spawn a separate Node process with `--import tsx --input-type=module -e` to import real `runCli` and invoke the absolute probe path. Require an `.env`/`.env.local`-free worktree and pass a dummy `GATEWAY_TOKEN` so config loading never reads the host gateway credential. With `MC_TASK6A_SELECTED_CLI_NO_SPAWN_V1=1` and a dummy non-live `SETFARM_PG_URL`, assert fixed rejection, absent marker and no stdout containing dummy credentials. Also test invalid value `0`. The production change this test catches is a child launch before/after denial.

  ```ts
  assert.equal(child.status, 0, child.stderr);
  assert.deepEqual(JSON.parse(child.stdout), { error: 'MC_TASK6A_SELECTED_CLI_NO_SPAWN' });
  assert.equal(existsSync(marker), false);
  ```
- [ ] **Step 2: Run RED.** `node --import tsx --test server/utils/task6a-selected-cli-no-spawn.test.ts`; the flagged probe currently executes, so marker/status assertions must fail for that reason, not from fixture/import error.
- [ ] **Step 3: Implement minimal policy.** Export startup flag presence and fixed refusal code from the policy module. At the first line of `runCli`, throw the fixed error when present, before key creation, in-flight lookup and `acquire`. Do not mutate environment or ordinary mode.

  ```ts
  export const task6aSelectedCliNoSpawn = process.env.MC_TASK6A_SELECTED_CLI_NO_SPAWN_V1 !== undefined;
  export const TASK6A_SELECTED_CLI_NO_SPAWN = 'MC_TASK6A_SELECTED_CLI_NO_SPAWN';
  // At runCli entry, before any queue or child work:
  if (task6aSelectedCliNoSpawn) throw new Error(TASK6A_SELECTED_CLI_NO_SPAWN);
  ```
- [ ] **Step 4: Run GREEN and absent-flag control.** The same test must show flag-present and invalid-value refusal while no-flag `runCli` runs the disposable probe and creates its marker; remove only fixture-owned files after verifying exact `/tmp/mc-task6a-cli-*` root identity.
- [ ] **Step 5: Commit.** Stage only the policy module, utility and test, then commit `feat(task6a): deny private shared CLI spawn`.

## Task 2: Direct PRD Setfarm spawn negative proof

**Interfaces:** Under the same flag, `POST /api/prd/start-run` returns 503 `{error:'MC_TASK6A_SELECTED_CLI_NO_SPAWN'}` before input validation or the handler. The rest of the PRD route behavior is unchanged with the flag absent.

- [ ] **Step 1: Write RED HTTP test.** Start an Express child mounting the real PRD router with explicit harmless env (`SETFARM_PG_URL=postgresql://invalid@127.0.0.1:1/private`, no ambient `DATABASE_URL` or `.env`, dummy `GATEWAY_TOKEN`). POST `/api/prd/start-run` with `{}` under the flag and assert exact 503. Current route returns 400 before the new guard, so this is RED without contacting a DB or launching host Setfarm. Assert the same for `/api/PRD/START-RUN`, `/api/prd/start-run/`, invalid flag `0`, and that `/api/task6a-after-prd` remains 200. With flag absent, `{}` remains 400.

  ```ts
  const response = await fetch(`${base}/api/prd/start-run`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
  });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: 'MC_TASK6A_SELECTED_CLI_NO_SPAWN' });
  ```
- [ ] **Step 2: Run RED.** `node --import tsx --test server/routes/task6a-selected-cli-no-spawn.integration.test.ts`; require the expected 400-vs-503 failure and no unrelated import/start error.
- [ ] **Step 3: Implement minimal route guard.** In `prd-generator.ts`'s existing first router middleware, check flag presence and exact lowercase route/method before calling `next()`. Return fixed 503 JSON; do not put a check after DB, repo or temp-task effects.

  ```ts
  if (task6aSelectedCliNoSpawn && req.method === 'POST' && path === '/prd/start-run') {
    res.status(503).json({ error: TASK6A_SELECTED_CLI_NO_SPAWN });
    return;
  }
  ```
- [ ] **Step 4: Run GREEN and focused regression.** Run both new test files and existing PRD restricted tests in normal mode. Verify no child/DB/environment fallback path was introduced.
- [ ] **Step 5: Commit.** Stage only the PRD route, HTTP child/test and any necessary focused test fix; commit `feat(task6a): refuse private PRD CLI launch`.

## Task 3: Verification and delivery

- [ ] **Step 1: Verify exact branch.** Run `npm test`, `npm run build`, focused tests, `git diff --check`, and compare build identity `sourceSha` with `git rev-parse HEAD` after final commit. Check branch is clean.
- [ ] **Step 2: Review.** Request independent read-only diff review; address Medium+ findings with new RED/GREEN evidence. Push only the scoped branch, open PR to main, request `@codex review`, and inspect exact-head comments plus GitGuardian.
- [ ] **Step 3: Deliver safely.** Merge only reviewed exact head. Fast-forward a clean existing MC main, rerun clean-main suite/build/identity, and execute the focused no-spawn test in a preserved `.env`-free detached merged-main worktree. Record read-only host HTTP and open Task6A gates in the root evidence log. Do not enable the private flag live.

## Self-review

The two production child paths in scope each have an observable negative test; the absent-flag baseline and invalid-flag fail-closed behavior are covered. The plan does not pretend that denying these two paths fences every Mission Control child or Setfarm's own agent env. No PostgreSQL fixture or secret/grant mutation is needed for a no-spawn proof.

## Review-directed root refinement

Read-only review found that Express accepts the PRD handler's trailing-slash
alias while the first exact path comparison missed it. The File Map's PRD
route and HTTP test therefore cover a deterministic 400-vs-503 RED alias
and a normalized-path GREEN denial before the handler. The same review
found the test child would read the host gateway token through `config.ts`
unless its environment supplied a dummy token; both private fixtures now
do so and require no worktree `.env` files. These are source/test isolation
corrections for this selected-CLI proof, not live credential changes.
