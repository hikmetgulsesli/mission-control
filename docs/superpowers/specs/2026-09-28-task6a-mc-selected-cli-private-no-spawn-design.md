# Task6A private selected-CLI no-spawn design

## Intent and boundary

Mission Control's shared `runCli` utility starts external commands with an
environment copied from the Mission Control process. Its run/stop/resume
routes invoke Setfarm through that utility. PRD `/prd/start-run` bypasses it
and directly spawns `setfarm` with the process environment and an explicit
PostgreSQL URL. Stripping only `SETFARM_PG_URL` would not be a credential
boundary: `DATABASE_URL`, libpq variables, Setfarm `.env` loading and its
default URL are alternative paths. A private negative proof must show that
these selected CLI entry points do not start a child at all.

Use a separate startup-only opt-in flag,
`MC_TASK6A_SELECTED_CLI_NO_SPAWN_V1=1`. The presence of the flag, including
an invalid value, denies shared `runCli` calls before in-flight deduplication,
queue acquisition or `execFile`, with a fixed non-secret error. The PRD
router rejects `POST /prd/start-run` (including case-insensitive and
trailing-slash aliases)
in its first middleware with fixed HTTP 503, before database reads, repo or
temporary-file creation, or direct `spawn`. The flag absent preserves all
ordinary behavior. This proof does not enable a live flag.

## Components and proof

A small startup policy module owns the exact flag name and refusal code so
both paths agree. `server/utils/cli.ts` checks it at `runCli` entry. The
existing PRD router guard checks it for the exact start-run route before
its handler. No child receives a substitute credential; this mode denies
the operation rather than silently falling back to an ambient/default URL.

Focused tests use only a disposable executable marker and an isolated
Express child. A test-only preload blocks reads of repo `.env` and
`.env.local` before either child imports `config.ts`, while harmless explicit
environment values avoid host credential fallback. Under the flag, `runCli` rejects and the marker is absent;
with the flag absent, the marker runs to prove the test is sensitive. The
PRD HTTP test requires exact fixed 503 for `POST /prd/start-run`, including
case and trailing-slash aliases, with no source fixture mutation. Invalid flag values also
refuse. The new tests run without the live PostgreSQL URL and never launch
the selected host `setfarm` executable. The tests remain runnable from a
normal checkout even when it contains supported gitignored env files. The
normal suite and build verify
that the absent-flag route remains unchanged.

## Explicit exclusions

Mission Control also starts terminal, local project and scraper children,
and its product-build authority evidence service invokes subprocesses.
Setfarm's own spawner passes its runtime PostgreSQL URL into agent children
under a longstanding ordinary-mode contract. This V1 selected-CLI proof
does not fence those sites, remove inherited secrets, establish separate
runtime credentials, prove a whole-app child boundary, or authorize live
credential/role/service changes. Those remain independent Task6A gates.
