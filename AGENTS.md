# Mission Control Agent Guide

## Role

Mission Control is the operator UI and API for observing Setfarm, projects,
agents, costs, PRD tools, files, live feed, and run state. It should present
derived truth from Setfarm and local runtime state; it should not invent success
from stale cards or agent prose.

## Source Map

- `server/config.ts` - env/path resolution.
- `server/index.ts` - Express app, health, route mounting, WS setup.
- `server/routes/projects.ts` - project registry, synthesized Setfarm projects,
  local project start/stop, status enrichment, port allocation.
- `server/routes/runs.ts` - run APIs, retry/stop/resume, progress, classified
  run errors.
- `server/utils/setfarm-db.ts` - direct Setfarm Postgres reads and recovery
  helpers.
- `server/utils/setfarm.ts` - Setfarm daemon/API helpers.
- `server/utils/cli.ts` - bounded CLI execution and PATH handling.
- `server/ws-proxy.ts` - optional OpenClaw gateway websocket bridge.
- `src/pages/Projects.tsx` and `src/components/projects/*` - project grid,
  filters, runtime controls, details.
- `src/components/pipeline/*` and `src/pages/RunDetail.tsx` - run detail UI.

## Operating Rules

Keep Mission Control usable on `http://127.0.0.1:3080`. Do not require the
OpenClaw gateway for local development; gateway-dependent features should degrade
instead of making `/api/health` fail.

Project visibility must be explicit. Failed, error, and cancelled projects must
remain discoverable unless a user-selected filter hides them. Do not silently
drop failed Setfarm projects from `/api/projects`.

When changing project/run state, prefer Setfarm's operational model and Postgres
events over UI re-derivation. If Mission Control disagrees with Setfarm, inspect
the Setfarm DB and events before changing the UI.

## Verification

Choose the cheapest valid check:

```bash
npm run build
curl -fsS http://127.0.0.1:3080/api/health
curl -fsS http://127.0.0.1:3080/api/projects
```

Run `npm run build` for TypeScript, route, server config, React, CSS, or API
changes. Markdown-only edits do not require a build.

After service-impacting changes on the Mac mini, restart the LaunchAgent only
after build/smoke succeeds:

```bash
launchctl kickstart -k gui/$(id -u)/com.setrox.mission-control
```

## Git And PR Comments

Use PR branches for root fixes. Read Gemini/Copilot comments with `gh` when
available, but do not make broad rewrites to satisfy vague comments. Actionable
comments need file/line evidence, a focused fix, and a verification command.

Do not commit `.env`, local logs, generated cache, screenshots, or runtime data.

<!-- standing-owner-authorization-v1:start -->
## Standing Owner Authorization v1

An explicit user instruction to fix, complete, continue, proceed, or resume a
bounded objective authorizes the active primary owner to perform the ordinary,
reversible work required to achieve that objective without repeatedly asking
for the same permission. This includes read-only investigation, isolated
worktrees and scoped branches, in-scope source/test/docs/config changes,
proportional verification, staging and conventional commits, pushing the scoped
branch, reviewed pull-request delivery, clean-main synchronization, and
code-owned fail-closed rollout or health verification required by the goal.

A systemic root fix discovered from current evidence remains in scope when it is
causally necessary for the same objective. Before delivery, record that relation
in the task plan, update the File Map and tests, and keep the change to the
smallest root fix. This is scope refinement, not authority for an unrelated
feature. Implementation and review agents remain non-delivery roles unless the
user explicitly appoints one as the primary owner.

Standing authority never permits a direct commit to `main`, force-push or
history rewrite, destructive data or filesystem mutation, credential/secret or
access-control changes, safety/test/runtime-guard bypasses, unrelated scope,
material paid third-party activity, or external signing, notarization,
distribution, or public release. Stop at that exact boundary and request only
the missing authority. All clean-worktree, single-writer, branch-protection,
test, review, zero-owner, secret, runtime, and evidence requirements remain in
force.

When the user says `resume`, `continue`, or an equivalent phrase, begin a fresh
blocked-condition audit and continue safe in-scope work. A stale stored
`blocked` status is historical evidence, not an irrevocable lock. Mark the goal
blocked again only under the current repeated-blocker rule, and mark it complete
only after every required outcome is proven.

When this protocol is sufficient, state once that it is being used and proceed.
Do not ask the user to reconfirm each commit, push, PR update, merge, clean-main
rollout, or causally required in-goal root fix. This protocol cannot override
higher-priority system instructions, tool restrictions, or explicit user
revocation.
<!-- standing-owner-authorization-v1:end -->
