# Definitive PRD prelaunch error preservation implementation plan

Status: Root applied the independently reviewed implementation after genuine original-source RED. Root remains the sole writer and delivery owner; outside preparation performed no execution or runtime effects.

**Goal:** Preserve actionable errors when this exact start endpoint definitely refused before launch, while retaining unknown acceptance after ambiguous failures.

**Architecture:** Add one narrow response classification branch inside the existing browser fetchPrdWorkflowStart error path. Match only the actual prelaunch status plus exact one-error JSON schema; leave the structured selected acceptance parser and all success paths unchanged. A new focused test file runs the real browser function and exact route/auth bodies with DATA transport/recording ports.

**Tech Stack:** Existing TypeScript, node:test and TypeScript Source-body components.

**Spec and approved scope:** Root's bounded MC35 P2 brief; current MC base 695c304bc2ebb81d5b804295810737d8cbfc2879. This is ordinary source/error reporting, not workflow acceptance authority.

## File Map before candidates

1. Modify only src/lib/api.ts, fetchPrdWorkflowStart: after the existing complete structured selected error validation and before the generic unconfirmed-response throw, recognize one-key error objects for exactly400/prdId required,404/PRD not found or empty,401/Unauthorized. Throw the existing PrdWorkflowStartError with original message, acceptance not-started, runId null and repoPath null.
2. Create tests/prd-workflow-prelaunch-errors.test.ts: extract exactly one top-level production browser function and actual error class; feed exact legacy router and auth refusal bodies plus explicit ambiguous/malformed/success variants. No application module import or real transport/SQL/process operation.
3. Root may record final validation in its existing causal delivery plan. No server route/auth edits or new response schema are required.

## Source-grounded causality and alternatives

The legacy POST /prd/start-run callback emits400 {error:prdId required} before getPrd, and404 {error:PRD not found or empty} after only that read and before directory/child operations. authMiddleware emits401 {error:Unauthorized} without next(); app.use('/api', productBuildAuthorityV2GeneralAuth) is before prd router registration. The selected route's explicit seven-key error envelope remains the primary known-acceptance contract, including accepted run IDs after later failures.

Recommended: exact inline status/body pairs, one source file. Rejected: treating all4xx as not-started, since late server errors can follow launch; rejected: redesigning all legacy responses into the selected schema, which changes unrelated server behavior. Exact matching is deliberate; new server refusal forms remain unknown until separately justified.

## Test-first sequence owned by Root

- [ ] Apply the NEW test-only patch. Run node --import tsx --test tests/prd-workflow-prelaunch-errors.test.ts tests/fresh-workflow-run-acceptance.test.ts.
- [ ] Preserve genuine original-source RED. The three exact prelaunch cases must fail because actual fetchPrdWorkflowStart rewrites acceptance to unknown, not because a new helper is missing. Existing ambiguity and known selected acceptance cases should remain valid controls.
- [ ] Independently review and apply only the proposed src/lib/api.ts branch. No status-only whitelist, automatic retry or new server claim is allowed.
- [ ] Run the same selected tests GREEN, frontend/server no-emit checks and existing proportional contracts; retain actual terminals/captures. No project test is run during preparation.
- [ ] Reconcile final source/test bytes and deliver normally. Clean-main build/runtime and real workflow qualification remain separate.

## Behavioral acceptance criteria

- Exact three prelaunch pairs preserve their original error message and not-started/null/null fields, with one HTTP attempt.
- Structured selected not-started, unknown and accepted envelopes retain their existing messages, runId and repoPath. Valid selected and legacy success responses remain unchanged.
- Wrong status, wrong message, extra identity keys, malformed shapes, network/JSON loss, generic4xx/5xx, and invalid2xx remain unknown with no retry.
- Tests derive real prelaunch bodies from the actual exact router/auth code using inert data ports, not an alternate classifier. Other fixtures are literal expected data.
- No assertion claims operational entry, SQL acceptance, a provider, real HTTP or overall startup readiness.

## Actual Root validation

The three actual legacy/auth refusal responses failed on the original browser function: 15 cases,12 passed/3 failed. Capture5647B SHA256 `cc7668620a7de88a9acebeadbade4ec2015887b514236f7a14cd05c0bfe08df4`. Applying only the reviewed eight-line branch produced15/15 GREEN, capture1777B SHA256 `6bbf6982fb113926bcec0bf7498fde846d755c3785b0eecf9e569bc576472337`.

The combined final WebSocket/prelaunch/acceptance/config/design/preimport batch passed66/66, capture7243B SHA256 `4eeb320041ba1e15c4e67d4b5927e033e08061e440420bd8e1ac93ed28ed352c`. Server/frontend no-emit TypeScript and all four maintained contracts passed, capture571B SHA256 `344df16ac786e7c1740f9e58526f812a8bc4ea336892947137367663847779ab`. Independent Oracle Source/test/plan review was C0/I0/M0. Clean-main build and actual selected service/workflow qualification remain pending.
