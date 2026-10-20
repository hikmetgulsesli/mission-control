# Overview configured-schedule truth implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Make Overview and Operations derive the enabled-schedule count from the same configured jobs, preserving Unknown and valid zero.

**Architecture:** Share the small validated server display reader and existing cron cache. Keep toggle reads uncached and unchanged. Set `cronCount` to number or null and render its actual meaning.

**Tech Stack:** TypeScript, Express, React, Node test runner and tsx.

**Spec:** `docs/superpowers/specs/2026-10-20-overview-cron-truth-design.md`.

## Global Constraints

- Only the existing sole MC writer worktree and branch `fix/overview-cron-truth-20261020`, based on reviewed main `546cd3f280914c6b76b52fd4a31c38a5d17f0c71`, may change Source.
- Preserve the fixed live release, evaluator, database, controls, credentials and all new/old evidence. No live commands, restarts, build, provider/PG calls or delivery by implementation/review agents.
- Use the same configured-jobs authority and existing `cron` cache policy for both display paths. Eligible retained-cache behavior and HTTP receipt semantics remain unchanged.
- Valid empty jobs means zero; unavailable/malformed input without an eligible cached value means null/Unknown. Do not manufacture a zero or claim file freshness.
- Preserve the `/api/cron` successful array shape and existing uncached toggle authority, validation, CLI invocation, invalidation and error handling. No real cron mutation.
- Do not change gateway/agent/version contracts, canonical UI fixture policy, Setfarm, runtime guards or provider/test limits.

## File Map

| File | Responsibility |
| --- | --- |
| `server/services/cron-jobs.ts` (new, if needed) | Small shared configured-job display reader/validation using the current cache policy; no mutation |
| `server/routes/cron.ts` | Delegate GET to shared reader; retain uncached toggle authority and public response |
| `server/routes/overview.ts` | Independently settle shared configured-jobs input; nullable count, no dashboard-snapshot count |
| `src/lib/types.ts` | `OverviewData.cronCount: number \| null` |
| `src/pages/Overview.tsx` | Zero/Unknown rendering and `enabled schedules` label |
| `server/routes/overview.test.ts`, `server/routes/cron.test.ts`, `tests/overview-truth.test.tsx` | Real producer/render regressions and existing toggle preservation |
| `server/services/cron-jobs.test.ts` (only if needed) | Meaningful malformed-source/empty-input boundary not duplicated by route tests |

## Preflight consistency and shared interfaces

| Task/interface | Check |
| --- | --- |
| One task, server reader -> both routes | One common display authority/cache; GET still array and Overview number/null |
| One task, Overview response -> type/render | Count semantics and null are propagated together; zero remains visible |
| Display reader -> toggle | Toggle still reads fresh uncached authority; display cache cannot choose an action |
| Task internal tests/files | Tests exercise route/render behavior before implementation; fixtures never hide failures |

### Task 1: Shared configured-schedule truth

**Consumes:** Existing config jobs source, cron cache semantics, dependency-injected toggle tests, real Overview route/render tests.

**Produces:** Common validated display input, nullable `cronCount`, explicit enabled-schedule label; unchanged mutation protocol.

- [ ] Write focused regressions first, including eight jobs/five enabled against conflicting/absent dashboard crons, true empty, unavailable/malformed jobs, and rendered null versus zero.
- [ ] Run the focused tests and retain genuine RED; no production implementation before those failures.
- [ ] Apply the smallest shared-reader/route/type/render change. Keep each purpose small and preserve the existing toggle path.
- [ ] Run the same focused set GREEN and the affected existing toggle/Overview tests. Retain commands, raw outputs, exits and limitations in the plan workspace. No blanket tests/native/browser/PG/provider activity.
- [ ] Freeze the complete diff and hand it to Root for independent task review; no staging or delivery by the builder.
- [ ] Root resolves review findings, runs the required stock build in an admitted nonlive context and delivers via a normal PR.
- [ ] After the active full8 original is settled, Root separately admits any live rollout and verifies both endpoint counts and the actual card. No build, test or PR result alone completes live acceptance.

Ruling: the confirmed live mismatch is a causal refinement of the approved UI audit, not a separate feature. No additional schema field is required merely to express unavailability: a nullable count and clear label suffice. Cost if wrong is reviewable rework, never a live test/guard bypass.
