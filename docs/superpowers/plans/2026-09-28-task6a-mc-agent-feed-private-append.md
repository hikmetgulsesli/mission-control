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
2. RED: in the already identified private PG17 cluster, a disposable role/DB
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
  snapshot test for the child-process output capacity contract.
- `server/routes/setfarm-activity.ts`: V2 opt-in and fail-closed private route.
- `server/routes/task6a-private-agent-feed-restricted.integration.test.ts`:
  add independent disposable V2 role/DB/JSONL RED/GREEN fixture.
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
This is a private parser proof, not a claim that old live writers are fenced
by the OS; that remains a separate cutover gate.
