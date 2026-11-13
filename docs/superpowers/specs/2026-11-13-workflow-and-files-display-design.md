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
