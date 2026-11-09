# Overview cost availability implementation plan

Use subagent-driven-development and genuine test-driven-development. Sole Mission Control writer is the existing mission-control-auth-order-test-20261021-v1 worktree, branch fix/overview-cost-availability-20261109, base5a58032a865a6f586cb0f9d72f7a3e6924a00b6e. Preserve all workspaces/private records. Root alone Git/delivery/effects.

## File Map

- server/routes/overview.ts: existing totals projection only; finite observed number or null.
- src/lib/types.ts: OverviewData costToday/costAllTime nullable only.
- src/pages/Overview.tsx: two existing cost-card values; unavailable text, unchanged finite-number formatting.
- server/routes/overview.test.ts: existing real HTTP fixture regression.
- tests/overview-truth.test.tsx: existing real React render fixture regression for unavailable versus measured zero and mixed availability.

## Task 1

1. Add meaningful boundary regressions to the two existing fixtures. Capture original commands/PIDs/output. Missing/null today/all-time must fail on current production; preserve zero/positive and independent-availability controls. No copied selector implementation, source-text-only assertions or new harness/framework.
2. Run tests before production edits and prove genuine RED, not a fixture error.
3. Make the smallest finite-number-or-null projection, nullable interface and card rendering change. Preserve all other behavior and tool access.
4. Run the covering HTTP/render tests and one stock npm run build. Existing MC node_modules/output directories must resolve inside writer before build; do not use source/shared caches, npm install or a Vite preview. Record output type limits/build identity as component-only, not a release.
5. Freeze source/test diff, report and original receipts under this plan workspace; no implementer Git/service/provider/DB actions. Root task/whole-branch review, scoped commit and normal PR delivery, clean merged-release build and guarded MC-only upgrade remain separate.

Do not alter Setfarm/run gates, quotas, model settings, prices or financial accounting. This presentation fix is causally necessary to the user-requested page audit and truthful operator status; actual Source250 canary work remains primary and continues in parallel.
