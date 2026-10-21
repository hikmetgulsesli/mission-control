# Auth order test entry correction

## Problem and scope

The current MC845 delivery-evidence endpoint returns HTTP503 with
`PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_FOCUSED_TESTS_FAILED`.
Root's exact Node26/trusted-environment reproduction closed naturally with
14 passes, one failure and one explicitly branch-scoped skip. The failure is
the middleware-order test reading `server/index.ts`, although the guarded
bootstrap now imports the application from `server/app.ts`.

This is a causally necessary root fix within the owner's continuing instruction
to fix issues and complete Setfarm verification. It introduces no new feature
or permission scope. Root remains the only writer and delivery owner.

## Selected design

Read the existing middleware registration checks from `app.ts`, naming the
local value `appSource`. Preserve every existing presence and relative-order
assertion. Keep the real startup and HTTP fixtures importing `index.ts`, so
the guarded production bootstrap remains covered. Do not add more source-text
checks or change production code, authentication, limits, parsers or gates.

The supported Node22 check also exposed three existing fixture failures:
`mock.module` was given the newer `exports` option instead of the options
accepted by Node22. Use `namedExports` and `defaultExport`, supported by both
actual versions, and isolate the loaded-route subprocess from its parent's
`NODE_TEST_CONTEXT`, as the other two subprocess fixtures already do. Keep
every HTTP assertion and all fixture values intact. This remains confined to
the same test file and is required to verify the declared supported runtime.

The version-specific contracts are documented in the official
[Node22.23.1 test API](https://nodejs.org/download/release/v22.23.1/docs/api/test.html#mockmodulespecifier-options)
and [Node26.4.0 test API](https://nodejs.org/download/release/v26.4.0/docs/api/test.html#mockmodulespecifier-options).
The shared options are deprecated in Node26 but remain supported; this change
retains the repository's Node22 support rather than raising the version floor.

The alternative of moving application code back into the bootstrap changes
working production behavior. Replacing the existing HTTP fixtures would be
unnecessary expansion: both production startup/auth and delivery-rate fixtures
already passed in the actual failed aggregate. The small test correction is
the selected approach.

## Verification and delivery

Retain the original failure. Reproduce the focused baseline in the isolated
writer, apply the test-only correction, then run the exact three focused files
under Node26 and the supported build Node22. Report the branch-scoped skip as a
skip. Obtain independent review, commit/push the scoped branch and deliver by
PR. Build clean merged main into a new immutable release before a separately
qualified MC-only rollout. Recheck the actual delivery endpoint afterward.

The live SF161 installation and all old data remain in place. Final selected
activation preflight, UI317, live-page QA and fresh full8 remain outstanding;
the historical failed full8 and PM scalar UNRUN disposition remain unchanged.

## Actual focused results

Root retained original Node42916 and isolated baseline45738: each naturally
closed1, 14PASS/1FAIL/1SKIP. The initial path correction passed Node26/46049,
while Node22/46164 exposed the three fixture compatibility failures
(12PASS/3FAIL/1SKIP). The final test-only correction naturally closed0 under
Node22/48024 and Node26/48215, each 15PASS/0FAIL/1SKIP with both original pipes
closed and no capture errors. The one unchanged skip is explicitly limited to
the historical reconciliation branch; it is never counted as passed.
