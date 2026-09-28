# Task6A Mission Control private tasks restricted-startup rehearsal

## Causal boundary

PR #25 proved only live-feed stats on a separate restricted MC login. The
`tasks` route still issues `CREATE TABLE IF NOT EXISTS tasks` on its first
request, even when the table already exists. That denies a DDL-free MC login
before the route can use its scoped task DML. The same GET also starts an
unawaited Setfarm story sync; image endpoints write local files before their
database guard. These are distinct effects and cannot be included in a
simple tasks-table verifier.

## Contract

- Use only the already identified private PostgreSQL 17 cluster, a randomly
  named disposable database and a separate LOGIN with no database/schema
  CREATE, ownership, inherited role, or broad privilege. The role receives
  `SELECT, INSERT, UPDATE, DELETE` only on its precreated `public.tasks`
  table, plus minimal health SELECT. No live service, credential, role,
  selected CLI, port 3080, or existing worktree changes.
- Demonstrate RED through an ephemeral HTTP child: health SELECT succeeds but
  `GET /api/tasks` fails on existing-table DDL. The explicit
  `MC_TASK6A_RESTRICTED_TASKS_VERIFY_V1=1` mode replaces only the lazy DDL
  step with one bounded read-only catalog verification. It checks the
  nonowner login, exact table/columns/defaults/primary index, no RLS or
  descendants, and required scoped task DML while rejecting schema/database
  CREATE and extra table powers. Drift refuses with a fixed error; no repair.
- Bind every tasks-table SQL statement to `public.tasks`, including ordinary
  mode, to prevent role `search_path` shadows. In restricted mode, suppress
  the unverified story-sync side effect on GET and refuse image endpoints
  before filesystem writes. Ordinary mode remains unchanged. This private
  proof covers text-task CRUD only, not image uploads, story sync, other MC
  routes, child credentials, or continuous writer fencing.
- Independent review found two additional effect boundaries. An invalid but
  defined mode value could reach image handling before the lazy verifier;
  `POST /images` with an empty body was RED (400 instead of fixed 503). All
  defined modes now suppress story sync and block image effects before any
  route body handling, while an invalid value still refuses table operations.
  A preexisting SECURITY DEFINER trigger, rewrite rule, or FK cascade could
  expand permitted tasks DML into other tables; a private trigger fixture was
  RED (GET 200 instead of refusal). The verifier now refuses triggers, rules,
  and non-PK/FK constraints, with separate rule and cascade fixtures.
- A child-to-parent inheritance link also passed the first catalog check
  while preserving the exact local column list. A private `INHERIT` fixture
  was RED (GET 200), then GREEN after rejecting both ancestors and
  descendants, including partition-child identity.
- Exact-head GitHub review found that `pg_get_expr` alone did not distinguish
  a generated `status` column from its expected default. The disposable
  generated-column fixture was RED (GET 200), then GREEN after explicit
  `attgenerated`/`attidentity` denial. A standalone unique secondary index
  was also RED (GET 200); the verifier now requires exactly the one expected
  primary index, and an expression-index fixture refuses too. The story-sync
  negative fixture now seeds recognized `done` story states and restarts the
  child after creating an eligible task, so the first GET on the new child
  cannot consume the throttle before the assertion.
- A second exact-head review found two remaining catalog-only false positives:
  a LOGIN whose session defaults to read-only, and an otherwise matching
  UNLOGGED tasks table. Each disposable fixture was RED (`GET` returned 200
  rather than fixed refusal). The verifier now rejects default read-only
  sessions and standby servers before caching readiness, and requires a
  permanent (`relpersistence = 'p'`) tasks table. The private test is GREEN
  for both; this startup check is not a continuous fence against later
  session/server changes.
- Test CRUD under the restricted role, shadow-table binding, descendants,
  privilege/schema drift, ordinary mode, schema fingerprint and child/fixture
  cleanup. Secrets stay in memory and out of logs/Git. The child gets only
  an allowlisted environment and ephemeral loopback port.

## Verification and delivery

Focused private PG17 RED/GREEN, normal suite and build, independent read-only
review, exact-head GitHub review, SHA-bound PR delivery, clean-main build,
merged-main private test from a `.env`-free checkout, and host HTTP checks.
No service restart or live role transition in this slice.

## File Map

- `server/routes/tasks.ts`: opt-in restricted table verifier, qualified task
  SQL, and restricted exclusions for unverified sync/image paths.
- `server/routes/task6a-private-tasks-child.ts`: ephemeral tasks-only router
  harness and health probe.
- `server/routes/task6a-private-tasks-restricted.integration.test.ts`: private
  PG17 role/database fixture and HTTP/DDL/CRUD/drift checks.
- `package.json`: opt-in private test command.
