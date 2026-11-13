# Truthful workflow stages and usable file preview

## Scope and authority

The owner requested page-by-page visual inspection, fixing broken functions and simplifying presentation while retaining all frequently used technical tools, then explicitly approved doing the work and continuing autonomously. Existing audit screenshots 10-files.png and 14-workflows.png plus source readback establish these two bugs. Standing owner authorization applies to their reversible source/test/docs changes and reviewed delivery. This is bounded repair, not a new feature or an operational permission change.

## Design and alternatives

Use the smallest presentation fix: join workflow stages by semantic `step_id`, then `stepId`, then legacy `id`; let the file preview occupy available panel space and allow filenames to shrink beside fixed metadata. This directly repairs the observed behavior. An API normalization rewrite would touch unrelated consumers; a page redesign would obscure the functional repair. Both are outside this patch.

Workflow cards consume the existing active run only. A database row UUID is record identity, not stage identity. Preserve raw status, missing/unknown-as-waiting, workflow/run isolation, done/failed output-click behavior, and existing modal output/close handling. If the output header uses an identifier, show the same semantic identifier. Add optional semantic keys to RunStep as needed; do not rewrite backend data or infer success from ordering.

The active CSS entry point is src/index.css. Panels should fill their parent, the desktop tree should retain its existing bounded width, and the viewer should use remaining space with min-width:0. Filenames should flex and ellipsize while existing metadata remains readable. Preserve existing stacked mobile layouts, 100% tree width and 40vh tree cap. Preserve all file navigation/edit/save/cancel/upload/context handlers. No broad contrast, typography or catalog changes are included.

## Evidence and acceptance

Task1: a focused actual-component rendering regression must fail before the join fix and pass after for API UUID+step_id, camelCase, legacy fallback, semantic precedence, active-run/workflow isolation and absent stage state. Done/failed remain clickable; waiting/running remain appropriately non-clickable. No complete backend fixture is needed.

Task2: inspect desktop 1440 and stacked 768/390 layouts using the actual stylesheet and bounded local browser fixture. Assert viewer fills available panel width, long filename fits without displacing metadata, and viewer remains visible without page horizontal overflow on mobile. Capture screenshots. CSS need not grow a synthetic unit-test matrix.

Run focused tests and one clean npm run build after Root commits. Do not reinstall dependencies, run the full backend suite, change live services during the active Setfarm case, or claim live UI completion before actual post-delivery visual readback.

## File Map

- src/components/WorkflowKanban.tsx: semantic lookup and output-header identity.
- src/lib/types.ts: optional API semantic stage keys only if needed.
- src/index.css: file panels/viewer/name flex sizing; existing mobile rules retained.
- tests/workflow-kanban.test.tsx: actual component regression.
- .superpowers/sdd/2026-11-13-workflow-and-files-display/: local ledger/captures/browser fixture/screenshots; preserve as new records.

## Non-goals

No backend, database, provider, model, permission, workflow recovery, runtime guard, generated project or tool removal changes. Current Setfarm sourcee3cc remains frozen; its real fb2b3ae2 case is observed in parallel.

## Task2 review refinement: preserve long preview access

The finite panel must retain access to every file line via its existing scroll container. Source review found that `.file-viewer__content` still has flex-shrink:0 while the containing viewer clips overflow. Confirm with an actual-component long-file fixture before changing source; then make the existing content area flex/shrink (flex:1; min-height:0) if clipping is reproduced. Preserve header/edit/download controls and current overflow:auto, line numbering and code content. This is a causal preservation requirement for the original flex change, not a new viewer feature. Recheck the original three widths and add last-line reachability in the same fixture. No unrelated header or editor redesign.

Ruling: measured tightened RED11707 proved nested pre clipping after content flex/min-height alone. Author scope explicitly refined to add only `align-items:flex-start` in `.file-viewer__content`; this retains intrinsic code/gutter heights under one shared scroll area. Final12485 check66/66 includes original24+long geometry24+scroll/header18 across1440/768/390, actual final text and line200 jointly visible. Root inspected before1440 and after1440/390 screenshots. Cost if wrong: reversible one-declaration alignment adjustment; no source/handler/editor/header rewrite. Initial inadequate geometry GREEN is preserved and explicitly unqualified.
