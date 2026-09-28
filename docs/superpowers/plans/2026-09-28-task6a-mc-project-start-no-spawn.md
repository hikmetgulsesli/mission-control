# Task6A MC project-start private no-spawn plan

## Goal and causal relation

Prevent the Mission Control local project start routes from delegating ambient
PostgreSQL authority to child processes during an explicitly selected private
Task6A rehearsal. This is necessary for the continuous old-writer exclusion
gate, but not sufficient: terminal/scraper/evidence and Setfarm agent children,
DB/OS role separation, owner proof and guarded 32/33 remain open.

## Steps

1. Preserve existing dirty/worktree state; create one clean branch/worktree from
   MC main. Record this design and plan before source edits.
2. Add an isolated executable-marker HTTP test. Confirm RED: flagged start
   reaches ordinary behavior/child or otherwise misses fixed refusal. Use
   explicit dummy environment and deny `.env`/`.env.local` reads in the child.
3. Add a startup-sampled flag guard at both route entries. No normal-mode
   behavior change. Confirm GREEN, including aliases, invalid flag value and
   pre-effect absence.
4. Run focused and normal tests, build on a clean committed worktree, obtain
   independent exact-head review and GitHub review. Address actionable findings
   with new tests and commits, then merge PR normally.
5. Fast-forward only existing clean MC main; run clean-main tests/build and
   HTTP health. Record remaining live blockers without enabling the flag.

## File Map

- `server/routes/projects.ts`: project-start guards at the two HTTP entries.
- `server/routes/task6a-project-start-no-spawn-child.ts`: disposable HTTP fixture.
- `server/routes/task6a-project-start-no-spawn.integration.test.ts`: executable
  marker and refusal integration tests.
- `tests/fixtures/task6a-no-env-preload.mjs`: reused test-only env-file guard;
  no edit expected.
- This design/plan and root Task6A evidence log: scope, review and delivery.
