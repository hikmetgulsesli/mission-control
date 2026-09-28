# Task6A Private Transcript Append Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This repository's root-only-writer instruction selects inline execution; other agents may only review read-only.

**Goal:** Prove that a completed transcript agent message is committed to the restricted Mission Control feed before HTTP 200 without changing the V1/V2 or ordinary paths.

**Architecture:** A V3-only route mode runs a dedicated descriptor-pinned, bounded transcript snapshot reader, parses only completed agent messages, and reuses the PR #29 transactional append/read primitive. Its PostgreSQL role and allowlist are exactly V2's. No live mode is enabled by this plan.

**Tech Stack:** Node 26, TypeScript, Express, Python 3 via `/usr/bin/python3 -I`, PostgreSQL 17, `node:test`.

**Spec:** `docs/superpowers/specs/2026-09-28-task6a-mc-transcript-private-append-design.md`.

## Global Constraints

- Root is the only writer. All existing dirty files and worktrees remain intact; no reset, revert, cleanup or direct `main` commit.
- V1 historical feed, V2 agent-session append and ordinary feed behavior are unchanged when V3 is absent. V3 and other restricted flags are mutually exclusive.
- V3 PostgreSQL role needs only SELECT+INSERT on exact `public.agent_feed` and USAGE on `public.agent_feed_id_seq`. No live role, credential, OS, service, selected CLI or admission changes.
- Snapshot: at most 100 workflow entries, 100 entries per workflow, 500 `.log` files, 256,000 bytes/file, 8,000,000 total source bytes, last 120 lines/file, 1,000 accepted messages, 10-second Python timeout and 64,000,000-byte output bound.
- Read all source before DB transaction. Any source/DB failure returns fixed 502, without fallback, pruning or partial writes. Missing root fails; existing empty root returns committed DB history.

## File Map

- Create `server/services/task6a-transcript-reader.py`: bounded no-follow transcript tree snapshot.
- Create `server/services/task6a-transcript-reader.test.ts`: real Python snapshot and source rejection tests.
- Modify `server/services/agent-feed.ts`: V3 transcript parser and reuse of bounded async single-flight reader and DB append primitive.
- Modify `server/routes/setfarm-activity.ts`: mutually exclusive V3 opt-in and route refusal.
- Create `server/routes/task6a-private-transcript-feed-restricted.integration.test.ts`: disposable role/DB/FS HTTP RED/GREEN proof.
- Modify `server/routes/task6a-private-agent-feed-child.ts`: private test-only flag propagation if needed; never selected by live launcher.
- Modify `package.json`: isolated PG test command and copy the new Python helper into `dist-server` build identity.

## Task 1: Descriptor-pinned transcript snapshot

**Interfaces:** `task6a-transcript-reader.py ABSOLUTE_TRANSCRIPTS_DIR` prints compact UTF-8 JSON array of `{workflowId, sessionId, raw}` or exits nonzero; it never writes source files.

- [ ] **Step 1: Write failing real-reader test.** In `server/services/task6a-transcript-reader.test.ts`, create `/tmp/mc-task6a-transcript-*` with `transcripts/wf-1/agent-2026-09-28T00-00-00.log` containing one literal `item.completed` JSON line. Run `/usr/bin/python3 -I <helper> <realpath root>` using `spawnSync` with the production timeout/output/env limits. Assert exact `workflowId`, `sessionId` and `raw` output; the missing helper must fail.
- [ ] **Step 2: Run RED.** `node --import tsx --test server/services/task6a-transcript-reader.test.ts`; expected nonzero because the helper does not exist.
- [ ] **Step 3: Implement the reader.** Reuse the existing session reader's `open_absolute_directory`, `bounded_names`, `O_NOFOLLOW` directory/file opening, regular-file `fstat`, strict UTF-8 decoding and compact `json.dumps(...,ensure_ascii=False,separators=(',',':'))`. Enforce the exact global limits above. Derive `sessionId` from `.log` filename only; include every eligible regular file within limits and reject symlink/changed entries rather than following them.
- [ ] **Step 4: Run GREEN and negative cases.** Add symlink directory/file, oversize, invalid UTF-8 and missing-root fixtures, each expecting nonzero and unchanged source bytes. Run the same focused command to 0 failures.
- [ ] **Step 5: Commit.** `git add server/services/task6a-transcript-reader.py server/services/task6a-transcript-reader.test.ts && git commit -m "feat(task6a): snapshot private transcript sources"`.

## Task 2: HTTP append contract

**Interfaces:** `getRestrictedTranscriptFeed(limit: number): Promise<any[]>` consumes the snapshot `{workflowId, sessionId, raw}` and returns `appendRestrictedAgentFeedEntries(entries,limit)`; V3 flag is `MC_TASK6A_RESTRICTED_AGENT_FEED_TRANSCRIPT_APPEND_V3=1`.

- [ ] **Step 1: Write failing private PG17 integration test.** Use a newly named disposable database/role and `transcripts/wf-1/agent-2026-09-28T00-00-00.log` in an isolated root. Create preverified `public.agent_feed` and sequence; grant only CONNECT to target DB, schema USAGE, table SELECT+INSERT and sequence USAGE. Set only V3 flag on the child. GET `/api/setfarm/agent-feed?limit=10` must return the exact transcript message with `id > 0`, exactly one equal DB row and repeat dedupe. The ordinary/V2 code currently cannot satisfy the DB-row assertion.
- [ ] **Step 2: Run RED on exact private cluster.** Export `SETFARM_TEST_PG_ADMIN_URL` and `SETFARM_TASK6A_TEST_PG_DATA_DIRECTORY` only in the local test shell after checking its data directory, port and PG17 version. Run `env -u SETFARM_PG_URL npm run test:task6a-mc-transcript-pg:isolated`; require the expected HTTP/DB assertion failure, not a live DB connection or a skipped test.
- [ ] **Step 3: Implement minimal V3 route and service.** Parse only JSONL `item.completed` with `item.type === 'agent_message'` and string `item.text`, derive `agentId` using `/^(.+?)-\d{4}-\d{2}-\d{2}T/`, normalize whitespace and 500 code points, skip idle/no-task text, cap accepted entries at 1,000, then reuse `appendRestrictedAgentFeedEntries`. Run the new Python helper through the existing async single-flight 10-second/64 MB reader. Add a mutually exclusive V3 flag and exact GET route guard; any V3 source or DB error maps to fixed 502, other Setfarm routes/DELETE to 503.
- [ ] **Step 4: Run GREEN and refusal tests.** Add missing/symlink/oversize/invalid-UTF8 source, revoked INSERT/sequence USAGE, simultaneous flags, other-route/DELETE, V2 omitting transcript, V3 omitting agent-session JSONL, empty-root DB-history, and unchanged DB/source on refusal. Run the focused PG17 command to 0 failures.
- [ ] **Step 5: Commit.** `git add server/services/agent-feed.ts server/routes/setfarm-activity.ts server/routes/task6a-private-transcript-feed-restricted.integration.test.ts server/routes/task6a-private-agent-feed-child.ts package.json && git commit -m "feat(task6a): prove private transcript feed append"`.

## Task 3: Verification and delivery

- [ ] **Step 1: Verify.** Run `npm test`, `npm run build`, `git diff --check`, the focused private PG17 test, and verify build identity `sourceSha` equals `git rev-parse HEAD` after the final commit.
- [ ] **Step 2: Review.** Dispatch an independent read-only review. Fix Medium+ findings with RED/GREEN evidence. Push only this branch, open a PR to `main`, request `@codex review`, check latest exact-head comments and GitGuardian.
- [ ] **Step 3: Deliver safely.** Merge only the reviewed exact head; fast-forward an existing clean `mission-control/main`, run clean-main build and suite, then run merged-main focused PG17 test in a new `.env`-free detached worktree. Keep all worktrees visible. Record HTTP `:3080`, `:18789`, `:3333` and unclosed live gates in the root evidence log.

## Self-review

The spec's separate V3 mode, exact source limits, atomic DB write/read, refusal cases, unchanged V1/V2/ordinary behavior and no-live-cutover boundary each map to a task above. V3's parser is not a retention or credential-fence implementation. `TRANSCRIPTS_DIR` comes from `server/config.ts`, and the existing PG17 private proof is the only database target.

## Review-directed root refinement

The transcript snapshot is a prerequisite to the same V3 append proof. Read-only review identified a source race: a previously read `.log` can change while a later file is scanned, without changing its parent directory metadata. The File Map's Python reader and focused test therefore also cover a deterministic two-file late-mutation RED case and a final no-follow revalidation of every observed workflow/file before the helper emits JSON. This is a fail-closed source correction within Task 1, not a live runtime or authority expansion. An adversarial writer can still mutate after the last filesystem check; no global atomic snapshot is claimed.
