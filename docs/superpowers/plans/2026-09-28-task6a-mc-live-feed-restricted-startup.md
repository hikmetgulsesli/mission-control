# Task6A Mission Control private live-feed restricted-startup rehearsal

## Causal boundary

Mission Control currently prefers the shared `SETFARM_PG_URL`; importing the
live-feed route asynchronously issues `CREATE TABLE IF NOT EXISTS` and six
`CREATE INDEX IF NOT EXISTS` statements. A restricted nonowner MC login may
pass a simple `runs` health SELECT while `/api/live-feed/stats` fails at the
DDL. Leaving MC on the former superuser credential also leaves a direct SQL
and inherited Setfarm CLI writer path, so this is a real pre-live-role gap.

## Contract

- Rehearse only in the explicitly identified private PostgreSQL 17 cluster
  under `/tmp/setfarm-task6a-pg.*`, on non-5432 loopback, with a random
  disposable database and separate nonowner LOGIN. No live service, role,
  credential, selected CLI, port 3080, or existing database is changed.
- A child route harness receives an allowlisted environment containing only
  its private URL, listens on an ephemeral loopback port, and compares a
  `runs` health SELECT with `/api/live-feed/stats`. It closes before the exact
  fixture database/role are dropped. Passwords never enter logs or Git.
- First demonstrate RED: the existing live-feed DDL makes stats fail even
  when the exact table/indexes were precreated, while health SELECT works.
  Add a separately opt-in restricted live-feed startup mode that verifies the
  nonprivileged LOGIN and existing table, required columns and indexes through
  one bounded read-only catalog transaction. It skips DDL only when the
  private fixture passes. Session/effective role mismatch, privileged role,
  changed partial-index predicate or catalog drift refuses; no implicit
  repair. Normal Mission Control startup remains unchanged.
- Bind every live-feed SQL statement to the verified `public.live_events`
  relation. A role-scoped `search_path = shadow, public` with a readable
  same-name shadow table produced a second RED: catalog verification passed
  while stats read the shadow row. Schema-qualified route SQL must make that
  fixture read only the verified public table.
- Independent review found that `/live-feed/stats` could still scan rows in
  inherited child tables. A private child-table RED now proves the gap; the
  verifier refuses any descendant of `public.live_events` before declaring
  readiness. Other live-feed endpoints read unverified `runs`/`steps` and
  may enrich from Setfarm helpers, so restricted mode serves stats only and
  returns a fixed refusal for every other live-feed route.
- Exact-head GitHub review found that a role with direct table-write grants
  could pass the first verifier and allow startup cleanup/background inserts.
  Private RED confirms the granted role returned 200. Restricted mode now
  refuses table-level and column-level write privileges, skips the startup
  cleanup and background scanner, and rejects any call to the persistence
  helper. Normal mode retains its writers. Both direct INSERT/DELETE and a
  column-level UPDATE grant are negative fixtures.
- The second exact-head GitHub review found the restricted router gate caught
  unrelated routes mounted after live-feed in the full server. An ephemeral
  route mounted after the feed was RED (503 instead of 200). The gate now
  matches only the `/live-feed` path segment, case-insensitively; later
  unrelated routes pass through, while every unverified feed route refuses.
- This proves only read-only live-feed stats in a private route harness. The
  fixture intentionally denies live-feed writes, and restricted mode does not
  start cleanup or background persistence. Tasks, PRD and agent-feed lazy DDL, scoped
  MC write grants, the shared/inherited credential path, all other MC writes,
  and the continuous DB/OS writer fence remain separate blockers. A bounded
  snapshot is not a held continuous schema fence.

## Verification and delivery

Focused private PG17 RED/GREEN, normal route tests, TypeScript/build in the
isolated branch, independent read-only review, exact-head GitHub review,
SHA-bound PR delivery, clean-main build, merged-main private test and host
HTTP checks. No service restart in this slice.

## File Map

- `server/routes/live-feed.ts`: explicit private restricted catalog-verify
  branch, schema-qualified relation use, descendant refusal, and stats-only
  route gate; normal DDL behavior unchanged.
- `server/routes/task6a-private-live-feed-child.ts`: ephemeral route harness
  with a post-live-feed sentinel proving unrelated route pass-through.
- `server/routes/task6a-private-live-feed-restricted.integration.test.ts`:
  exact private PG17 fixture, role rights, HTTP and schema-drift checks.
- `package.json`: explicit opt-in private test command.
