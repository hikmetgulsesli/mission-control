# Disk capacity presentation

The live Operations page shows `180.6GB / 228.3GB · 91%`. The byte operands imply roughly 79%, while 91% is the authoritative capacity reported by `df`. On this APFS volume those are different quantities. The existing parser and regression deliberately preserve the raw capacity, so changing the percentage would conceal the warning instead of fixing the presentation.

This is a bounded root fix within the owner's approved page audit and interface simplification. Preserve the capacity percentage and warning. Label the disk meter `DISK CAPACITY` with the raw percentage. Show `Used`, `Available` and `Volume total` separately with GiB units; never format used/total as the explanation of capacity. Keep the source, mount/path and observation time available. Retain RAM, CPU and load behavior.

Alternatives considered: recomputing used/total would misrepresent APFS capacity; using used+available as an invented total would confuse volume size with allocatable space. Separate labels preserve all observed quantities without inventing a denominator.

## Binding constraints

- Preserve raw df capacity and the existing warning thresholds.
- Change disk presentation only; no disk parser, API, credential, provider, service, filesystem cleanup or runtime-guard change.
- Disk byte quantities use GiB (1073741824 bytes); unknown values remain Unknown and observed zero remains zero.
- Do not infer capacity from used/total when capacity is unavailable.
- Keep all technical tools accessible and preserve the existing metrics source/mount/observation context.
- Root alone stages, commits, pushes, reviews delivery and merges; workers make no external or live-service effects.

## File map and validation

`src/components/SystemMetrics.tsx` owns the meter and separate byte labels. `tests/system-status-render.test.tsx` exercises the actual React render with APFS disagreement, unknown and observed-zero data. `scripts/ui-regression-fixtures.mjs` contains the exact expected disk label/value pair for the existing zero-metric behavior; only that pair follows the new presentation. `tests/ui-regression-contract.test.ts` supplies its matching mock DOM pair. Both update together without changing selector, strict matching, failure handling or other metric expectations. No new dependency is needed.

Success means the APFS fixture retains a 95% meter while separately showing 40 GiB used, 5 GiB available and 100 GiB volume total, with no misleading slash ratio. Unknown capacity must not become a derived percentage. Run focused rendering and relevant contract checks, TypeScript checks and the required stock Mission Control build. Build is isolated from the live release. An independent task review and final whole-branch review precede delivery. Live activation is a separate guarded operation.
