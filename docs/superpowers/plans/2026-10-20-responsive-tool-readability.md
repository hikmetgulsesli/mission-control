# Responsive tool readability implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement task-by-task. Root adopted this plan after PR40 merged at36610acc; Root alone owns delivery/build/native execution. Task1 is fixture preparation/static review first; Root native RED admission is separate.

**Goal:** Readable Scrape inspiration cards and reachable existing Chat History/targets at 390/768/1440, with bounded internal scrolling and composer containment.

**Architecture:** Existing CSS/semantics repair; separately labelled populated profile mounts real components under existing Layout and native lifecycle.

**Tech stack:** Existing React/CSS, Vite fixture, Playwright, Node.

**Spec:** `docs/superpowers/specs/2026-10-19-operator-workspace-design.md`, outcomes2/3/5. Prior: `.superpowers/sdd/2026-10-20-live-page-adjacent/office-cron-scrape-readonly-proposal-v1.md`. Paths relative to sole MC writer.

## Global Constraints


- Root alone stages, commits, pushes and delivers. Only one implementation worker per repository at a time; disjoint repository work may proceed in parallel with frozen shared contracts and Root-serialized delivery. Writers are the selected linked worktrees. Do not build/edit the current live MC checkout during implementation.
- Live ports remain 3080/3333/18789. No provider calls, live state mutation or service restart for unit/UI fixtures. No new external dependency unless a concrete source need is established.
- Preserve failed/cancelled records, all runtime/secret/admission guards and current DB authority. No generic shell runner or guard bypass. No published migration changes. ACL/credential effects require their own bounded authority audit.
- The existing English source contract and English product copy remain. Turkish design terms are semantic labels, implemented with English equivalents; compiler prompts remain English. Secret values, private absolute paths and raw logs never enter client bundles/evidence responses.
- Unknown is explicit, not numeric zero. HTTP health, six preflight passes and partial tests never mean full8 GO. Model schema evidence is dated, not a pricing/quality promise.
- Preserve existing scratch/evidence/worktrees; no broad cleanup. Three test/agent crons require source-backed purpose confirmation before any reversible disable.


Additional task constraints:

- Physical Node22.23.1 at /opt/homebrew/Cellar/node@22/22.23.1/bin/node; current8GiB floor and original native/pipe/capture closure mandatory. No install or fallback.
- Fixture preparation must be independently reviewed and Root-nominated before any native launch. Worker initially performs code/static/type checks only; Root runs the exact admitted RED and supplies original receipts. Task2 cannot begin before intended RED and settlement.
- Supplemental fixture uses all14 actual catalog target IDs from existing AGENTS metadata with fixed display-name overrides, including one long identity. Keep canonical317 data unchanged. This makes existing catalog roles genuinely present rather than testing13 unknown IDs with no roles.

## Frozen baseline and constraints

Next-task base: clean `fix/responsive-tools-20261020`, HEAD `36610acc1431e073546909e8ceea6485618912ac` (PR40 merged; tree equal to inspected df9aa72). Root serialized this switch; Source pins below remain unchanged. Handoff: phase424/2026-10-20T00:27:39.801563+00:00; Root owns current admission.

“Root alone stages, commits, pushes and delivers.” “Only one implementation worker per repository at a time”. “Live ports remain 3080/3333/18789.” Preserve sole writer, unknown owners, dirty files/evidence. No provider/live actions, restart, credentials, clone generation or runtime cleanup. English copy, all technical controls and original317 IDs/count/data/viewports/thresholds plus six-route smoke remain intact. No dependencies. Supplemental GREEN never means native compiled/live qualification or full8 GO.

Author performed Source/file inspection/documentation only; no tests/build/browser/HTTP/Git mutation. Root separately observed live390x844: hidden tabs/zero-box AGENTS/HISTORY and14 targets, plus ~117px Kimi NO_TOKEN notice. Screenshot stays in CUA memory; no file-export claim or df9/native qualification. Treat warning height as layout risk; exercise existing intercepted warning response plus truthful Chat notes, without banner/provider/credential redesign. See `native-adapter-contract-v1.md` for exact adapter, payloads and separate Task1 fixture review/RED gate.

## Source findings and design choice

Scrape.tsx:99–117 maps all returned apps to icon/info/Clone This siblings. CSS:9674–9686 gives200px tracks,48px icons,10px gaps/padding,300px vertical scroller and clipped nowrap/ellipsis name/developer. Full text exists in DOM. Preserve all25 returned apps,14px fonts, category, description/URL and callback; enlarge tracks and wrap.

Chat.tsx already owns selection/query/progress and renders sidebar/panel/notices. ChatSidebar owns AGENTS/HISTORY, saved-history loading/errors/selection. CSS:1576–1606 makes a clipped horizontal rail at<=480;7246–7247 hides tabs/sessions at<=768;7298–7303 caps36px and hides roles. Preserve min-height:0 chain, panel overflow/composer and provenance work.

Prefer bounded vertical sidebar/sticky tabs. Horizontal rail needs extra wrapper/two scrollers; drawer adds unnecessary navigation/state.

Required tiny semantic repair, confirmed by Root: History rows are clickable divs, so CSS cannot provide keyboard activation. Change only their root to `<button type="button">` with unchanged handler/children and scoped visual reset/focus-visible style. Real Enter/Space selection belongs in GREEN; no new state/API/navigation behavior.

## File Map

|Action|Path|Purpose|
|---|---|---|
|Modify|`src/index.css`|Scrape wrapping/minimum; replace conflicting mobile Chat rules; bounded sidebar/readable History.|
|Modify|`src/components/ChatSidebar.tsx`|Session root div→button type=button, unchanged handler/content.|
|Modify|`tests/data-sync-browser.test.ts`|Separate responsive-tools profile/data/geometry; optional owned-adapter seam.|
|Create|`tests/fixtures/responsive-tools-owned.ts`|Exact native adapter from companion contract; no import-time effects.|
|Modify|`tests/fixtures/data-sync-browser.tsx`|Real Chat/Scrape routes; preserve Layout/Driver/Office.|
|Root-owned ignored|`.superpowers/sdd/2026-10-20-responsive-tool-readability/capture.mjs`|Adapt existing Chat capture prefix/pins; original exit/close/EOF.|
|Read/reuse|`scripts/ui-regression-lifecycle.mjs`|Artifact store, observed process and native lifecycle; no implementation copy/guard changes.|
|Read only|Chat/Scrape pages, ChatPanel, canonical ui-regression worker/fixtures/contract tests|Behavior and317 unchanged.|

No CSS source mirrors or low-impact implementation unit tests. Browser geometry provides causal verification; a separate custody defect requires classification/scope revision.

### Task 1: Fixed supplemental owned browser RED

Reuse `harness(name,body)`, h.nav/setResponse/shot, window.fixture.navigate/unmount and native launch/census/close. Profile independent of canonical fixture.

- [ ] Root checks predecessor/final writer, current resource admission and exact pins. Read AGENTS/spec. No launch with conflicting/unknown ownership.
- [ ] Register real `<Route path="/chat" element={<Chat />}/>` and `<Route path="/scrape" element={<Scrape />}/>` in existing fixture; preserve Layout/Driver/Office routes.
- [ ] Add profile-only deterministic25 apps (ordinary multiword and long unbroken name/developer, category/description, intercepted local icon),14 targets including main/long identity, one known-time saved user/assistant pair per target and long history for panel scrolling. Exact GET allowlist includes agents, each target history limit=1/40, scrape trending/history and existing shell reads. Keep canonical DATA/AGENTS/FIXED_GETS unchanged.
- [ ] Preserve403 API/WS fallback middleware, GET-only exact API interception, external-origin denial, blocked service workers and console/network ledger. Intercept every expected WS; reject/record outbound messages. No Send/Scrape/Clone click/progress launch. Control availability/focus plus unchanged canonical clone callback test cover retention.
- [ ] Narrowly parameterize only the new profile's browser ownership. Existing harness line68 `chromium.launch`,147 `browser.close` and boolean isConnected receipt do not prove native closure. Reuse `createUiNativeLifecycleV1` with real default effects/descriptor, exclusive retained artifact store, random jobId, hash-bound intent/owner/Source and `observeUiProcessV1(process.pid)` actual metadata. Verify executable/uid/argv; derive PID/start/pgid from observation. Validate records using existing `UiWorkerLifecycleRecordV1Schema`. Census each viewport/boundary, close in finally; no direct-launch fallback/adoption/broad kill/guard override. Preserve old Office/data-sync test selection and behavior.
- [ ] Record Vite origin/listener, track fixture sockets and prove closure/listener absence separately. Existing reserve-first probe closes before Vite starts; race/setup refusal is not RED. Retain cache on unknown closure. Hash PNG/JSON via artifact store; profile `h.shot` records PNG hash/dimensions. Do not duplicate native lifecycle implementation.
- [ ] Adapt inspected ignored Chat `capture.mjs` prefix/pin list for this task. Retain original stdout/stderr, process exit/close/EOF and before/after Source hashes; capture wrapper alone is not native custody.
- [ ] Under Root-owned capture, pinned Node22, sequentially run `--import tsx --test --test-name-pattern='responsive tools readability' tests/data-sync-browser.test.ts`. Collect per-width checks/PNGs before overall failure, then settle finally. Expected causal RED: hidden HISTORY390/768 and clipped/narrow populated card text. Setup/import/network/ownership failure is not RED; correct only setup until the intended defects execute.

If adapter exceeds scope, expose an owned-browser injection seam: Root's fixed driver supplies/closes the maintained lifecycle browser around the same test body/fixture. Root selects/reviews before launch; no new framework or weakened checks.

Acceptance matrix, height900, same RED/GREEN data/thresholds:

| Surface | Widths | Actual checks/captures |
|---|---|---|
| Scrape |390/768/1440/1900|Exact25 names/developers/actions; grid<=300px, scroll first→last→first; full wrapped text/category/action inside card,48px icon/14px text, no horizontal escape. Top/bottom PNGs.|
| Chat agents |390/768/1440|Title/notices/status/progress/tabs/main selector/composer visible; all14 targets reachable by sidebar scroll; select last then main. Long identity/role readable; panel/composer bounded; ancestor scroll unchanged.|
| History |390/768/1440|Click HISTORY, await14 previews/no loading; note/title/time/preview readable. Scroll/select final row, verify saved messages and correct panel identity/return to AGENTS. Repeat main selection. Real Enter and Space activation; visible focus. Top/bottom/selected PNGs.|
| Long panel |390/768/1440|Force message scroll; composer remains visible, sidebar scrolls independently, no ancestor jump. Hold/release preview GET for loading, then503 for existing unavailable notice; tabs remain available.|

Measure actual DOM text Range rectangles inside card/ancestor clip rectangles after scrollIntoView, exact expected text, scrollWidth/clientWidth and scrollHeight/clientHeight with existing1px tolerance. Record fonts/rects/scroll offsets; matching CSS declarations alone cannot pass. Root guard: `document.documentElement.scrollWidth <= innerWidth + 1`. Native-resolution screenshots must be inspected for cramping/occlusion and remaining message area. Retain failed check names with PNG/geometry hashes; no threshold relaxation/skips.

### Task 2: Minimal presentation implementation and GREEN

- [ ] After causal RED is retained and owned resources settle, edit existing Scrape rules in place:

```css
.scrape-inspiration__grid {
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr));
}
.scrape-inspiration__info { overflow: visible; }
.scrape-inspiration__name, .scrape-inspiration__developer {
  white-space: normal; overflow: visible; text-overflow: clip; overflow-wrap: anywhere;
}
.scrape-inspiration__category { max-width: 100%; white-space: normal; overflow-wrap: anywhere; }
.scrape-inspiration__clone-btn { flex-shrink: 0; }
```

Preserve gap/padding/fonts/icons/300px scroll/handlers. 320px is a proposed starting value; tune only from geometry, without truncation/count constraints.

- [ ] Replace <=480 rail/max44/max36/hidden-role and <=768 display:none conflicts with one mobile block:

```css
@media (max-width: 768px) {
  .chat-page__layout { flex-direction: column; }
  .chat-sidebar {
    display: block; width: 100%; min-width: 0;
    flex: 0 1 260px; max-height: min(34vh, 260px); min-height: 0;
    overflow-y: auto; overflow-x: hidden;
    border-right: 0; border-bottom: 1px solid var(--border); padding: 0;
  }
  .chat-sidebar__tabs {
    display: flex; position: sticky; top: 0; z-index: 1; background: var(--bg-card);
  }
  .chat-sidebar__sessions { display: flex; overflow: visible; }
  .chat-sidebar__agent { white-space: normal; flex-wrap: wrap; }
  .chat-sidebar__role { display: block; }
  .chat-sidebar__new-chat { white-space: normal; }
}
```

Remove scrollbar hiding. Wrap text children with min-width:0/overflow-wrap:anywhere; session title flex-shrink:1/white-space:normal. Replace tiny .65/.7rem #666/#555 History meta/preview with14px text tokens/wrapping; inactive tab uses text-dim. Preserve panel min-height:0/messages overflow/input flex-shrink:0. Tune height from GREEN; never hide roles/notices or shrink fonts.

- [ ] Change only session root tag to button and add `type="button"`; retain its exact existing className/onClick expressions and children, and close with `</button>`. CSS `width:100%; text-align:left; font:inherit; color:inherit; background:none; border:0; border-left:3px solid transparent` retains current active styling. Add `.chat-sidebar__session:focus-visible { outline:2px solid var(--neon-cyan); outline-offset:-2px; }`. No new state/keyboard handler.
- [ ] Repeat the exact fixed profile with the same data/thresholds and fresh GREEN capture; inspect all screenshots and geometry, exact count25/targets14, console/network denial ledger and original native/server/process closure. A test-body pass with unknown cleanup is unqualified.

## Root delivery gates and self-review

Root owns independent task/branch reviews, stock `npm run build` after freeze, Source/build identity and canonical317/six-route qualification through maintained runners. Native/live validation is separate after reviewed delivery/guarded rollout. No wildcard npm test or owner-sensitive runtime suites for this task. Unrun gates remain unrun; unknown cleanup is not GREEN. No provider sends.

|Conflict/risk|Resolution|
|---|---|
|Frozen Chat|Release only after predecessor; repin final head.|
|Wider cards vs25 rows|CSS only; data/map/300px scroller intact.|
|Rail vs History|Bounded sidebar; all targets/roles accessible.|
|Pointer div vs keyboard|Button/focus-visible; actual Enter/Space tests.|
|Sparse317 vs populated data|Separate profile; canonical identity unchanged.|
|Existing bare launch|New profile uses maintained native lifecycle; old tests untouched.|
|Unavailable resources|Retain failure/owners; no false RED/GREEN.|

Self-review: spec2/3→controls/readability,5→owned matrix. No API/protocol/317 changes, mirrored tests or packages. Acceptance claims remain unexecuted. Source pin mismatch requires reconciliation.

## Inspected source pins (SHA256)

|Path|Bytes|SHA256|
|---|---:|---|
|`src/index.css`|245331|`7d309a0641b50261cdb06b7487b6bf8961aa9d149ad87958fb492f8e2a2af595`|
|`src/components/ChatSidebar.tsx`|6836|`8681d9b2fbf73b0551c8a4ad0eada672220595e2da1ef6dde1d10d69a48122f0`|
|`src/pages/Chat.tsx`|2532|`cc3d8b1631821e5176c22e3eaa112fc81593742f206c84a41a721fa99b0d2bca`|
|`src/pages/Scrape.tsx`|9083|`b257f10989bc91002101d72b3dc656d1d494b5d2df20b41c6c59c68fbdaa33b3`|
|`tests/data-sync-browser.test.ts`|29908|`f2b84cbbb6eb37be9e9c7e4697f61e2fd792d4dc7068d95092032bfd4e38be72`|
|`tests/fixtures/data-sync-browser.tsx`|2274|`f6c56ad7316140b89bcd9544f675dc4ae85538e2ade2767e3da20ae2b45510ca`|
|`scripts/ui-regression-fixtures.mjs`|92492|`6ad561693d85689adfea362f8c7998bb3bc6e5287e70c89738a06d99b87696e4`|
|`scripts/ui-regression-lifecycle.mjs`|38287|`b3eb1ab0bd8ffed848c378a943d6ef4429d6f521509d2fbc61db6afb43a3bdad`|
|`.superpowers/sdd/2026-10-20-chat-provenance-truth/capture.mjs`|2210|`522a3b56e105a2a3e720490a1833184edf047ce5f607bced2f421ea8416cd5a2`|


## Exact supplemental native adapter contract

# Responsive tools supplemental native-adapter contract v1

Candidate only; Root adopts. Clean base `fix/responsive-tools-20261020`/`36610acc1431e073546909e8ceea6485618912ac`, merged PR40/tree equal df9aa72. Author made documentation changes only.

## File Map / staged release

Root capture→Node originals. `tests/fixtures/responsive-tools-owned.ts`→owned adapter. `tests/data-sync-browser.test.ts`→profile/server/interception/geometry. Fixture TSX→actual routes/Layout. Lifecycle/protocol→imports only. Helper mapped/pinned; no import-time effects.

Task1: tests/helper/routes/capture only; Root independently reviews these before native RED. Hold CSS/ChatSidebar until causal RED and proven settlement. Task2: CSS/session button only, then identical profile. Old tests and canonical317 unchanged. Native refusal is setup/UNKNOWN, not RED.

## Exact current imports, signatures and schema boundaries

```ts
import type { Browser, Page } from 'playwright';
import type { UiObservedOwnerV1, UiNativeBrowserOwnerV1 } from '../../server/services/control-ui-worker-protocol.js';
import { UiWorkerLifecycleRecordV1Schema } from '../../server/services/control-ui-worker-protocol.js';
import {
  createUiArtifactStoreV1, createUiNativeLifecycleV1, observeUiProcessV1,
  pinUiFileV1, uiHashV1, uiCanonicalV1,
} from '../../scripts/ui-regression-lifecycle.mjs';
```

Current JS signatures, expressed structurally:

```ts
type Store = {
  root: string;
  json(value: unknown): string;              // canonical JSON SHA256
  png(bytes: Buffer): string;                // PNG SHA256
  record(name: string, value: unknown): string;
  verify(): void;
};
type NativeProof = {
  browser: 'not_started' | 'closed';
  children: Array<{spawnId: string; owner: UiNativeBrowserOwnerV1 | null;
    state: 'not_started' | 'closed'}>;
};
// createUiArtifactStoreV1(root: string): Store
// observeUiProcessV1(pid: number, readPs = internalRealPs): Promise<{
//   pid:number; ppid:number; uid:number; startedAt:string; pgid:number;
//   rawArgs:string; executable:string
// }>
// createUiNativeLifecycleV1(input, effects = {}): {
//   launch(): Promise<Browser | null>; census(): Promise<unknown>;
//   close(): Promise<NativeProof>
// }
```

Input: `{store,jobId,intentHash,ownerHash,owner,cancellationRequested,recordSchema}`. Omit optional descriptor/effects; use real defaults. recordSchema=`UiWorkerLifecycleRecordV1Schema`, parse(unknown)→Readonly<Record<string,unknown>>. Native requires Darwin/arm64, Playwright1.60.0, headless-shell1223/browser148.0.7778.96; no dependency/install/browser fallback.

`UiObservedOwnerV1`: pid/processStartedAt/processGroupId/source=observed_os/executable/script/commandHash. Exported TYPE only, no node-owner validator. Native owner adds kind=native_browser, omits script. Node --test child has flags; use observeUiProcessV1 plus argv check below, not observeUiNodeOwnerV1 with guessed entry argv.

Store root: real absolute uid-owned0700 nonsymlink; `realpathSync(mkdtempSync(join(tmpdir(),'mc-responsive-owned-')))`. json≤1MiB; PNG≤16MiB, signature checked; exclusive0600/fsync. Creates artifacts/children. record accepts owner.json, standalone-intent.json, final-decision.json or UUID child intent/observed/settled/closed/not-started. Other receipts use json. Retain root.

Child record validator requires base `{schema,jobId, intentHash}` plus exact per-kind fields. Lifecycle creates these itself:

|Suffix|Schema-specific fields|
|---|---|
|child-intent.v1|ownerHash,spawnId,kind,family,expectedExecutable,executableHash,playwrightVersion,browsersJsonHash,launchArgsHash|
|child-observed.v1|spawnId,launchIntentHash,owner,parentPid|
|child-settled.v1|spawnId,observedHash,method,rootExit,rootExitObserved,rootCloseObserved,transport,cohort,emptyCensuses|
|child-closed.v1|spawnId,observedHash,settlementHash,close|
|child-not-started.v1|spawnId,launchIntentHash,disposition|

Prefix `mission-control.ui-worker-`; settled requires original exit/close, closed transport, sorted cohort, two empty censuses. Never fabricate records.

Worker-owner schema requires mcBuildHash: Vite Source test has none. Do not fabricate worker-owner/standalone/canonical regression records. Use supplemental JSON with sourcePinHash/fixtureDataHash; child validator unchanged.

## Narrow helper and harness seam

New profile only; construction observes/publishes, launch spawns:

```ts
type OwnedProfile = {
  store: Store;
  launch(): Promise<Browser | null>;
  boundary(): Promise<void>;
  shot(page: Page, label: string): Promise<string>;
  close(): Promise<NativeProof>;
};
type ResponsiveOptions = {
  owned: OwnedProfile;
  responses: Record<string, unknown>;
  icon: { pathname: '/fixture-responsive-icon.svg'; body: string };
};
// harness(name, body, responsive?: ResponsiveOptions)
```

New call `harness('responsive-tools',body,options)`; old two-argument calls unchanged. Merge profile responses/icon only when supplied; `browser=responsive?await responsive.owned.launch():await chromium.launch({headless:true})`. Profile h.shot delegates adapter; h.boundary invokes boundary. Reuse context/network instrumentation. Null/throw refuses; no launch fallback.

Profile finally: release GETs, capture, unmount React, adapter.close; never close CDP default context. Independently settle Vite even if native close fails. New profile retains `http=server.httpServer` before listen; attach connection/close listeners, track original sockets until close. Subscribe to http close before `server.close()`, await both; require http.listening=false, tracked sockets0, intercepted WS0. Publish source/origin/owner-bound closure. No port-adoption claim or forced socket destruction. Old cleanup unchanged; unknown retains cache/evidence.

Adapter sequence (Node standard fs/path/os/crypto imports):

1. pinUiFileV1 inputs: served src/server-shared, test/entry/helper, package/lock, lifecycle/protocol. Ordered manifest path/hash/bytes; sourcePinHash=SHA256(canonical manifest). Check before/after; deny modules outside reviewed trees. No env/runtime/log trees.
2. Create store; statfsSync free bytes≥8589934592; Root current admission required. Set cancellation flag/listeners. Observe owner:

```ts
const observed = await observeUiProcessV1(process.pid);
const executable = realpathSync(process.execPath);
const script = realpathSync(process.argv[1]);
const expectedCommand = [executable, ...process.execArgv, ...process.argv.slice(1)].join(' ');
assert.equal(observed.executable, executable);
assert.equal(observed.uid, process.getuid!());
assert.equal(observed.rawArgs, expectedCommand);
const owner: UiObservedOwnerV1 = Object.freeze({
  pid: observed.pid, processStartedAt: observed.startedAt,
  processGroupId: observed.pgid, source: 'observed_os', executable, script,
  commandHash: uiHashV1(observed.rawArgs),
});
const ownerHash = uiHashV1(uiCanonicalV1(owner));
```

Absolute Node22 command must match. If test-child argv differs, retain/review exact launch shape; no substring/basename bypass. Publish commandHash, not raw argv.
3. jobId=randomUUID(); fixtureDataHash=SHA256(canonical profileData). Store `{schema:'mission-control.responsive-tools-source-owner.v1',owner,ownerHash}`. Intent=`{schema:'mission-control.responsive-tools-source-intent.v1',jobId,ownerHash,sourcePinHash,fixtureDataHash,profile:'responsive-tools-v1',requestedAt:new Date().toISOString()}`. intentHash=SHA256(canonical intent); store.json(intent) returns a different newline-inclusive hash; retain both.
4. `const lifecycle=createUiNativeLifecycleV1({store,jobId,intentHash,ownerHash,owner,cancellationRequested:()=>cancelled,recordSchema:UiWorkerLifecycleRecordV1Schema})`. launch delegates once; boundary checks pins/store/cancellation/floor then census; shot→page.screenshot({fullPage:true})→store.png, plus fixed label/viewport/hash JSON.
5. Store visual candidate before close. Await close once; failure→UNKNOWN with native diagnostic, no retries/adoption/signals. Store native/server/final outcomes, remove only own signal listeners; outer capture requires terminal/EOF. Unknown cleanup fails qualification.

## Fixed data and exact interception contract

Profile-only fixed dataset; canonical317 untouched:

```ts
const at = '2026-10-20T00:00:00.000Z';
const targets = Array.from({length:14}, (_,i) => ({
  id:i===0?'main':`responsive-agent-${i}`,
  identityName:i===0?'Responsive main':i===13?'LongResponsiveTargetIdentityWithoutSpaces0123456789':`Responsive target ${i}`,
  identityEmoji:'🤖', model:'fixture-local', workspace:'/fixture', bindings:0, isDefault:i===0,
}));
const apps = Array.from({length:25}, (_,i) => ({
  name:i===0?'Everyday notes and personal project planning':i===24?'UnbrokenApplicationName0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ':`Representative application ${i+1}`,
  developer:i===0?'Example collaborative software development studio':i===24?'UnbrokenDeveloperName0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ':`Representative developer ${i+1}`,
  icon:'/fixture-responsive-icon.svg',rating:4.5,category:'Productivity and personal planning',
  url:`https://example.invalid/application/${i+1}`,description:`Fixed description ${i+1}`,
}));
const history = (id:string) => Array.from({length:30}, (_,i) => ({
  role:i%2?'assistant':'user', text:`Saved ${id} message ${i+1}: fixed readable history content.`,
  timestamp:Date.parse(at)+i*1000, sessionId:`responsive-session-${id}`,
}));
const profileResponses = {
  '/api/agents':targets,
  '/api/scrape/trending?platform=ios&limit=25':apps,
  '/api/scrape/history':[],
  ...Object.fromEntries(targets.flatMap(t => [
    [`/api/agents/${t.id}/history?limit=1`,{messages:history(t.id).slice(-1)}],
    [`/api/agents/${t.id}/history?limit=40`,{messages:history(t.id)}],
  ])),
};
const icon={pathname:'/fixture-responsive-icon.svg' as const,
  body:'<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" fill="#70d3df"/></svg>'};
```

Exact pathname+search matching is required (Scrape query included). Fulfill icon as image/svg+xml locally. Merge existing shell responses; every unmatched URL/non-GET denied, fallback403 retained. Local `/ws`: no connectToServer, onMessage records denial/closes. Preserve existing Vite token-path branch. No Send/Scrape/Clone/quota-refresh/progress clicks; check presence/focus only.

h.nav changes MemoryRouter, not browser pathname. Wait30 panel messages/14 previews; verify selected panel name and exact saved target text. Real Enter and Space on History rows; missing keyboard root is semantic RED. Scroll all25 clone controls into view without activation.

## Small-height warning variant and evidence limits

Root LIVE390x844 observation: hidden/zero-box tabs,14 targets, ~117px NO_TOKEN banner. Screenshot only CUA memory; viewport reset. Not Source36610 RED or file export.

Supplemental390x844 only; all new-profile mounts use the fixed warning via existing GET. In test scope (`responses` is existing shared map), define before adapter creation:

```ts
const quotaWarning = {snapshot:{available:false,fetchedAt:at,error:{code:'NO_TOKEN',detail:'Fixed local warning fixture'}},
 severity:'unknown',reason:'Kimi quota is unavailable. No local authentication token is configured; provider availability has not been verified.'};
const profileData = {responses:{...responses,...profileResponses,'/api/kimi-quota':quotaWarning},icon,
  viewports:[[390,900],[768,900],[1440,900],[1900,900],[390,844]]};
```

Capture real banner box plus Chat notes/sidebar/header/composer; no injected117px height or private live text. Tune sidebar budget if necessary; no banner/provider/credential change, refresh click, hidden controls or smaller fonts.

Require process/native/server settlement and Source/PNG/geometry hashes. Source evidence only; build/317/live/full8 separate.

Additional SHA256 pins: protocol.ts14648B `c86151b828b64f0d8a3c6a539f122a83a1cc31ef698f2fbfef9b934c7717d734`; KimiQuotaBanner.tsx5647B `53f7c71ac8ba162d245560e5e19bacc916b62fcb34530abfe14fc771f1ca99a7`; api.ts30349B `d7b5320ae16fdd0bea2125be5c58e8d88537822e15df7262078bc7f0a9f33cb5`.


## Root execution refinement

Task1 worker prepares the four mapped test/helper/entry paths, adapts only the supplemental profile and reports frozen Source pins/U10diff for static review. It must not start browsers, Vite/HTTP servers or native fixtures before Root current admission. It may run cheap pure/type/diff checks. Root then owns exact reviewed native RED, full original capture and owned closure inspection; update Task1 evidence after that. Before overall failure collect all safely reachable per-surface/viewport checks/screenshots; dependent interaction after a hidden control stays explicitly unrun, never PASS. Continue independent remaining surfaces. No added skips or lowered thresholds. Task2 changes only CSS and the existing History row root tag/type; after Source freeze Root runs the identical admitted profile for GREEN. Any test/helper correction after static review needs matching pins and scoped review.


## Root exact task boundaries and interfaces

Task1 allowed Source paths: tests/data-sync-browser.test.ts, tests/fixtures/data-sync-browser.tsx, new tests/fixtures/responsive-tools-owned.ts. The Root-owned plan is not worker-editable. CSS/ChatSidebar remain byte-for-byte unchanged until Task2. The ignored capture.mjs adapts the existing direct recorder for the fixed scoped file list and unique phases; no global runner change.

The new helper factory is createResponsiveToolsOwnedProfileV1(input: Readonly<{sourceRoot:string;sourcePaths:readonly string[];profileData:unknown}>): Promise<OwnedProfile>, exported from tests/fixtures/responsive-tools-owned.ts. It returns the exact OwnedProfile interface in the native contract. Caller supplies the selected real source root and a fixed reviewed path list, never CLI/env/user-selected paths; factory validates allowed trees/canonical physical pins and creates its own unique retained artifact-store root. No buildHash/worker-owner/standalone record is invented for a Vite Source test.

Supplemental target IDs use the existing real14 AGENTS metadata; apply deterministic profile names/emoji and long last name, keeping catalog roles present. Canonical317 DATA remains untouched. Keep the fixed payload/endpoint semantics and profile-only warning from the adapter contract. Add a fixed messages-panel positive visible-height minimum48px for all Chat profile widths, preserving at least two normal text lines; capture geometry and inspect cramping. This new supplemental threshold is fixed before RED and never replaces/lowers canonical317 thresholds.

Worker stage is fixture preparation and cheap parsing/type/diff checks only. It must freeze mapped files and report before ANY native/browser/Vite/HTTP launch. Root performs independent static fixture review, makes a clean unqualified fixture checkpoint if required, nominates and runs the exact selected profile, and inspects true causal RED plus complete native/server/outer-original settlement. Then Task1 evidence can be completed. No implementation of Task2 until that gate. Healthy test harness with failing intended presentation assertions is expected; import/setup/custody errors are not causal RED.


## Root fixture isolation ruling

The actual Chat/Scrape fixture routes are enabled only by exact fixed profile=responsive-tools-v1 in the fixture entry URL. Old two-argument harness navigation retains the wildcard placeholder and old WS/request ownership. The supplemental profile mounts the real components under actual Layout; production routes/state remain untouched. The exact mapped Task1 Source paths are three (test, TSX entry, new helper), plus the ignored capture recorder.


## Actual Task1 setup refinement after original v2

The retained v2 original is setup UNKNOWN, not causal UI RED: its exact /@fs/ parser removes the POSIX root and denies its own registered React optimizer files. The native browser cohort, original server/listener/sockets and original process/streams are closed; retained cache and original evidence remain. Independent actual diagnosis/custody report: `.superpowers/sdd/2026-10-20-responsive-tool-readability/task-1-actual-vite-setup-cause-v1.md`, SHA256 `08ec6beb86baef8448db7bdcb5ae05feb70324f614e446f4e60e1e7136428a10`. Root visually inspected the final1440x1000 PNG: blank, no UI result.

Before another Root native launch, correct only the supplemental fixture setup in `tests/data-sync-browser.test.ts`: preserve the leading slash with `slice('/@fs'.length)`; retain all exact physical-path/cache-inode/metadata/publication/uid checks. This is no additional filesystem scope.

Refine the supplemental mock Vite transport separately from application outbound messages: only exact fixture ws origin, path `/`, exactly one `token` query equal to this acquired server's `server.config.webSocketToken`, no URL credentials or other keys. Consume only exact text `{"type":"ping"}` locally and record its count as fixture heartbeat; never forward/connect it anywhere. Every other text/binary frame is denied/recorded/closed, with bounded type/length/hash/time diagnostics and no raw payload/token. Application `/ws` outbound, GET/API/source/external-origin403/service-worker denials remain strict and unchanged. Local installed Vite schedules this exact heartbeat every30000ms even with hmr:false; the old unrecorded WS frame remains inferred, not proven ping.

Retain a bounded supplemental setup stage plus original error name and message hash in final outcome; never raw URL/message/token. Preserve UNKNOWN, error propagation and every cleanup gate. Do not label any setup exception as presentation RED. File Map remains the existing fixture test plus this Root plan; no production, canonical317, helper/native lifecycle, thresholds or dataset change. Freeze and independently review the exact setup patch, then Root executes a fresh capture namespace. Task2 stays gated on actual intended UI RED and owned closure.


### Actual Task1 geometry callback setup correction

Original v3 loads the real fixture with zero denied requests/application errors and captures visible screens, then all five viewport paths encounter `ReferenceError: __name is not defined` in locator.evaluate. Its native/server/socket/process closure is settled, but outcome remains setup UNKNOWN and no geometry-based RED/Task2 credit is claimed. Keep all original PNG/JSON/cache/streams. The existing geometry callback assigns local arrow helpers box/inBox; tsx name preservation injects a Node-side helper into serialized browser code. Inline those rectangle projections/predicates inside this supplemental callback so it is self-contained; do not inject a global shim, change transpiler/launch settings or relax any assertion/threshold. Same one test-file File Map, independent scoped review and fresh Root native capture remain required.


## Root Task1 actual v4 gate and Task2 refinement

Actual v4 responsive-red-original-v4 naturally exited1 with both original EOFs, unchanged Source, zero setup/network/application errors and settled native/server/socket/process closure. Independent whole-phase review task-1-responsive-v4-actual-review-v1.md SHA256 f3ccc63924d1f06ed527cee3c1cbdbf25b6c41d3f84301ad5d7cf60297e9f3b7 supports bounded causal RED (spec C0/I0/M0). Root inspected every27 unique native PNGs representing29 candidate capture labels; stable exact copies and manifest live in v4-reviewed-screenshots. Actual status487pass/318fail/28unrun is preserved; repeated measurements are not318 distinct bugs. Root gate: Task1 causal RED/custody/visual review complete, Task2 may begin. No GREEN/317/build/live/full8 qualification.

Observer-quality I1: desktop History was initially visible, then scrolled above the sidebar clip; this proves lost persistent visibility, not intrinsic unreachability. Adopt persistent AGENTS/HISTORY tabs throughout sidebar scrolling at every tested width as the explicit presentation requirement, using the existing unchanged visibility/availability checks. Add sticky positioning to the shared tabs rule, not only mobile. Do not change the observer, scroll it into view to erase the original failure, or claim the prior seven desktop/21 mobile downstream checks ran. The same GREEN profile must now execute and pass all28 downstream observations.

390x844 measured warning117px, sidebar36px, panel header117px, messages231px, composer52px. With other extents fixed, sidebar260px leaves7px messages;219px is the conditional48px threshold bound. Replace the proposal's260px starting budget with a conservative180px mobile sidebar cap/basis (bounded further by viewport height), retaining all controls, readable14px roles/meta/preview, scrolling and truthful notices. This is a starting layout, not a passing result; Root GREEN geometry/screenshots must prove at least48px messages and usable context, and may require a reviewed CSS tuning loop. No font/notice/role hiding or threshold change.


### Root actual GREEN-v1 observer refinement

Actual responsive-green-original-v1 atd9431345 naturally exits1/UNKNOWN with complete original/native/server/socket closure. Independent actual review task-2-green-v1-actual-review-v1.md SHA5650a12598408d2112fe36a9951c9336edf25a1b97fff75e442e644ebd7661a3 verifies1934artifacthashes and988partialpasses; no recorded assertion failures. Fourviewports stop afterEnterselection beforeSpace: a stale readyHistory generation can satisfy reentry readiness before the neweffect replaces rows. ExactReactinterleaving remains inference; no production lifecycle defect is established. The exception catch also omits interrupted/dependent UNRUNcoverage. Preserve originalUNKNOWN and allmissingtail as unexecuted; noGREENcredit. Cache remainsretained, custodyclosed.

Fixture-only follow-up in tests/data-sync-browser.test.ts plus this Rootplan: make every relevant History reentry ready for its newly initiated local previewrequest cycle. Use the existing exact-path hold/release seam for lasttarget previewGET, observe newrequest/loading state, release and await fresh14row/no-loading readiness before interaction; retain bounded prefix/cycle/stage evidence. Release on all paths and preserve thrownUNKNOWN on any missingphase. No arbitrary sleeps/blind retries/swallowed detachment/widerallowlists or production effect change. The observer must honestly enumerate interrupted and remaining planned checks as UNRUN on exceptions, retaining originalexception and earlierpasses/failures. Keep all current assertion names, thresholds/dataset, realkeyboard/pointer checks, ownership/Source/network/socketguards, canonical/defaulttests and317 unchanged. ProductionCSS/Sidebarpins remain frozen5d8ed119/bda840c9. Independently review exactfixturepatch before Rootfreshsameprofilecapture. Readable87px messages at390x844 is partialgeometry, not finalvisualacceptance; no font/role/notice reduction.


## Original-event settlement diagnostic refinement

Actual GREEN-v2 failed the unchanged8GiB floor and the outer immutable receipt has originalsSettled=false/missingstdoutClose. Independent auditdb459cfd verifies native/server/socket physical closure only;758partialpasses/16explicitUNRUN and unobserved laterwidths are not GREEN. No retrospective receipt repair.

File Map: ignored scratch capture-v2.mjs joins the six actual original callbacks before one-shot publication; bounded1000ms post-child-close deadline publishes missing-event failure only. Exact Node/cwd/argv/env/pins/exclusive0600/fsync remain. Its tiny VM fixture exercises the real recorder handler tail. tests/fixtures/responsive-tools-owned.ts adds actual availableBytes/fixedFloorBytes to the existing failure message, preserving8589934592n comparison/control flow. Immutable capture.mjs/originals remain untouched. Root owns this plan and delivery.

Preparation report557ea6f7 and independent review12454d78 have no blocking finding; old recorder produced genuine early-publication RED and new join tinyfixtures passed. Static evidence is not physical event/resource/native GREEN. Currentfree<8GiB: no newheavy run. New actual nomination must pin the reviewed candidate/helper and recheck current capacity. Deferred low finding: tinyfixture covers only0/null callback payloads and parseable timestamps; final whole-branch review must triage distinctive nonzero/signal/time metadata assertions.


## Final whole-branch review and one sender fix wave

Final architecture/spec review at2773b528: C0/I0/M2, report final-whole-branch-review-v1.md SHAd30a08734f770ea86b7b0116fdb7ddb5a3a97fb586b01dab65aaeafae4bef4ed. Exact supplemental GREEN3 independently qualified1029passing observations/0fail/0UNRUN/all5normalboundaries, native/original/server/TCPclosed. Root viewed57planned contactoverview plus3original-size desktop/tablet images and final390x844. Those results remain pinned tooldbytes, not an automatic pass for the following amendment. Build/canonical317/delivery/full8 are stillopen.

Task final: minor M1 accepted for correction before readability closure. Confirmed unbroken orange message-sender escapes local message viewport at390 despite wrapped selected-target header. File Map extends only existing src/index.css .chat-msg__from rule and tests/data-sync-browser.test.ts supplemental profile, plus this Rootplan. Keep ChatPanel logic/content/roles/fonts/data unchanged; no API or state effects, overflow hiding, ellipsis, truncation, fixedheight reduction or new dependency. Minimal shrink/max-width/overflow-wrap behavior should preservefulltext inside local messages.

| Shared interface/task | Finding and resolution |
| --- | --- |
| Earlier Task2 sidebar/header vs final sender | Existing fixture verifies header text but misses separate chat-msg__from; add exact existing long sender Range containment and messages internal scrollWidth/clientWidth assertions at the four existing Chat viewports. Reuse real fixeddata/native capture, preserving all current planned checks/screenshots/thresholds/UNRUN inventory. |
| Final fixture vs production | Fixture-only first with SourceCSS unchanged. Independentstaticreview, Root clean unqualified checkpoint, fresh genuine sender geometry RED and closedcustody; then onlyCSSwrap amendment and independentreview, Root freshsameprofileGREEN with all old and new checks. |
| Recorder M2 vs shipped source | Exactpayload/timeVMcoverage improvement is explicitly deferred before future recorder changes/failure-metadata claims; no current loss established and helper isignored. Old successfulactual metadata not rerun solelyfor deferredcoverage. |

Ruling: fix confirmed senderM1 as the single final whole-branch fix wave — it directly serves the already-approved full identity readability outcome with a small source-owned change — if wrong, extra geometry/test work may be needed or the dense mobile panel may need another design decision; no guard/data weakening is authorized.
Ruling: defer recorderVM nonzero/signal/deterministic-time coverage per finalreview — ignored helper forwards actualmetadata correctly and actualGREEN3custody isclosed — if wrong, a future recorder metadata regression could evade the tinyseam until coverage is added; this is no authority for future metadata claims.


## Verified supplemental Source milestone closure

At clean8aeb8900, finalsenderGREEN920406/session24048/naturalcompletion6e5e59exit0 passesall1037observations(1029old+8new), zero fail/UNRUN, allfiveviewportnormalboundaries and57plannedcaptures. Independentwholeactualaudit0221e4f3f721930fbf5aa23ca7abb651c8fe55ab2e07564b9a83f3c3351b7ca2 C0/I0/M0 qualifiesoriginal/native/server/TCP51943closure; exactcandidatec91e14132ee51388e97eec93bfcb3caf7247788cce635b2d94ab381298717da9. Root10originalaffected-statePNGreadbackef2e1d3e91b2f380df49bdd17491b5276997aa70b1a24e4f5df6f940e71eead8 closesboundedhorizontalM1. Short844keyboard-selectedimagesretainordinaryverticalscroll/densitylimits; fulltext-afterpointer-scroll geometrypasses andheader/composerremainavailable. No claimalltextsimultaneouslyvisible.

Finalwholebranchd30a0873 C0/I0/M2 andsinglefixwavefinalscopedreview0439a3f6b67986d1e5de0640d2b40207565b76094acff1d56db334b0bddac24c C0/I0/M0; committednetU10equalsreviewed5aa757a1. M1Source/measuredpresentationcomplete; recorderM2explicitlydeferred/nonblockingbeforefuturemetadatahelperchanges. ImplementationandsupplementalSourceverificationcomplete; oldRED/UNKNOWNretained. Thisappendisledgeronly; allproduction/testpinsremainexact8aeb8900bytes. Clean-mainstockbuild, reviewedGitHubdelivery/freshruntimeactivation, finalcanonical317/livepages/full8 remainOPEN. Preserveunknownstandalone17/18andbuildonlyinfreshownedrelease, notwriterdist.
