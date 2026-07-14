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
