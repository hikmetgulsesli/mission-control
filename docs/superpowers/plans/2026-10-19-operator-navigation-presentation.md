# Operator navigation and presentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every technical tool easy to find and every operator page readable.

**Architecture:** One typed navigation registry drives groups, search, favorites, active state and shortcuts. Existing routes and canonical run components remain; presentation uses shared tokens plus targeted readability fixes. Polling ownership changes follow a consumer census.

**Tech Stack:** Existing React/Router, TypeScript, CSS, Zustand, node:test/tsx and React SSR.

**Spec:** `docs/superpowers/specs/2026-10-19-operator-workspace-design.md`

## Global Constraints

- Root alone stages, commits, pushes and delivers. Only one implementation worker at a time.
- Preserve existing English source/UI copy; design Turkish terms are conceptual English equivalents, never guard exceptions.
- Preserve every technical destination, bookmarks, Office state, shell and all eight RunDetail tabs.
- Sans body15px; ordinary controls14–16px; mono only code/log/IDs; no blanket font-size !important rule.
- No provider calls, live state mutation or service restart for unit/UI fixtures.
- Missing, stale and unknown evidence never become zero or success.

---

### Task 1: Registry, grouped navigation, search, favorites and shortcuts

**Files:** Create `src/lib/navigation.ts`, `src/hooks/useNavigationPreferences.ts`, `tests/navigation.test.ts`, `tests/navigation-render.test.tsx`; modify `src/components/{TabNav,Layout}.tsx`, `src/index.css` navigation section only.

**Interfaces:** `NavigationItem` has id,label,group,href,shortcut?,external?,action?; export `NAVIGATION_GROUPS`, `NAVIGATION_ITEMS`, `resolveNavigationShortcut(event)`, `isNavigationItemActive(item,pathname)`. `resolveNavigationShortcut` returns `{type:'navigate',href:string}|{type:'shell'}|null`. `useNavigationPreferences` returns known favorite IDs and toggle; versioned storage is UI preference only. Registry includes `/controls` before its separate page lands, but do not deliver a broken route; Root integrates only after Controls task.

- [ ] Add actual registry/shortcut/preference tests and SSR of real TabNav with MemoryRouter. Assert all retained URLs/groups/searchable labels, contextual run active state, Shell action and favorites filtering.

```ts
assert.equal(resolveNavigationShortcut({key:'D',target:null} as KeyboardEvent)?.type, 'navigate');
assert.equal(resolveNavigationShortcut({key:'p',ctrlKey:true} as KeyboardEvent), null);
assert.ok(NAVIGATION_ITEMS.some(x => x.href === '/agents'));
```

- [ ] Run `node --import tsx --test tests/navigation.test.ts tests/navigation-render.test.tsx`; capture RED.
- [ ] Implement standalone Overview and groups Work(`/setfarm`,`/setfarm/active`,`/live`), Projects(`/projects`,`/prd`), System(`/ops`,`/controls`,`/changelog`,explicit3333dashboard), Tools(`/office`,`/chat`,`/agents`,`/files`,`/scrape`,`/rules`,`/workflows`,`/tasks`,Shell), Usage(`/costs`,`/performance`); preserve `/perf` alias/contextual run URLs. Use button aria-expanded/focus and search input labels. Favorites persist safely with invalid/unknown-ID filtering. D/P case-insensitive; preserve0–9/R/L, skip inputs/select/contenteditable, IME and Ctrl/Meta/Alt. Escape closes shell and open menu. Office remains mounted/visible according to current semantics.
- [ ] Run focused tests; record actual SSR coverage and later browser checks needed. Root commits `feat(nav): group tools with search and favorites`.

### Task 2: Readability, restrained theme and responsive roster

**Files:** Modify `src/index.css`, `src/components/{Layout,GlitchText}.tsx`, `src/pages/Agents.tsx`; targeted ordinary page/component inline style sources found by census (list exact added files in report before edits). Create `tests/operator-theme-render.test.tsx` for meaningful actual component semantics if needed; avoid implementation-mirroring CSS snapshot tests.

**Interfaces:** Preserve existing component props and semantic state colors. Shared `--font-body`/`--font-mono`, surfaces/text/border/accent tokens used by existing classes; no new UI dependency. Functional plan owns StatusBar metrics behavior; this task changes its styles only after that task is reviewed.

- [ ] Record baseline actual render/browser evidence (audit screenshot paths), inspect ordinary8–12px inline sizes and mono usage, identify roster width defect. Any new behavior gets meaningful RED before implementation; reversible CSS edits need visual checks, no artificial failing test.
- [ ] Set body sans15px, ordinary controls14–16px, readable muted contrast and calmer surfaces. Remove ScanlineOverlay mount; change GlitchText ordinary heading behavior once, preserving API/accessibility. Fix `.agents-page__grid` flex1/min-width0/width100%, preserve auto-fill columns, stack selected panel on narrow widths. Preserve log/code mono and PixelOffice artwork. Replace targeted tiny ordinary labels rather than blanket overrides.

```css
.agents-page__grid { flex: 1; min-width: 0; width: 100%; }
body { font-family: var(--font-body); font-size: 15px; }
code, pre { font-family: var(--font-mono); }
```

- [ ] Run `npm run build` after Root source commit if clean build identity requires it, and existing `npm run render:smoke`. Later isolated browser fixture verifies all routes/tabs at390/768/1440, no horizontal overflow, actual computed fonts, roster columns and focus. Preserve screenshots including failures. Root commits `style(ui): improve operator readability`.

### Task 3: Visibility-aware polling with honest stale state

**Files:** Modify `src/hooks/useDataSync.ts`, its actual consuming store types and PixelOffice polling only after census; create `tests/data-sync.test.ts` or actual hook browser fixture coverage. Document exact expanded FileMap before edits.

**Interfaces:** Preserve current store methods and canonical operational snapshot hook owner. Add observed/error/stale metadata without replacing retained data with zero. Use existing document visibility API and route-consumer groups; no second expensive run snapshot poller.

- [ ] Enumerate every useDataSync endpoint/store consumer by route, and hidden PixelOffice effects; report mapping before deciding ownership. Preserve shared status/summary cadence15s unless actual need differs.
- [ ] Write behavioral scheduler tests with injected timer/fetch/visibility for pause/resume, route-switch endpoint groups, old response ordering and partial errors; browser fixture checks actual hidden Office. Capture RED for changed behavior.

```ts
assert.equal(fetchCallsWhileHidden, 0);
assert.equal(state.lastGoodData, previousData);
assert.equal(state.stale, true);
```

- [ ] Implement bounded visibility/route gating and stale/error timestamps, ensuring resumed fetch and no lost consumers; unchanged operational snapshot owns its polling. No empty-array/zero fallback on failures.
- [ ] Run actual covering tests, type/build checks and later UI fixture. Root commits `perf(ui): scope visible data polling` and obtains whole-plan review.
