# Idle V3 transfer state write suppression

## Causal scope

Setfarm clean-main cutover qualification holds a physical absence proof across an asynchronous host sample. On the Mac mini, Mission Control polls V3 project transfers every 30 seconds and currently rewrites `mc-v3-project-transfer-scheduler-state.json` even when both database pages are empty and both cursors are `null`. The atomic rename changes the observed parent directory timestamps, so Setfarm correctly refuses the held absence proof. The Setfarm guard must remain unchanged.

## Decision

In `runIncrementalV3ProjectTransfers`, skip `stateStore.save` only when the loaded pending and ACK-audit cursors are both `null` and both freshly queried pages are empty. Continue both database queries on every tick. In every other case, preserve the current save-before-effects ordering, including an exhausted non-null cursor that wraps to `null`, an ACK audit page with no reconciliation work, and a selected pending run.

This is a no-op only for an empty, already-reset cursor state: there is no cursor advancement, selected effect, or durable recovery position to commit. A run appearing after the queries is selected on the next tick. `updatedAt` is not used as a liveness heartbeat outside this state store.

Moving the scheduler state file would require a broader path migration. Ignoring that sibling in Setfarm's absence observer would weaken its intentional same-inode/ABA protection. Neither is in scope.

## Verification and rollout

Test the exact idle no-write case, continued querying and later work discovery, non-null cursor reset, ACK-audit persistence, and save-before-effect failure behavior. Run Mission Control tests and build on a reviewed branch. After PR delivery, use a clean-main build and only then restart the Mission Control LaunchAgent; verify HTTP health and that the scheduler state parent does not drift during an empty window. A successful Setfarm host cutover observation must be proven separately; this change alone cannot assert it.

## File map

- `server/services/v3-project-transfer-scheduler.ts`: exact idle decision at the persistence boundary; no File store or Setfarm guard change.
- `server/services/v3-project-transfer-scheduler.test.ts`: scheduler behavior and persistence ordering regression tests.
