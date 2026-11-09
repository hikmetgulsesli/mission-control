# Native V3 overview provenance

The live Overview displayed zero workflows while selected fresh V3 run `ba6feffd-4578-4801-ac72-4004dbab8709` was active. Its API intersects Setfarm runs with Projects projections, although the Projects ingress deliberately requires a completed canonical transfer receipt. The same page labels MC/OpenClaw quota-token discovery simply `KIMI`, making a missing monitor token look like failure of the separately authenticated subscription worker.

## Design

Count operationally active selected V3 runs from the existing authenticated `getRuns()` source without requiring a Projects entry. Keep the existing operational-status predicate, require a nonempty run ID, and deduplicate IDs. Preserve the existing Project-bound policy for legacy/unspecified-protocol runs. Project visibility, canonical receipt admission, runtime authority, credentials and every mutation API remain unchanged. Label the counter `ACTIVE` workflows because the existing predicate also covers operational closing/resuming states.

Keep the quota monitor and all technical tools. Name the banner `KIMI QUOTA MONITOR`, scope its tooltip to quota-monitor data, and replace only its `NO_TOKEN` display advice with a neutral explanation that missing local quota-monitor credentials do not determine subscription-workflow authentication. Preserve refresh behavior, quota values, error codes, stale indicators and existing credential readers.

Alternatives considered: relabeling the zero count as Project-only would leave active V3 work absent; reading subscription credentials for the monitor would introduce unnecessary sensitive scope. The selected design corrects the existing read projection and labels.

## Acceptance

- A `protocol: 'v3'` operationally active run appears once even when no Project projection exists or Projects reading fails.
- Terminal, unknown-status and missing-ID rows do not become active; duplicate IDs do not inflate counts.
- Legacy/unspecified-protocol rows retain their existing Project-bound status checks.
- Projects ingress and native Work/run-authority readers remain unchanged.
- The banner no longer claims that its missing monitor token means Kimi subscription workers lack authentication.
- No credentials, roles, provider calls, runtime guards, retry budgets, timeouts, services or model-generated projects change.

Validation uses the existing actual-HTTP Overview route test, the existing overview UI truth test, and one stock Mission Control build. Live rollout is a separate Root delivery step after code review; no implementation worker may restart the current services or interrupt the running canary.
