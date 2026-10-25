# Setfarm pipeline filters implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Make Setfarm's existing search and status controls filter its workflow list and preserve a usable empty-to-populated transition.

**Architecture:** SetfarmActivity owns one status value shared with PipelineView's status chips. PipelineView applies the search and the existing canonical-snapshot status predicate together, without filtering the roster, activity or authority inputs. Move its existing detail-navigation hook ahead of conditional returns so changing filters cannot change hook order.

**Tech Stack:** Existing React, TypeScript, node:test, react-dom/server and Vite; CUA for browser validation.

**Spec:** `docs/superpowers/specs/2026-10-19-operator-workspace-design.md`. This is a causal refinement of the approved functional-correctness and tool-preservation outcome: the existing controls currently do nothing. Browser evidence: `logs/2026-10-21-controls-current-evidence-v1/ui-20261025-mc-disconnected-search-red-v1.png` in the canonical workspace; source audit `ui-20261025-setfarm-source-audit-v1.md` beside it.

## Global Constraints

- Preserve every technical destination and the eight RunDetail tabs.
- Preserve failed/cancelled history and all runtime/secret/admission guards.
- Unknown is explicit, not numeric zero.
- Root alone stages, commits, pushes and delivers. Only one implementation worker per repository at a time.
- Live ports remain 3080/3333/18789. No provider calls, live state mutation or service restart for unit/UI fixtures.
- No new external dependency. English product copy remains.
- Do not build/edit the current live MC checkout during implementation.
- No shared Homebrew mode, credential, Setfarm Source, manual reservation or service changes in this task.

## File map

- Modify `src/pages/SetfarmActivity.tsx`: connect the existing header controls to the list, with accessible names.
- Modify `src/components/PipelineView.tsx`: optional controlled status/search props; preserve its standalone local status mode, snapshot authority and counts; fix the conditional hook.
- Create `tests/pipeline-filter-render.test.tsx`: real-component SSR behavior regression for ignored query/status props and unknown snapshot handling.
- Create `tests/fixtures/pipeline-filters-cua.html` and `tests/fixtures/pipeline-filters-cua.tsx`: isolated real SetfarmActivity with fixed in-memory API data, solely for CUA validation; no application backend or live network.

### Task 1: Connect workflow filters and preserve rendering through empty results

**Interfaces:**
- `PipelineView` accepts optional `searchQuery?: string`, `statusFilter?: string`, `onStatusFilterChange?: (status: string) => void` in addition to `runs` and `onRefresh`.
- SetfarmActivity initializes its status to `all`; its All statuses option uses `all`. It passes all three props to PipelineView.
- When `statusFilter` is absent, PipelineView retains its current local filter behavior. When present, chips call the supplied callback. Do not use a legacy run.status fallback when the operational snapshot is unavailable.
- Query matching is trimmed, case-insensitive substring matching over task, workflow, id, and the displayed run number (`#12` and `12`). The task already contains any Project label; do not parse arbitrary context or invent project fields.
- Search and canonical status predicates compose with AND. Existing daily-standup exclusion and descending run-number order remain.
- Roster/feed data and snapshot polling inputs remain the complete original run collection. Filter counts retain their existing canonical-status meaning.

- [ ] **Step 1: Write real-component behavior regression first.**

Use node:test, MemoryRouter, renderToStaticMarkup and a complete PipelineRun fixture. Install the existing minimal document.querySelector stub before dynamically importing PipelineView (API metadata reads it at import). Never mount a real backend. The causal assertions must exercise the real component, for example:

```tsx
const html = renderToStaticMarkup(<MemoryRouter><PipelineView
  runs={[run]} searchQuery="does-not-match-any-run" /></MemoryRouter>);
assert.match(html, /No runs found/);
assert.doesNotMatch(html, /Searchable task title/);
```

Also assert case/trim and id/workflow/run-number matches; nonmatching query empties; an explicit failed filter excludes a row whose legacy status says failed when no authoritative snapshot has loaded; all keeps the unknown row discoverable; no input collection mutation. Unknown is not a failed/completed assertion. Assert visible outcomes, not source text, private function names or mock elements.

- [ ] **Step 2: Run the focused test against unchanged production code and retain its semantic failures.**

Run `/opt/homebrew/Cellar/node/26.4.0/bin/node --import tsx --test tests/pipeline-filter-render.test.tsx`. Expected causal RED: ignored search/status props leave the run visible. An import, fixture or tool failure is not causal RED. Run existing `tests/navigation-render.test.tsx` as a cheap baseline.

- [ ] **Step 3: Implement the narrow wiring and hook-order fix.**

The existing header state passes to the real component:

```tsx
<PipelineView runs={pipeline} searchQuery={filterSearch}
  statusFilter={filterStatus} onStatusFilterChange={setFilterStatus} />
```

Inside PipelineView derive effective status from the controlled prop or existing local state. Chips update the callback in controlled mode and local state otherwise. Normalize only search text, not canonical status. Apply the search predicate with the existing workflow/status filters and sort. Define `handleOpenDetail` with its current useCallback before the first conditional return. Do not change Stop/Resume/Delete handlers, guards, snapshot parsing or API requests.

- [ ] **Step 4: Add the isolated CUA fixture and run GREEN/build.**

The fixture renders the real SetfarmActivity within MemoryRouter and ToastProvider without Layout/global synchronization. It seeds useAppStore with one synthetic cancelled workflow and empty roster/activity/workflow/session collections. Replace only its API boundary methods used by this component with fixed in-memory results: runOperationalSnapshot (complete valid known fixture), runErrors, setfarmAgentFeed. Unexpected fetches must be locally rejected; no live DB/provider URLs. A small fixture heading clearly says this is synthetic and not live Setfarm evidence. Use an existing complete operational snapshot fixture/type rather than a permissive parser stub. Do not import the server or any credentials.

Run the focused new and adjacent tests, then `npm run build` in this nonlive sole writer. Capture complete output and natural exit codes; do not rerun successful checks without new changes/failures.

Root then serves only this fixture/source through Vite with envFile:false, configFile:false, proxy:{}, host127.0.0.1, an unused non-live port, and explicit local /api and /ws rejection. Browser interaction is CUA only. Root verifies: initial cancelled row; unmatched search empties; clear restores; Failed empties; Cancelled restores; status chips and header remain in sync; repeated empty/populated transitions produce no React error; canonical locked actions remain locked. Save source-bound screenshots. The fixture is UI-only proof, not full8/genuine or live rollout.

- [ ] **Step 5: Review and deliver through the primary owner.**

Implementation worker writes a report and leaves source changes uncommitted for Root. Root reviews full diff, test output and browser evidence, stages and commits only this scope, obtains independent task and whole-branch review, then pushes a scoped PR. A live transition requires a separate source/build-bound rollout check; do not restart services as part of this task. Preserve its workspace/evidence under repository continuity rules.

## Self-review

One tightly bounded task; no cross-task shared files. Public props and fixture assertions exercise the existing user controls. Snapshot status remains the sole status authority; empty transitions require stable hook order. No API/version repair, metric redesign, log clearing or catalogue removal is bundled. The larger v3 Product Build Authority gap is separately recorded by the audit.
