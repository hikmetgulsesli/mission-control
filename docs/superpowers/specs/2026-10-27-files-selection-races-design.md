# Files selection response ownership

Implements the existing approved operator-workspace design (2026-10-19), the user's request to fix broken functions and continue, and the actual remaining source finding from the 2026-10-25 route audit. This is an ordinary frontend correctness fix. The user-cancelled extra runtime/isolation phase remains cancelled and unpassed.

## Problem and outcome

`usePolling` currently accepts every settled request after a key change or unmount; `Files` likewise accepts a previous file read after another file or directory is selected. Old content can therefore appear under a new selection, and subsequent editing can target a different path. Only the current request for the current selection may update its data, error, loading and edit state. An A → B → A sequence must distinguish the two A requests.

## Design

Retain the existing hook interface and file tools. Use lightweight lifecycle/request generation refs for polling and file selection. A new key, interval lifecycle, request, selection, navigation or unmount invalidates the corresponding old owner. Only that owner's latest request may commit success, failure or completion state. Clear obsolete content and error when changing selection; retain ordinary same-key polling data during refresh/failure as currently supported. Use actual accepted read content to initialize editing rather than delayed callbacks capturing stale state.

All Files continuations which can replace or clear the viewer (select, save readback, rename readback, delete and new-file follow-up) obey the same selection ownership. An operation already submitted can finish against its captured path, but its late response must not steal or clear a newer selection or edit draft. Do not add automatic retries or writes. Preserve unsaved-change confirmation, refresh, context menu editing, create/upload/rename/delete/download and edit/save/cancel/undo.

## Scope and alternatives

A page-only path comparison cannot distinguish A → B → A and leaves directory polling broken. A new request library or network cancellation stack adds unnecessary dependencies. Request generations in the existing hook/page provide the bounded fix without a backend/API change. No visual redesign or unrelated UI issue is included.

## Validation

Execute actual source hooks/component callbacks with deterministic deferred API promises and synthetic timers/React lifecycle, following existing listener-free tests. Verify late success, failure and finally, key changes, same-key overlap, unmount, rapid selections/navigation, save/rename/delete/new-file continuations and edit intent. No real file/API/provider/service/browser operation is part of these tests. Run focused tests, TypeScript noEmit and the source build. These checks do not qualify a deployed build or full8/annual runtime activation. Independent task and branch review precede delivery.

## Constraints

Root alone stages, commits, pushes and delivers. One implementation worker in the existing linked Mission Control writer. English product copy and existing runtime/test guards remain. Preserve records, prior evidence and all technical destinations. No new dependencies, live API mutations, credentials, service changes, extra isolation work or unrelated Setfarm edits.
