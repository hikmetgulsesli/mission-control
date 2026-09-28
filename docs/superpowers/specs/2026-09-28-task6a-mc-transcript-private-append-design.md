# Task6A private transcript append design

## Intent and boundary

PR #29 proves a restricted, append-and-read agent-session feed, but its V2
reader intentionally excludes transcripts. Ordinary Mission Control reads
`transcripts/<workflow>/<agent>-<timestamp>.log` for `item.completed` records
whose `item.type` is `agent_message`; it can return memory rows or ignore a
failed database write. The next bounded proof is that a transcript message is
committed to `public.agent_feed` before HTTP 200, without broadening the
existing V1 historical reader or V2 agent-session reader.

Use a third, mutually exclusive opt-in mode,
`MC_TASK6A_RESTRICTED_AGENT_FEED_TRANSCRIPT_APPEND_V3=1`. It uses the exact
V2 PostgreSQL LOGIN contract: nonowner LOGIN, no broad role/database/object
rights, SELECT+INSERT on the precreated feed and USAGE on its serial sequence.
The per-request transaction proof and atomic deduplication remain the single
database writer primitive. Only GET `/setfarm/agent-feed` is admitted under
V3; DELETE and all other Setfarm routes refuse before side effects. Neither
ordinary mode nor V1/V2 behavior changes when V3 is absent. Simultaneous or
invalid mode flags refuse.

## Source and data flow

A dedicated Python source reader opens the configured absolute transcript
directory component-by-component with directory FDs and `O_NOFOLLOW`; the
macOS `/tmp` alias may be canonicalized before that walk. It accepts at most
100 workflow entries, 100 entries per workflow, 500 `.log` files total,
256,000 bytes per regular file, 8,000,000 source bytes total, and 1,000
accepted messages after taking each file's last 120 lines. The async child
has a 10-second timeout and 64,000,000-byte output bound. Any symlink,
source race, unsafe entry, invalid
UTF-8, overflow, or read error fails the whole request with fixed 502 and no
database write. A missing transcript root is an error; an existing empty
root yields only already-committed DB history.

The parser accepts only `item.completed` JSONL records with an
`agent_message` item and string `text`. It derives `sessionId` from the `.log`
stem and `agentId` from the ordinary parser's timestamp-suffix rule. It
normalizes whitespace, skips the same idle/heartbeat/no-task messages as V2,
and limits text to 500 Unicode code points. Malformed individual JSON lines
are ignored, but I/O or encoding failures never become a fallback. It sends
the resulting bounded entries to `appendRestrictedAgentFeedEntries`, which
rechecks role/catalog shape in the append transaction, deduplicates by hash,
then selects the committed DB rows. No transcript file is modified, pruned,
or removed.

The source reader is a process-wide single-flight bounded async child, as
with V2. An overlapping source scan refuses rather than sharing a stale
snapshot. V3 does not add DELETE permission or a retention policy.

## Proof and exclusions

A disposable PG17 role/database and isolated transcript tree provide RED:
before V3, the flag refuses or no transcript record is persisted; expected is
HTTP 200 with a positive DB id, one exact canonical DB row, and one row after
a repeated GET. Agent-session-only V2 must still omit that transcript; V3
must omit agent JSONL. Negative tests cover missing/symlink/oversized source,
invalid UTF-8, revoked INSERT/sequence USAGE, simultaneous flags, other
routes and DELETE, and unchanged DB/file state on refusal. Tests run only on
an explicitly identified private PG17 cluster; no live DB, service, role,
credential, CLI, filesystem owner or guard changes occur.

This proof does not solve retention, child credential inheritance, continuous
old-writer exclusion, positive physical owner transition or guarded 32/33.
Those remain distinct cutover gates. The live Setfarm dashboard `:3333` is
currently not listening and is not represented as healthy by this proof.
