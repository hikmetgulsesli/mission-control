# Disk capacity display implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Make the disk capacity and byte quantities understandable without changing the authoritative APFS warning.

**Architecture:** Keep the observed df data unchanged. Render capacity as its own percentage and render used, available and total as separate GiB labels inside the existing SystemMetrics component.

**Tech Stack:** Existing React/TypeScript, Node test runner, tsx and React server rendering; no dependencies added.

**Spec:** `docs/superpowers/specs/2026-10-26-disk-capacity-display-design.md`

## Global Constraints

- Preserve raw df capacity and the existing warning thresholds.
- Change disk presentation only; no disk parser, API, credential, provider, service, filesystem cleanup or runtime-guard change.
- Disk byte quantities use GiB (1073741824 bytes); unknown values remain Unknown and observed zero remains zero.
- Do not infer capacity from used/total when capacity is unavailable.
- Keep all technical tools accessible and preserve the existing metrics source/mount/observation context.
- Root alone stages, commits, pushes, reviews delivery and merges; workers make no external or live-service effects.

### Task 1: Separate capacity from byte quantities

**Files:** Modify `src/components/SystemMetrics.tsx` and `tests/system-status-render.test.tsx`; adjust only the related expectation in `tests/ui-regression-contract.test.ts` if required. The spec/plan document the causal live finding and file map.

**Interfaces:** Consume the unchanged `SystemMetrics` disk fields `percent`, `used`, `total`, `freeBytes`, `source`, `mount`, `path`, `observedAt`; preserve the exported `SystemMetricsPanel({metrics})` signature. Produce display copy only, no API/type change.

- [ ] Step 1: Extend the actual React rendering regression before implementation. Use the existing APFS fixture and assert the capacity label and 95% width remain while all three quantities have independent labels and GiB units. Assert a slash ratio such as `40GiB / 100GiB` is absent. Set `percent=null` while bytes remain known and assert capacity is Unknown, without a fabricated 40% width. Cover all observed zero quantities and existing all-unknown fixture.

```tsx
const html = renderToStaticMarkup(<SystemMetricsPanel metrics={metrics}/>);
assert.match(html, /DISK CAPACITY/);
assert.match(html, /width:95%/);
assert.match(html, /Used.*40\s*GiB/);
assert.match(html, /Available.*5\s*GiB/);
assert.match(html, /Volume total.*100\s*GiB/);
assert.doesNotMatch(html, /40\s*GiB\s*\/\s*100\s*GiB/);
```

- [ ] Step 2: Run `node --import tsx --test tests/system-status-render.test.tsx` and retain the causal failing output in this plan's ignored workspace. No network, browser or services are needed.
- [ ] Step 3: Make the smallest component change that separates capacity from the three byte labels. Use existing bar styling and raw `metrics.disk.percent`; format available as `Math.round(freeBytes / 1073741824 * 10) / 10` only when non-null. Keep each unknown value explicit. Do not introduce a ratio-derived fallback for disk capacity or alter RAM/CPU/load semantics.
- [ ] Step 4: Rerun the focused render tests and `node --import tsx --test --test-name-pattern='zero|metric|unknown|APFS' tests/ui-regression-contract.test.ts`. Inspect whether the existing explicit zero-disk text expectation needs its smallest corresponding update. Run `npx tsc --noEmit` for the browser project if supported by its current tsconfig. Report exact commands/results and do not launch a runtime or full suite.
- [ ] Step 5: Self-review the full diff, retain RED/GREEN stdout/stderr/exits and write `task-1-report.md` inside this plan's ignored workspace. Root obtains independent task review and whole-branch review, performs the required stock build and owns all commits/PR delivery. Workers do not stage or commit.
