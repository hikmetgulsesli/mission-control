# Task6A Mission Control private PRD read-only rehearsal

## Causal boundary

After PR #26, Mission Control's PRD service still executes two lazy `CREATE
TABLE IF NOT EXISTS` statements and may seed templates before the two simple
GET endpoints can read. A separate DDL-denied, SELECT-only login therefore
fails even when the required tables already exist. The other PRD endpoints
can mutate PRDs, files, Git repositories, or external services; notably
`GET /prd/history/:id` can auto-update a record. This slice is not whole-MC
role separation or a live cutover.

## Contract and implementation order

1. Use only the identified private PostgreSQL 17 cluster, randomly named
   disposable database and separate nonowner LOGIN. Precreate exact permanent
   `public.prds` and `public.prd_templates`, populate a sentinel PRD and at
   least one template, grant only SELECT, and show RED: health SELECT works
   but both PRD GETs fail at existing-table DDL. No live credential, service,
   role, database, selected CLI, or worktree change.
2. Add an explicit private-only mode. Replace the two lazy DDL statements and
   seeding with a bounded read-only catalog verification of the two exact
   public tables, expected columns/defaults/PK indexes, nonowner LOGIN,
   SELECT-only rights, no broad role/schema/database privileges or hidden
   rewrite/inheritance effects, and nonempty templates. Drift must refuse
   with a fixed error; never repair it. Bind all PRD SQL to `public` so a
   shadow search path cannot redirect later reads.
3. In any nonordinary mode, allow only exact `GET /prd/history` and
   `GET /prd/templates`; reject every other PRD route before handler effects.
   A defined invalid mode also refuses the two GETs. Ordinary behavior
   remains intact. The private child mounts only this router on an ephemeral
   loopback port and receives an allowlisted environment.
   Independent review found that Express's default case-insensitive route
   matching initially bypassed a case-sensitive guard: uppercase detail GET
   returned 200 instead of 503. Compare case-folded paths in the guard and
   prove uppercase detail/POST refusal before handler effects.
4. Test RED/GREEN for the DDL obstruction, shadow relations and unverified
   routes, and negative role/schema/template drift. Verify unchanged table
   rows and public schema fingerprint, child/fixture cleanup, ordinary-mode
   table creation, focused PG17 test, normal suite/build, independent review,
   exact-head GitHub review, PR delivery and clean-main/host evidence.

This is a one-time startup readiness check, not continuous drift or old-writer
exclusion; no full index/app/runtime credential claim follows from it.

## File Map

- `server/services/prd-db.ts`: explicit verify-only schema path and schema-
  qualified PRD SQL.
- `server/routes/prd-generator.ts`: private route allowlist and fixed refusal.
- `server/routes/task6a-private-prd-child.ts`: disposable PRD-only HTTP child.
- `server/routes/task6a-private-prd-restricted.integration.test.ts`: private
  PG17 role/database and HTTP RED/GREEN evidence.
- `package.json`: opt-in private test command.
