# Complete provider project-ID ingress implementation plan

> Root is the sole source/test executor and delivery owner. Preparation is outside the repository; no inspected import/test, provider/HTTP/DB/service operation or additional agent is authorized here.

**Goal:** Reject complete unsupported provider project identities instead of returning a truncated selected-mode prefix.

**Architecture:** The sole private parseProjectId function is shared by both actual creation APIs, ensureStitchProject and createStitchProject. Add an early selected-only branch that captures the existing fixed selector, separates JSON parsing from identity validation, parses complete fallback tokens with the reviewed screen-token boundaries, and uses BOTH existing128 path-ID and Stitch business validators. Keep the original unselected parser text as the exact fallthrough.

**Tech Stack:** Existing TypeScript, node:test and actual Source-body/DATA provider components.

**Spec and cause:** Root's MC35 cloud P2 brief and thread PRRT_kwDOROVmmM6ttJre (4308161236). Base MC5ea1e741ddeee7fc2ff978559b74d3c5b352df76. No operational or Native authority is introduced.

## Census and File Map before candidates

- Modify server/services/stitch-integration.ts only at parseProjectId. Its two callsites are ensureStitchProject (ensure-project provider response) and createStitchProject (create-project response). No other server parser returns a provider-created project ID. Other project_id occurrences belong to DB/Setfarm transfer records, not this provider. Public caller bodies, creation arguments, repo confinement, screen parser, downloads, route persistence and all shared/global validators remain unchanged.
- Create tests/fresh-stitch-provider-project-id.test.ts. Execute the actual top-level parser, both public functions and existing business validator with actual selected path-helper bodies under explicit selected/legacy DATA and provider-return ports. No application module import or real provider/DB/process is used.
- Modify tests/fresh-design-path-component-support.ts at its service() DATA bindings only: add the fixed selected selector port used by the actual parser. No existing test, assertion, fixture callback or provider behavior is removed.
- Create docs/plans/2026-10-18-provider-project-id-ingress.md from this causal plan. Root records final actual verification and delivers through normal review. No server route/schema/access-control change.

## Chosen design and alternatives

Recommended: early selected-only branch in the shared parser. It observes freshMissionControlSelectedV1 before input parsing; valid JSON selects projectId then project_id with the original truthy priority, but keeps the raw value until validation so numeric/object coercion cannot fabricate a selected string identity. A valid JSON response lacking those fields is refused; unrelated project-id text cannot rescue it. Only JSON syntax failure enables fallback. Selected fallback captures a complete double/single quoted value with whitespace/end after the closing quote, or the complete nonwhitespace unquoted token, using the same label-separator policy as the reviewed screen parser. Existing shared validation proves a bounded string, then existing validateStitchId proves downloadable business identity before return.

Rejected: patching only one caller or adding business validation after a prefix has already been truncated. Rejected: replacing the legacy parser globally, which would alter existing unselected JSON coercion/priority and regex behavior. Both public paths continue to reassert the existing shared guard after parsing.

## Test-first sequence owned by Root

- [ ] Apply only the new focused test file and single support DATA-selector binding; run node --import tsx --test tests/fresh-stitch-provider-project-id.test.ts tests/fresh-stitch-provider-screen-id.test.ts tests/fresh-selected-design-cache-writers.test.ts.
- [ ] Preserve genuine old-Source RED from BOTH actual creation functions returning the wrong project identity (or unsupported JSON identity), not a missing new helper. Legacy and selected valid controls remain checks.
- [ ] Independently review/apply the minimal selected parser branch after RED. No automatic retry, caller rewrite, relaxed validator or new provider invocation.
- [ ] Rerun exact focused cases GREEN, existing artifact/config/acceptance suites as proportional, server/frontend types and maintained contracts. Root alone performs these executions.
- [ ] Reconcile final exact source/test/plan bytes, normal exact-head review and delivery. Stock clean-main build and genuine workflow/provider acceptance remain separate.

## Acceptance and preservation

- Both APIs refuse malformed whole tokens, path-safe unsupported business IDs, oversized IDs, missing/nonstring JSON identities, and valid-JSON anti-rescue payloads.
- Quoted whitespace, missing quotes, embedded quotes, quoted tail junk and malformed-JSON prefix cases cannot return a changed identity.
- Valid hex/digit/dash IDs through128 characters retain exact spelling for JSON aliases and fallback; fields retain original priority. Both API result shapes and arguments stay unchanged.
- Fixed selected refusal before parsing and after awaited provider return propagates. Component fixtures supply no installation or operational authority.
- Legacy JSON coercion/priority and the literal old regex are byte-preserved and have direct behavioral controls. Existing screen-ID implementation is untouched.

## Root verification

Actual old-Source V2 RED reached both APIs independently:34 total,26passed,8failed. Earlier V1 RED remains preserved (31total,26passed,5failed). Fixed full focused suite:84passed, no failures/skips/cancellations. Server/frontend no-emit and all maintained contracts passed. Independent whole Source/test composition review:C0. Final stock clean-main build and real workflow/service qualification remain separate; these component results confer no runtime admission or legacy transition completion.
