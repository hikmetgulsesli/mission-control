# Controls owned progress consistency design

Status: Root-adopted causal UI bugfix,2026-10-21; implementation/qualification pending.

The real selected full8 job d756f305-338b-4613-a055-36773303628c reached ownership_unknown/CONTROL_CUSTODY_UNCERTAIN, revision14,1of8,cancelRequested=true. Selected owned progress showed that receipt, but Recent jobs still showed starting/0of8 and Request cancellation remained enabled. The launch request had already been accepted, while the pending notice described an unaccepted launch. Screenshot/DOM retained under logs/2026-10-21-controls-current-evidence-v1/live-mc4a-current404-recovery-v1/17-full8-ownership-unknown.* (not repository assets).

Source confirms recent jobs updates only on global refresh while selected receipt polls every3seconds. Cancel handler/view check only terminal/busy. Broker list/get share one projection, so no server lifecycle change is needed. Pending request retention in UNKNOWN is intentional: it preserves the exact key and is explicitly tested.

## Decisions

Render the selected job's Recent jobs row from the same validated current selected receipt used by owned progress whenever that receipt is at least as recent as the list row. Match the exact job ID and immutable receipt context. A delayed older global list must not regress the selected row. Preserve other jobs/order and existing selected-scope/epoch race protection. No extra polling or network calls are needed.

Cancel is unavailable while busy, already requested, terminal or ownership_unknown. Apply the same predicate in rendering and handler before generating a key or calling API. Keep existing enabled behavior for known live noncancelled jobs. An UNKNOWN receipt remains UNKNOWN and is not declared terminal, cancelled, closed or passing.

If pending is bound to an accepted job, explain that the job was accepted and its final outcome is unconfirmed; same-key retry reconnects to it. Keep the original pending notice for a request whose response is unresolved. Preserve both pending storage values byte-for-byte during receipt polling, global refresh and rendering. Prepare a new check must retain its existing meaning and backend admission restrictions; no owner recovery or storage clearing is added.

## File Map and verification

- src/pages/Controls.tsx: selected-row projection, accepted/unresolved pending copy and cancel predicate/handler. Keep backend/session ownership behavior unchanged.
- tests/controls-selected-evidence-browser.test.ts: real React browser regression using existing owned fixture/HTTP controls, old starting list then selected UNKNOWN receipt, delayed older list, storage preservation and zero cancel POSTs.
- tests/controls-render.test.tsx only if required for a narrowly extracted render predicate's unit boundary; browser behavior is the primary regression.

No fixture native/process ownership helper, launcher, provider, production broker, auth, lifecycle or pending-storage schema change is required. Root executes the owned fixture under existing admission/capture rules. First record actual failing behavior, then make the smallest Source fix and rerun. Focused existing coordinator/session/render/browser regressions and clean committed stock build precede review/delivery. No live rollout is performed while the selected Setfarm evaluator reservation remains unresolved.
