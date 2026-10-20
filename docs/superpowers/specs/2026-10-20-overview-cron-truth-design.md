# Overview configured-schedule truth

The approved page audit found a concrete inconsistency after MC546 went live:
`/api/overview` reports `cronCount: 0` and its card says `0 active`, while
`/api/cron` returns eight jobs, five enabled. Root retained the actual read at
`logs/2026-10-20-reviewed-source-release-v1/i5-live-overview-cron-and-ui-read-v1.json`
in the canonical workspace (SHA256
`910e299a9eb5e94ea3769b2d01daf585216479bd5772cf89b0fb53d761c4b0b4`).
The static investigation in that directory explains the two different sources.
This fix is necessary for the already approved truthful operator interface.

Overview must count enabled jobs from the same configured-jobs authority as the
Operations cron collection. Both read paths must use the same validated display
reader and existing `cron` cache policy. A valid empty collection produces zero;
unavailable or malformed data without an eligible cached value produces null,
rendered as `Unknown`. The card must say `enabled schedules`, because this is
not a count of executions currently running. Preserve HTTP receipt semantics;
this does not make a cached source into a fresh file observation.

Keep the existing `/api/cron` array response on successful reads. Preserve the
uncached guarded toggle authority, validation, CLI selection, cache invalidation
and error handling. No schedule may be enabled, disabled, removed or rewritten
by tests or implementation. Changes to gateway health/RPC, literal `v` navigation,
agents, credentials, provider policy or Setfarm are outside this fix.

Alternatives considered: counting the old dashboard snapshot retains the proven
wrong authority; fetching a second cron collection in React leaves the API
inconsistent and duplicates polling. Share the server display reader instead.
Do not introduce a general data-source framework or replace global cache rules.

Verification must exercise the real route/render behavior: conflicting or absent
dashboard cron snapshots versus eight configured jobs/five enabled; valid empty
jobs versus unavailable/malformed input; explicit zero versus Unknown. Existing
toggle tests must still prove uncached authority and unchanged failure behavior.
Focused tests and a stock build are required before delivery. Root owns any
commit/PR/build/release and eventual live verification; no live rollout or
restart may interrupt the currently owned full8 evaluator.

Ruling: the user's approved full UI work and standing bounded continuation
already authorize this small causal truth fix. No new feature or access is
introduced; an incorrect choice costs reviewable code/test rework. User records,
current live services and the active evaluator remain protected.
