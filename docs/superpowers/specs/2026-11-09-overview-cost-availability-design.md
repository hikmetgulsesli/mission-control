# Overview cost availability

Live screenshots and read-only API evidence show Overview displaying $0.00/$0 while Usage reports unavailable costs. The actual Overview route replaces absent totals with zero, and its card repeats that fallback. This misstates missing observations as measured zero.

## Design

Preserve observed cost availability through the existing response: costToday/costAllTime are finite numbers or null. Missing, null or nonnumeric totals remain null; genuine finite zero remains zero. Use the existing dashboard-data source; do not add collectors, estimates, pricing, billing, credentials or provider requests. Overview renders unavailable values as `Unavailable` and `Total unavailable`; preserve current numeric formatting, labels and navigation.

Alternative: hide the card would remove a tool the user uses. The chosen change retains the card and corrects its existing truth projection.

## Acceptance and scope

- Actual HTTP route preserves missing/null as null and finite values including zero without coalescing to invented zero.
- Overview API type admits null; real rendered Overview clearly displays unavailable costs while retaining measured-zero and positive formatting.
- Today and all-time availability are independent.
- No cost collection/Usage data, provider/model/credential/auth/runtime/Setfarm/generated-project/service-control behavior changes.
- Regression uses existing actual HTTP and React render fixtures, genuine RED before production, focused GREEN and stock MC build. Root alone delivers reviewed PR/release and separately guarded MC-only upgrade. The running Source250 generation continues unchanged.

Observed evidence: SF writer private ui-pages-readonly/audit-receipt.json SHA b64810d62975effb96d86378ea0b35127070d4d57e5c337f94d7db242b343724; API observations 2026-11-09 02:57:24–25 UTC. Only the hash/path and safe typed facts are recorded here; never commit private evidence.
