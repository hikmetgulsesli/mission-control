# Workflow and Files Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Root alone stages, commits, pushes, merges and rolls services.

**Goal:** Correct two observed Mission Control presentation defects while preserving technical tools and truthful runtime state.

**Architecture:** Keep API data and handlers intact. Correct semantic identity at the existing workflow consumer and flex sizing in the active stylesheet.

**Tech Stack:** Existing TypeScript, React, CSS, Node test runner, Playwright.

**Spec:** docs/superpowers/specs/2026-11-13-workflow-and-files-display-design.md

## Global Constraints

- Existing sole M worktree, branch fix/workflow-and-files-display-20261113, base1cd59e09; no new worktree or second source writer.
- No dependency, API/DB/provider/permission, generated-project or technical-tool removal changes.
- Keep production MC86147/source1cd and Setfarm e3cc unchanged during the real case.
- Use focused regression and one clean build; preserve all new records and npm cache.
- Agents are non-delivery: no git stage/commit/push/PR/service effects.

### Task 1: Resolve semantic workflow stage identity

**Files:** src/components/WorkflowKanban.tsx; optionally src/lib/types.ts; tests/workflow-kanban.test.tsx.
**Consumes:** WorkflowKanban({workflows:Workflow[],runs:Run[]}) and raw run steps with UUID id plus step_id/stepId.
**Produces:** Correct existing af-step status/clickable classes, same selected raw row/output, semantic output header.

- [ ] Add an actual React server-render regression using node:test, node:assert/strict, React and renderToStaticMarkup. Representative fixture:

```tsx
const workflows = [{ id: 'feature-dev', name: 'Feature', steps: [{id:'implement',agent:'developer'}, {id:'verify',agent:'reviewer'}, {id:'deploy',agent:'deployer'}] }];
const runs = [{ id:'run-one',workflow:'feature-dev',status:'running',steps:[{id:'db-uuid',step_id:'implement',agent:'developer',status:'running'},{id:'other-uuid',step_id:'verify',agent:'reviewer',status:'done',output:'verified'}] }];
const html=renderToStaticMarkup(<WorkflowKanban workflows={workflows} runs={runs}/>);
assert.match(html,/af-step--running/);
assert.match(html,/af-step--done af-step--clickable/);
```

Cover semantic-over-UUID precedence, camelCase, legacy id fallback, failed clickable, missing waiting, and unrelated workflow/non-active-run isolation using the actual component, not an exported copy of the expression. Keep cases proportional.
- [ ] Capture original RED: `node --import tsx --test --test-reporter=tap tests/workflow-kanban.test.tsx`; record exact command/PID/exit/private log. A fixture setup/import error is not a genuine bug RED.
- [ ] Replace lookup with semantic precedence, e.g. `(rs.step_id || rs.stepId || rs.id) === step.id`. Use one local identifier helper if needed for the same modal header. Extend RunStep only with optional `step_id?:string; stepId?:string` if needed. Preserve unknown status behavior and output handlers.
- [ ] Run the same focused test GREEN and `git diff --check`; report changed files, original results and any limitations. Root commits after reviewing the report.

### Task 2: Fill Files preview and retain responsive layout

**Files:** src/index.css only; local bounded browser fixture/screenshots under this plan workspace.
**Consumes:** Existing .files-page__panels/tree/viewer and .file-tree__name/meta markup/styles, including mobile overrides.
**Produces:** Full-width preview, bounded long names, preserved stacked viewer.

- [ ] Capture current desktop/mobile geometry with actual stylesheet in a small local Playwright fixture using existing dependency/browser; no live DB or mutating file API. Use representative files markup and a long filename, then record panel/viewer right edges, page scroll width, name/metadata bounds at1440/768/390. This is a visual check, not a full browser campaign.
- [ ] Apply the minimal active CSS change:

```css
.files-page__panels { flex: 1; min-width: 0; }
.files-page__viewer { flex: 1 1 0; min-width: 0; }
.file-tree__name { flex: 1; min-width: 0; }
```

Replace conflicting existing flex-shrink declarations in those exact blocks; preserve tree/mobile overrides. Adjust mobile flex basis only if the actual geometry proves collapse. No inactive stylesheet or general page redesign.
- [ ] Re-run the same geometry checks and capture screenshots. Desired browser assertions: desktop viewer fills panels within2px; long filename does not overlap metadata or escape tree; stacked viewer has positive usable height and page scrollWidth <= viewport width+1. Record browser startup/normal close and resource use. No broad matrix.
- [ ] Run `git diff --check`. Root inspects task report and commits; independent task/whole review. Root runs one clean `npm run build` on final reviewed source, then normal reviewed PR delivery. Live MC rollout waits for appropriate owner/active-case conditions and separate exact operational material; actual live screen readback required before claiming UI delivered.

## Execution and review rulings

Ruling: use existing owner approval/standing authority instead of repeating spec approval or execution menus; the owner explicitly asked to continue all UI repairs while away. Scope is two source-backed defects and preserves all tools. Cost if wrong: reversible small UI diff.
Ruling: reuse existing M, existing dependencies and focused checks; no new workspace clone, blanket npm test or baseline suite. Root/repo/user proportional verification instructions take priority over generic skill full-suite/install guidance. Cost if wrong: unrelated baseline defects remain outside this patch and are not claimed qualified.
Ruling: preserve local evidence workspace because the owner explicitly protects new records; never apply skill cleanup deletion.
