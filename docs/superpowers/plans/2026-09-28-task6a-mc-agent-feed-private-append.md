# Task6A Mission Control private agent-session append/read rehearsal

## Causal boundary

PR #28 proves DB-only historical GET with a SELECT-only role. The ordinary
agent-feed GET still performs lazy DDL, reads local JSONL/transcripts, ignores
failed INSERT, may prune, and can return synthetic memory/events rows with
HTTP 200. An active feed under a separate restricted MC login needs a distinct
private append proof; changing the V1 reader's role contract would invalidate
its existing evidence.

## Contract and order

1. Create a second opt-in private mode in a new isolated branch. Its role has
   only SELECT+INSERT on exact precreated `public.agent_feed` and USAGE on the
   owned SERIAL sequence; deny UPDATE/DELETE/TRUNCATE/DDL, ownership and broad
   role powers. V1 remains SELECT-only and ordinary behavior remains intact.
2. RED: in an explicitly identified private PG17 cluster, a disposable role/DB
   and isolated agent JSONL hold one valid assistant message. Current mode
   refuses the new append flag (or ordinary path returns a synthetic row after
   DDL fails); expected response must be a persisted row with positive DB id,
   exactly one matching canonical DB record, and deduplication on repeat.
3. In V2, run bounded read-only catalog verification, then parse only private
   agent session JSONL, strictly INSERT to `public.agent_feed` with the
   existing canonical hash/normalization, and SELECT qualified DB rows.
   Catch only malformed JSON, never DB/write/file errors. Disable cache,
   memory/events fallback, transcript scan and random prune for this narrow
   agent-session slice. Refuse unrelated activity routes and DELETE before
   effects. A later slice must cover transcripts and retention separately.
4. Negative tests revoke INSERT or sequence USAGE and expect fixed refusal,
   no synthetic row and unchanged private DB/FS; verify schema/role drift,
   V1 unchanged, ordinary behavior unchanged, and fixture cleanup. Then
   focused PG17, normal suite/build, independent review, exact-head GitHub
   review, PR, clean-main merged test/build and host HTTP evidence.

No live service, role, credential, selected CLI, filesystem owner, or writer
cutover is authorized by this private proof. Child credential separation and
continuous old-writer exclusion remain separate gates.

## File Map

- `server/utils/setfarm-db.ts`: mode-aware private verifier and strict
  schema-qualified append primitive.
- `server/services/agent-feed.ts`: private agent-session parser/append/read
  with no silent fallback.
- `server/services/task6a-agent-session-reader.py`: descriptor-pinned,
  no-follow, bounded private source snapshot; no live launcher selects it.
- `server/services/task6a-agent-session-reader.test.ts`: near-bound Unicode
  snapshot test for the child-process output capacity contract and event-loop
  liveness while the private reader child runs.
- `server/routes/setfarm-activity.ts`: V2 opt-in and fail-closed private route.
- `server/routes/task6a-private-agent-feed-restricted.integration.test.ts`:
  add independent disposable V2 role/DB/JSONL RED/GREEN fixture, including
  effective cross-database CONNECT and replication-role negative cases.
- `package.json`: copy the private source reader into the build identity.

The existing isolated V1 test command runs both V1 and V2 fixtures. Independent
review found that `lstat` followed by `readFileSync(path)` could reopen a
changed symlink or oversized file, and a second review found the same race on
intermediate directories. The V2 reader now traverses from `/` using no-follow
directory descriptors and opens session files relative to pinned parent FDs;
each file is bounded to 256001 bytes and the entire snapshot to 8 MB. Only
macOS's root-owned `/tmp` alias is canonicalized before traversal in the
private fixture. Symlink root/session/file and schema/mode drift are tested.
The third review found JSON Unicode escaping could expand a valid 8 MB
snapshot past the child output buffer. A 40-file 8 MB Unicode fixture first
failed with `ENOBUFS`, then passed with compact UTF-8 JSON; the service also
allows 64 MB for the worst-case escaped control-character expansion.
The first exact-head Codex PR review found nondeterministic limited results
when a batch shares one PostgreSQL `NOW()` timestamp. A private V2 fixture
with two newly ingested messages and `limit=1` was RED (returned the earlier
message), then GREEN with `ORDER BY created_at DESC, id DESC` in the V2
transactional reader only.
The second exact-head Codex review found that V2 cached a successful verifier,
so later broad grants or schema drift could pass while INSERT itself still
succeeded. A same-child UPDATE-grant test was RED (HTTP 200) then GREEN (fixed
502); V2 rechecks the restricted shape before every append request while V1
retains its original cached historical-read proof.
The third exact-head Codex review identified quote doubling in parameterized
INSERT, invalid UTF-8 replacement, and unverified access to unrelated DB
objects. The V2-only normalizer now strips controls without SQL quote escaping;
the private parser decodes UTF-8 strictly; the V2 verifier checks effective
rights on other user relations, schemas and routines plus database TEMP and
sequence SELECT. Disposable tests grant another table, schema, sequence and
TEMP right after readiness and require fixed 502; apostrophes round-trip
exactly, and malformed UTF-8 leaves the DB count unchanged.
Independent review found a handoff collision: ordinary mode stores a doubled
apostrophe and hashes that transformed text, whereas V2 preserves it. A
disposable legacy row/source fixture was RED (a second row inserted with HTTP
200); V2 now checks the exact legacy hash and stored fields before INSERT and
refuses the request transactionally with fixed 502 if the collision exists.
No historical row is rewritten or silently duplicated; an explicit later
history-migration decision is required before enabling V2 on such data.
The fourth exact-head Codex review identified omitted PostgreSQL large-object
rights and the verifier/source-scan/write gap. A large-object grant returned
HTTP 200 in the pre-fix private fixture; the fixture now requires that grant
and a user-defined type both return fixed 502. The
V2 proof now rejects effective non-feed rights on large objects (PG17 ACL
catalog), user types, foreign servers/wrappers, tablespaces and parameter
ACLs, and rejects `lo_compat_privileges=on`. Source scanning completes before
the DB transaction; the append transaction then takes an explicit ROW
EXCLUSIVE lock, rechecks the catalog/role on that same transaction, inserts,
reads and commits. This blocks conflicting table DDL during the proof/write,
but it is not a global GRANT/old-writer fence: that still needs external owner
coordination at cutover.
The fifth exact-head Codex review found two remaining role powers: effective
CONNECT to another database and `rolreplication`. Both returned HTTP 200 in
private RED fixtures after the test role was broadened, then fixed 502 after
the V2-only proof rejected them. The cross-database test runs on a fresh,
dedicated PG17 cluster with `PUBLIC CONNECT` removed from its `postgres` and
`template1` databases; the shared older private cluster retains its original
ACLs. The fixture asserts no pre-existing outside CONNECT, grants CONNECT on
an additional disposable database, observes 502, revokes it, then observes
200. This is a causal refinement of the same restricted V2 role contract,
not a live permission change or a continuous old-writer fence.
The sixth exact-head Codex review found two parser-path defects within the
same private append slice. A 499-ASCII-plus-emoji boundary fixture returned
502 before code-point truncation, then persisted the exact 500-code-point
message after the V2 service and DB bound normalizer were changed. The
ordinary feed path is unchanged. A deliberately slow disposable Python reader
showed the synchronous runner completed before the Node timer (RED); the V2
runner now awaits bounded asynchronous `execFile`, and the timer fires before
its result (GREEN). Independent review then identified unbounded concurrent
reader children; a second overlapping slow-reader call succeeded in RED, then
was refused with `SOURCE_BUSY` after a per-process single-flight guard, while
a post-completion call succeeds. The route maps that refusal to fixed 502 and
never shares a stale snapshot. The same private PG17 route fixture remains
green.
This is a private parser proof, not a claim that old live writers are fenced
by the OS; that remains a separate cutover gate.
