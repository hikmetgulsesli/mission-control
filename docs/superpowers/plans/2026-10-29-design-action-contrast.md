# Design action contrast implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Execute the single bounded task without a repeated approval loop.

**Goal:** Make the explicit design retrieval action readable in the existing dark theme.

**Architecture:** Correct the already loaded shared action CSS rule using existing theme tokens. Keep all data flow and provider behavior unchanged. Verify with a stock build and a script-free static native-browser preview.

**Tech Stack:** CSS, existing Vite/TypeScript build, native Chrome through cua_repl.

**Spec:** `docs/superpowers/specs/2026-10-29-design-action-contrast-design.md`.

## Global constraints

- Use the existing sole Mission Control writer on `fix/design-action-contrast-20261029`, based on bb14788d.
- Root alone runs build/preview/delivery. The implementer edits only `src/index.css` and its private report, never commits or starts processes.
- No new test that asserts CSS spelling or mirrors the rule: the developer instruction excludes tests for low-impact reversible changes. Build, source review and actual visual comparison verify this presentation-only fix.
- Preserve all historical captures/workspaces and runtime guards. No service transition, provider call, generated-project repair or direct main commit.
- Runtime remains bb14788d; source correction is not a live rollout. Parent startupfalse, Full8UNKNOWN/reservation, annualpending and cancelled NEW-worker remain.

## File Map

| Path | Responsibility |
|---|---|
| `src/index.css` | Loaded production action style; only the design-action rules change |
| This plan and linked spec | Root scope, acceptance and recorded decision |
| `.superpowers/sdd/2026-10-29-design-action-contrast/` | Private author/review/build/preview records; never committed |

### Task 1: Correct shared action styling

**Files:** Modify `src/index.css` at `.af-design-card__btn`. Write private `task-1-report.md` in this plan's workspace.

**Interfaces:** Consumes the existing `af-design-card__btn` class on the retrieval/retry buttons and View HTML links. Produces readable styles with unchanged React and API behavior.

- [ ] Replace the existing two rules with the following scoped styles, preserving the existing 14px typography:

```css
.af-design-card__btn { font-size: 14px; color: var(--neon-cyan); background: var(--bg-card); text-decoration: none; padding: 4px 10px; border: 1px solid var(--neon-cyan); border-radius: 4px; cursor: pointer; transition: background 0.2s, color 0.2s, border-color 0.2s; }
.af-design-card__btn:not(:disabled):hover { background: var(--neon-cyan); color: var(--bg-primary); }
.af-design-card__btn:disabled { opacity: 0.55; cursor: not-allowed; }
```

- [ ] Self-review the exact diff. Confirm no other rule, component, runtime, request or file changed. Do not run tests, a build or a server; Root performs acceptance.
- [ ] Write the report with changed files, why the original rule failed, checks performed/not performed, risks and no-live-rollout limitation. Relinquish ownership.
- [ ] Root runs `npm run build` in the existing isolated writer, records original natural result and preserves its log. No full139 suite repeat is needed for CSS only.
- [ ] Root creates a private script-free HTML preview using a byte-identical copy of the changed production CSS and actual class on an enabled button, link and disabled button. Open via native Chrome; capture normal and keyboard-focus states. No Retrieve request is wired.
- [ ] Independent task and whole-branch review; Root stages the exact source/spec/plan, commits conventionally, pushes the scoped branch and delivers reviewed PR under standing authorization. No runtime rollout is implied by merge. Preserve the workspace as evidence.
