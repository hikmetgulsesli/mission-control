# Mission Control Changelog

## 2.0.16 - 2026-05-18

- Normalized visible run, story, visual QA, and delete-flow statuses so `N/A` and skipped labels are not shown to operators.
- Sanitized Setfarm and Live feed text for not-applicable and skipped pipeline events.
- Preserved internal state compatibility while rendering unresolved skip evidence as failure or pending operator work.

## 2.0.15 - 2026-05-18

- Normalized not-applicable run-contract statuses to pending in Mission Control.
- Treated skipped story progress as failure evidence instead of completed progress.
- Removed skipped labels from the active run contract and pipeline progress surfaces.

## 2.0.14 - 2026-05-18

- Split Run Contract display into Pipeline Phases and Evidence Checks so step state is no longer visually conflated with checklist evidence.
- Updated contract counters to describe check evidence explicitly instead of generic pass/fail totals.
- Kept active run detail readable while preserving the existing contract data model.

## 2.0.13 - 2026-05-18

- Restored the legacy string response for `/api/live-feed/projects` so already-open Mission Control tabs cannot crash when the project list refreshes.
- Made the Live view explicitly request rich project options with `?format=rich`.
- Kept readable project labels in the new UI while preserving backward compatibility for older bundles and remote deployments.

## 2.0.12 - 2026-05-18

- Hardened the Live project filter so raw run UUIDs are never used as visible option labels.
- Added compact fallback labels for older string-only project API responses and run records that are missing metadata.
- Widened the Live project filter control so run labels remain readable in local and remote builds.

## 2.0.11 - 2026-05-18

- Replaced raw UUID-only Live project filters with short run id, task name, and status labels.
- Kept the project filter API backward-compatible with older string clients while returning richer run metadata.

## 2.0.10 - 2026-05-18

- Classified Setfarm retry/blocker pipeline events as Live errors so unresolved PR review threads appear consistently in all operator views.
- Added explicit Live error detection for PR review comment and unresolved review-thread blockers.

## 2.0.9 - 2026-05-18

- Added Setfarm pipeline events to the legacy live-feed endpoint so every Live view path can see active runs.
- Persisted combined live-feed events through the existing live event writer while preserving dynamic Setfarm event details for current views.
- Tightened Live activity detection so historical rows do not masquerade as active sessions and focus mode reads the newest running step first.

## 2.0.8 - 2026-05-18

- Added Setfarm pipeline events to the Live view so active runs are visible even when tool-session event rows are empty.
- Coalesced repeated Setfarm progress heartbeats in activity feeds instead of flooding the operator view.
- Normalized run-contract items against live step state so future steps remain pending until they actually run.

## 2.0.7 - 2026-05-17

- Expanded the English source contract so source, scripts, server code, and maintained documentation catch English-only violations before build.
- Converted remaining Mission Control UI strings and Visual QA planning notes to English.
- Kept runtime project data outside the source-language guard so persisted user content cannot fail application builds.

## 2.0.6 - 2026-05-17

- Added layered runtime configuration with `.env` plus `.env.local`, preserving real process environment as the highest-priority source.
- Added remote-ready Mission Control host/public-origin/internal-url settings and removed the hard loopback bind from the server listener.
- Moved development proxy, Stitch, projects, changelog, PRD, telemetry, and file-browser paths onto configured runtime roots instead of machine-specific defaults.
- Added `.env.example` and kept prompt/source language and host-path contracts clean for local and remote deployments.

## 2.0.5 - 2026-05-17

- Enriched run detail data with full story metadata, repository file trees, git history, diff files, progress logs, and step-derived agent output.
- Normalized Setfarm run contract evidence so story ownership and checklist fields render readable values instead of raw objects.
- Tightened active run supervisor and date rendering guards, and kept source/prompt text under the English-only contract.

## 2.0.4 - 2026-05-17

- Added an ACTIVE RUN route and top navigation entry so the current Setfarm run has a dedicated detail workspace.
- Changed pipeline run expansion into a compact preview with a detail link instead of dumping PRD, design, contract, and story data inline.
- Added direct Run Contract access on run detail pages and kept new UI/source strings under the English-only source contract.

## 2.0.3 - 2026-05-17

- Added a Setfarm run contract API that reads the system contract ledger and falls back to live DB/artifact evidence when older runs do not have one yet.
- Added a CONTRACT tab in expanded pipeline runs with phase status, checklist evidence, blockers, and story ownership/deferred surfaces.
- Fixed existing client type drift for PRD store auto-load state and changelog markdown rendering.

## 2.0.2 - 2026-05-17

- Added current story, next story, and blocker summaries to Setfarm pipeline cards so failed or gated runs explain their state without opening raw details.
- Fixed pipeline data enrichment to prefer run context and failed-story output over stale step output when choosing the visible blocker.
- Kept Setfarm activity backed by the event log and validated local PostgreSQL configuration for accurate story progress.

## 2.0.1 - 2026-05-16

- Added Supervisor visibility for projects and run detail views, backed by Setfarm's supervisor summary API.
- Added local supervisor ledger fallback with timeout, cache, and circuit breaker behavior.
- Converted PRD generation prompts and seeded PRD templates to English-only instructions.
- Added version and prompt-language contract checks so release metadata cannot drift and model-facing PRD prompts remain English-only.
