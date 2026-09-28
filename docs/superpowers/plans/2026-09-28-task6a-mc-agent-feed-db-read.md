# Task6A Mission Control private agent-feed DB read rehearsal

## Causal boundary

PRs #25–27 prove three isolated Mission Control surfaces under separate
restricted roles. `GET /setfarm/agent-feed` still runs lazy table/index DDL,
then scans agent/transcript files, may INSERT/prune, and falls back to memory
or events after a database failure. The route's cache can also serve stale
data when refresh fails. A DDL-denied login can therefore return HTTP 200
with file-derived content instead of the authoritative DB feed. This slice
proves only historical DB reading, not live ingestion or whole-MC cutover.

## Contract and order

1. Use only the identified private PostgreSQL 17 cluster. Create a random
   disposable database, precreated `public.agent_feed` table/indexes and DB
   sentinel; grant a separate nonowner LOGIN SELECT only. Make isolated agent
   JSONL content deliberately disagree. Mount the production route in a
   private loopback child with allowlisted DB and runtime paths. RED: current
   route returns file memory after DDL fails, not the DB sentinel.
2. Add explicit private-only mode and bounded read-only catalog verifier for
   exact permanent public table, columns/defaults/three indexes, no hidden
   effects or inheritance, separate nonowner nonwriting role. In this mode,
   GET bypasses file scan, ingestion, prune, fallback and cache, performs only
   a schema-qualified DB SELECT after verifier, and refuses failure with a
   fixed 502. DELETE and all other activity routes must refuse before effects;
   invalid defined mode refuses. Ordinary route behavior remains unchanged.
3. Test DB sentinel only, unchanged DB and private FS fingerprints, shadow
   search_path binding, missing/altered schema/index, role drift, unavailable
   DB refusal without memory fallback, other-route/DELETE refusal, ordinary
   fallback behavior, and fixture cleanup. Then focused PG17, normal suite,
   build, independent review, exact-head GitHub review, PR delivery,
   clean-main merged test/build and host HTTP evidence.
   The private fixture also revokes SELECT after successful verification and
   demands fixed 502 on the same child, proving that a later DB read failure
   cannot reuse cached or file-derived content.

Independent review found a normal-mode search-path regression when the first
implementation globally schema-qualified `getAgentFeed()` but left ordinary
DDL/insert/prune/delete unqualified. A disposable `shadow,public` ordinary
fixture was RED: it wrote the shadow table but returned the public sentinel.
Keep the original ordinary reader intact and add a distinct public-qualified
reader used only after the private verifier; assert shadow consistency GREEN.

This startup proof does not authorize live role, credential, selected CLI,
service, OS writer, or admission transition. Actual ingestion/retention and
continuous writer exclusion remain separate gates.

## File Map

- `server/utils/setfarm-db.ts`: private verifier and qualified agent-feed SQL.
- `server/routes/setfarm-activity.ts`: private route allowlist and direct DB
  read path outside cache/fallback.
- `server/routes/task6a-private-agent-feed-child.ts`: disposable route harness.
- `server/routes/task6a-private-agent-feed-restricted.integration.test.ts`:
  isolated DB/role/FS HTTP RED/GREEN and refusal fixtures.
- `package.json`: opt-in private test command.
