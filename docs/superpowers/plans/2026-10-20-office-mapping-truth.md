# Office mapping truth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Root owns execution/delivery; preparation is read-only.

**Goal:** Preserve Office while distinguishing real mappings, observed zero, unavailable and stale snapshots.

**Architecture:** Preserve wire/STEP_MAPPING; remove false inference/SWR; pass receipt state to the retained engine.

**Tech Stack:** Existing TypeScript/Express/React/Canvas2D/node:test/tsx/Playwright/Vite.

**Spec:** `docs/superpowers/specs/2026-10-19-operator-workspace-design.md` (approved outcomes 1, 3 and 5). Root-read architecture evidence is workspace capture `logs/2026-10-20-mc-only-rollout-v1/office-truth-architecture-plan-v1.md`, SHA256 `473ed1f4e7008bf7cee0f4a0d7ef36988ffa7ac5fbd64ce16280497afbfee750`. Paths relative to sole writer `/Users/setrox/ai/setrox/.worktrees/mission-control-operator-workspace-20261019-v1`.

## Global Constraints

Copied verbatim from the approved design:

- Root alone stages, commits, pushes and delivers. Only one implementation worker per repository at a time; disjoint repository work may proceed in parallel with frozen shared contracts and Root-serialized delivery. Writers are the selected linked worktrees. Do not build/edit the current live MC checkout during implementation.
- Live ports remain 3080/3333/18789. No provider calls, live state mutation or service restart for unit/UI fixtures. No new external dependency unless a concrete source need is established.
- Preserve failed/cancelled records, all runtime/secret/admission guards and current DB authority. No generic shell runner or guard bypass. No published migration changes. ACL/credential effects require their own bounded authority audit.
- The existing English source contract and English product copy remain. Turkish design terms are semantic labels, implemented with English equivalents; compiler prompts remain English. Secret values, private absolute paths and raw logs never enter client bundles/evidence responses.
- Unknown is explicit, not numeric zero. HTTP health, six preflight passes and partial tests never mean full8 GO. Model schema evidence is dated, not a pricing/quality promise.
- Preserve existing scratch/evidence/worktrees; no broad cleanup. Three test/agent crons require source-backed purpose confirmation before any reversible disable.

- Use physical provisioned Node `/opt/homebrew/Cellar/node@22/22.23.1/bin/node` (v22.23.1), its directory prepended to command PATH, with existing dependencies; no npm install or package changes.
- Live SF83/MCfa41/I4 and the original full8 owner remain unchanged; no live transition until original owned closure. Test artifacts are synthetic isolated fixtures, never current-live qualification.
- Check the 8,589,934,592-byte free-space floor before native/heavy commands and record point samples; do not infer continuous compliance from points or weaken guards.

## Spec clarification and evidence

Zero active runs/WORKING 1 matches source CEO/mtime invention and swallowed refusal. Preserve ten-role art/signage/patrol/recreation/handoffs, chat/dialog/events and visibility lifecycle. Chat/Scrape/Cron/roster redesign are excluded; animations remain illustrative.

Keep `{agents:{id,status:'working'|'idle',activity}[],timestamp:number}`, ten IDs/order and STEP_MAPPING. Tokens mean mapped/unmapped in returned running runs/running steps, not worker ownership or operational active-run census.

getRuns directly reads PG's latest 50 runs/steps/stories; PG failure falls through to direct HTTP (5s timeout); both failing rejects. No internal cache, source/freshness/completeness metadata. Zero means no returned mapping. No new CLI/API/DB read or Overview/projects import.

Remove Office-only cached wrapper: it serves stale success 25s and suppresses background refusal. Cost: one existing getRuns per visible 5s poll, under existing single-flight guards. Keep shared cache unchanged; label receipt freshness separately from unverified upstream freshness. Delete unreachable CRON_AGENTS daily-standup block without activating fallback or touching jobs.

Inspected 32b99b6 tree2d96aa3c9b1c355fe2a2b7142ab42a91a174c5da. Root selected `fix/office-observed-role-mapping-20261020` at `d4a90fec507360588f11e91b42999ea734235e0b`, same tree. Live MC fa41/full8 job 1a2c2b5f frozen; no tests/build/browser/network/runtime action in preparation.

## File Map — Office deliverable and required Node 22 validation compatibility

| Action | Exact path | Responsibility |
|---|---|---|
| Modify | `server/routes/office.ts` | Mapping projection and explicit upstream failure. |
| Modify | `src/pages/PixelOffice.tsx` | Catalog/mapping copy and receipt state. |
| Modify | `src/lib/pixelOffice.ts` | Ten-ID export and qualified HUD. |
| Modify | `tests/data-sync-browser.test.ts` | Actual mounted DOM/HUD/lifecycle regression. |
| Create | `server/routes/office.test.ts` | Actual producer with substituted data ports. |
| Modify | `server/routes/overview.test.ts` | Node 22-supported named module mock exports; preserve every actual HTTP assertion and cleanup. |
| Modify | `tests/overview-truth.test.tsx` | Same Node 22 mock option correction; preserve actual SSR assertions and restore. |

Compatibility: script fixture has 14 unknown IDs/no timestamp; mounted fixture has one koda/fixed timestamp. Filter unknown IDs; accept partial arrays/optional timestamp; use client receipt age. No api.ts/shared-agents/CSS/package/script or fixture HTML/TSX edits required.

### Task 1: Office truth end to end

**Files:** The five Office paths plus the two mapped existing Overview test fixtures, amended by the bounded validation ruling below. No Overview product Source changes.

**Interfaces:** Existing getRuns/STEP_MAPPING and Office response remain. Errors become503 `{error:'OFFICE_STATUS_UNAVAILABLE'}`. Export existing ten IDs as `OFFICE_ROLE_IDS`; retain `OfficeAgentState`. Add in engine:

```ts
export interface OfficeMappingObservation {
  state: 'unknown' | 'unavailable' | 'fresh' | 'stale';
  mappedCount: number | null;
}
private mappingObservation: OfficeMappingObservation = { state: 'unknown', mappedCount: null };
setMappingObservation(value: OfficeMappingObservation): void { this.mappingObservation = value; }
```

- [ ] **Step 1: Write producer RED cases.** Reuse `cron.test.ts` AST/transpile fixture with actual Office statements/Express/STEP_MAPPING/cache, no config/PG/CLI import. Serial port0 servers close and invalidate office-status before/after. Inject:

```ts
let runs: unknown = [], refusal = false, reads = 0, sessionReads = 0;
const router = new Function('Router','cached','getRuns','STEP_MAPPING','PATHS',
  'existsSync','readdirSync','statSync','join', js + ';return router;')(
  express.Router, cached,
  async () => { reads++; if (refusal) throw new Error('private fixture detail'); return runs; },
  STEP_MAPPING, { agentsDir: '/fixture' },
  () => { sessionReads++; return true; }, () => ['recent.jsonl'],
  () => ({ mtimeMs: Date.now() }), join,
);
```

Fixture interface: `setRuns(unknown)`, `setRefusal(boolean)`, `read():Promise<Response>`, `reads():number`, `sessionReads():number`. `js` is cron-style actual-route transpilation; read fetches owned `/api/office/status`. Cases:

| Actual upstream fixture | Expected actual endpoint result |
|---|---|
| `[]`, fake fresh session mtimes | 200; ten idle compatibility tokens, empty activities including main; sessionReads=0 |
| running feature-dev plan + implement | 200; seven distinct visible mapped roles; main activity `Mapped running step: plan (feature-dev)`; out-of-scene pool roles absent |
| `{workflow:'bug-fix',status:'running',steps:[{id:'investigate',status:'running'}]}` | only koda mapped; alternate field names work |
| known workflow/unknown step; unknown workflow; daily-standup | valid observation, all ten unmapped |
| pending/completed/failed/cancelled/resuming/cancelling/failing run + running plan | all ten unmapped |
| running feature-dev + pending/done/completed/failed plan | all ten unmapped |
| duplicate plan steps/runs | main counted once |
| running feature-dev, absent steps | valid empty mapping |
| null/object top-level; running known workflow with object steps/null step | 503 fixed error, no empty success |
| first refusal | 503 fixed error |
| success then refusal without TTL wait | second response503, reads=2; cannot serve cached success |
| refusal then [] | recovery200; all ten unmapped |

Cache/refusal regression:

```ts
const f = await fixture(t);
assert.equal((await f.read()).status, 200);
f.setRefusal(true);
const failed = await f.read();
assert.equal(failed.status, 503);
assert.deepEqual(await failed.json(), { error: 'OFFICE_STATUS_UNAVAILABLE' });
assert.equal(f.reads(), 2);
assert.equal(f.sessionReads(), 0);
```

- [ ] **Step 2: Run RED; retain original exit/close/output.**

```bash
node --import tsx --test server/routes/office.test.ts
```

Expected: invented mappings/cached refusal fail; harness errors are not RED.

- [ ] **Step 3: Correct producer.** Remove fs/path/config/cache imports, session helper and CRON_AGENTS. Keep ten-role projection/timestamp; use:

```ts
const runs = await getRuns();
if (!Array.isArray(runs)) throw new Error('OFFICE_STATUS_UNAVAILABLE');
const working = new Map<string, string>();
for (const run of runs) {
  if (!run || typeof run !== 'object' || typeof run.status !== 'string')
    throw new Error('OFFICE_STATUS_UNAVAILABLE');
  if (run.status !== 'running') continue;
  if (run.steps !== undefined && !Array.isArray(run.steps))
    throw new Error('OFFICE_STATUS_UNAVAILABLE');
  const workflowId = run.workflow_id || run.workflow || '';
  const mapping = STEP_MAPPING[workflowId];
  if (!mapping) continue;
  for (const step of run.steps || []) {
    if (!step || typeof step !== 'object' || typeof step.status !== 'string')
      throw new Error('OFFICE_STATUS_UNAVAILABLE');
    if (step.status !== 'running') continue;
    const stepId = step.step_id || step.id || '';
    for (const id of mapping[stepId] || [])
      working.set(id, `Mapped running step: ${stepId} (${workflowId})`);
  }
}
// Existing ten-role agents projection and timestamp stay.
// Route try: res.json(await getOfficeStatus());
// Route catch: res.status(503).json({ error: 'OFFICE_STATUS_UNAVAILABLE' });
```

- [ ] **Step 4: Mounted RED.** Extend existing data-sync-browser harness; before navigation install actual draw capture via context.addInitScript:

```ts
const original = CanvasRenderingContext2D.prototype.fillText;
const latest = new Map<string, string>();
(window as any).officeDraws = latest;
CanvasRenderingContext2D.prototype.fillText = function(text, x, y, maxWidth) {
  if (this.canvas.classList.contains('pixel-office__canvas')) latest.set(`${x},${y}`, String(text));
  if (latest.size > 512) latest.delete(latest.keys().next().value!);
  return maxWidth === undefined ? original.call(this, text, x, y)
    : original.call(this, text, x, y, maxWidth);
};
```

Capture is capped at 512 coordinates. Add `h.hold(path)`/`h.release(path)` via Promise/resolver Map awaited in API interception; initialize Office hold for `office-loading`, release all in finally before cleanup. Keep real timers/engine. Test DOM and draw calls:

| Scenario | Required DOM and HUD |
|---|---|
| First response held | unknown counts; `MAPPING UNKNOWN`, no numeric zero |
| First503 | unavailable message/unknown counts; `MAPPING UNAVAILABLE` |
| Successful ten-row zero | mapped0/unmapped10; `MAPPED 0`; no All idle/WORKING/ACTIVE |
| Existing koda fixture | mapped1 and Fixture task; `MAPPED 1` |
| Next503 or malformed agents | retained task explicitly stale, FETCH_FAILED; `MAPPED 1 · STALE` |
| Next request held >=10s after receipt | stale DOM/HUD while inFlight, one outstanding request |
| Recovery ten-row zero | mapped0, prior task gone; no stale/unavailable HUD |
| Recovery mapped | fresh count/error cleared; exactly one RAF chain |

```ts
assert.match(await p.locator('.pixel-office').innerText(), /Static role catalog/);
assert.match(await p.locator('.office-info').innerText(), /Mapped workflow roles \(stale: 1\)/);
assert.match(await p.evaluate(() => Array.from((window as any).officeDraws.values()).join('\n')),
  /ROLES 10 · MAPPED 1 · STALE/);
assert.equal(await p.evaluate(() => (window as any).rafFixture.pending.size), 1);
```

Advance a frame for HUD assertions. Preserve lifecycle/one-RAF/WS/cleanup guards. Click final koda chat via captured/scaled coordinates; assert/close dialog and retained event. Capture 390/768/1440; check canvas/HUD containment.

- [ ] **Step 5: DOM/HUD.** Export/consume ten IDs. Validate array/string id/activity and working-or-idle status; reject duplicate known IDs, filter unknown IDs, accept partial arrays/optional timestamp. Retain rows on failure. Before return:

```ts
const known = statusSync.observedAt !== null;
const mappingState: OfficeMappingObservation['state'] = !known
  ? (statusSync.errorCode ? 'unavailable' : 'unknown')
  : statusSync.stale ? 'stale' : 'fresh';
const mappedCount = known ? workingAgents.length : null;
useEffect(() => {
  engineRef.current?.setMappingObservation({ state: mappingState, mappedCount });
}, [mappingState, mappedCount]);
const countLabel = (n: number) => !known ? 'unknown'
  : mappingState === 'stale' ? `stale: ${n}` : String(n);
```

Persistent copy: “Static role catalog — workflow mapping visualization; animations are illustrative.” Then “Mappings describe returned running workflows and steps, not worker ownership. Receipt time does not verify upstream freshness.” Headings: `Mapped workflow roles (${countLabel(workingAgents.length)})` / `No observed workflow mapping (${countLabel(idleAgents.length)})`. Empty text: unknown `Mapping status unknown`; fresh0 `No observed workflow mappings in returned runs`; stale0 `No observed workflow mappings in retained snapshot`. Keep Office dataSyncMessage/error, CSS hooks, chat/events and accepted-response handoffs.

Engine badge uses receipt metadata:

```ts
const { state, mappedCount } = this.mappingObservation;
const badgeText = state === 'unknown' ? 'ROLES 10 · MAPPING UNKNOWN'
  : state === 'unavailable' ? 'ROLES 10 · MAPPING UNAVAILABLE'
  : `ROLES 10 · MAPPED ${mappedCount}${state === 'stale' ? ' · STALE' : ''}`;
drawRect(this.ctx, 140, H - 26, 360, 16, '#112211');
drawPixelText(this.ctx, badgeText, 320, H - 13,
  state === 'fresh' ? '#00ff41' : '#ffaa00', 9);
drawPixelText(this.ctx, 'STATIC ROLE CATALOG · ILLUSTRATIVE', 750, H - 13, '#8899aa', 9);
```

Setter creates no RAF/timer; default unknown renders before response. Preserve engine/art/state machine. Hidden canvas may retain pixels but must show stale metadata on resume until accepted response.

- [ ] **Step 5b: Correct required Node 22 fixture compatibility.** The original adjacent runs failed before route/render execution with missing named cached/api exports, despite unchanged Overview Source. On the provisioned Node 22 runtime, replace only each context.mock.module option key exports with namedExports in the two mapped existing tests. Preserve all mock values, actual Source imports, assertions, cleanup/restoration, original child exit/close/signal/EOF checks and fixed subprocess flags. Do not raise the Node floor or switch validation to ambient Node 26. No new compatibility abstraction or implementation-mirror test is needed: require the real route and SSR assertions to execute. Official branch documentation: https://nodejs.org/download/release/latest-jod/docs/api/test.html#mockmodulespecifier-options ; actual installed version remains v22.23.1, and its test results are the decisive local check. Preserve both original failures; do not present them as Office product regressions or passing checks.

- [ ] **Step 6: Verify from sole writer; Root delivers.**

```bash
node --import tsx --test server/routes/office.test.ts
DATA_SYNC_CAPTURE_PHASE=office-truth-v1 node --import tsx --test tests/data-sync-browser.test.ts
node --import tsx --test tests/data-sync.test.ts server/routes/overview.test.ts
node --import tsx --test tests/overview-truth.test.tsx
git diff --check
```

Require original exit/close0 and clean owned cleanup. New capture phase if already present. Root reviews/commits, then builds:

```bash
git add server/routes/office.ts src/pages/PixelOffice.tsx src/lib/pixelOffice.ts tests/data-sync-browser.test.ts server/routes/office.test.ts
git commit -m "fix: show truthful Office workflow mappings"
npm run build
```

Root runs unchanged six-route render smoke/owned UI qualification via existing guarded protocol. No broad npm test (restrictedPG needs setup). No live restart during frozen full8. Root records evidence/next action and later live verification through existing rollout procedure.

## Self-review and limits

Seven source/test paths cover Office truth and its required provisioned-Node validation; mapping/tools remain. No script-copy change. Upstream freshness/completeness, full8, rollout and live acceptance remain unqualified.

## Rulings

Ruling: Remove only Office stale-while-revalidate caching and its fabricated CEO/session-mtime work — the actual audit and Source prove false working state, while the approved design requires honest provenance and permits parallel disjoint-repository fixes — if wrong, the additional existing getRuns read each visible five-second poll may need a provenance-aware cache; no extra CLI/source or ownership claims are introduced.

Ruling: Preserve working/idle wire tokens solely as internal animation compatibility and label all visible counts as returned workflow mappings — this preserves the ten-role illustration and saved fixture compatibility without declaring worker ownership — if wrong, the UI wording or a future independently scoped typed API must be revised; no observed runtime result is certified by animation.

Ruling: Correct existing browser expectations to match the verified baseline active-scoped WebSocket lifecycle — baseline PixelOffice uses useWebSocket(active), whose cleanup closes its owned socket while hidden; preserve visible chat/canvas across resume and assert closure plus one new socket — if wrong, a real persistence regression would appear in the retained lifecycle assertions; no socket Source or resource lifecycle changes are allowed.

Ruling: Extend the File Map only with the two required Overview test fixtures for Node 22 module-mock compatibility — their retained import failures and official Node documentation identify an unsupported option key, while real HTTP/SSR validation must execute under the provisioned runtime — if wrong, these actual tests still fail or expose a product defect; do not change production Overview or weaken assertions.
