# Canonical quarantine stop authority

## Actual problem and bounded objective

The live Setfarm4595 snapshot permits normal stop with reason
`RUN_CAN_BE_STOPPED_WITH_QUARANTINE_RECOVERY`, but MC70 rejects it before consulting
the projected action. The frontend action evaluator repeats the same rejection. One real POST for run34fb5d86 returned409 with no RTR or
state change. Its84-byte response hash exactly matches MC's serialization of
`OPERATIONAL_INVARIANT_VIOLATION`. This prevents normal retirement needed to
activate the already reviewed/built Setfarm1f46583f fix. It is a causal platform
root fix in the existing objective, not a new recovery feature.

## Design

Keep the shared fresh/complete snapshot validation and its hash/run/time guards.
Only for action `stop`, honor the canonical projected allowed quarantine-recovery
stop when its nonempty invariants consist solely of the two existing Setfarm
stop-recoverable classes: `COMPLETION_REQUEST_QUARANTINED` and
`RUNTIME_SESSION_QUARANTINED`. Check the projected reason and allowed flag as well
as the classes. All other invariant failures remain blocked. The native CLI still
rechecks the snapshot and proves termination ownership and original joint worker
closure. No completion acceptance, repair, replay, raw SQL mutation, role or
credential change is introduced. Resume remains blocked for quarantine and
compiler protocols.

Alternatives considered: retrying the unchanged POST cannot fix the deterministic
precheck; directly invoking a different path leaves the operator UI disagreement
unfixed. Removing invariant validation globally would broaden unrelated actions.
The narrow canonical stop alignment addresses the observed cause.

## File map

- `server/shared/canonical-quarantine-stop.ts`: one pure structural policy helper
  shared by the frontend and backend, following existing server/shared imports.
- `src/lib/operational-snapshot.ts`: use that same narrow allowance for the Stop
  control; preserve all UI freshness/capability checks.
- `tests/operational-snapshot-authority.test.ts`: UI action regression and negative
  controls, not a browser campaign.

- `server/services/run-operational-authority.ts`: action-specific canonical stop
  allowance inside unchanged freshness/completeness validation.
- `server/services/run-operational-authority.test.ts`: genuine failing case and
  focused negative controls for the allowance and existing guards.

## Verification and delivery

Capture RED on the unchanged production evaluator, then GREEN for the authority
file, the UI authority test file, and existing stop argument tests if present. Do not run a package-wide matrix.
Root reviews, commits, pushes a scoped PR, merges normally, and makes one clean
stock MC release build. Source correctness does not attest a live stop. Roll out
MC only through maintained normal service control and keep current Setfarm run,
its historical quarantine and every previous installation intact. A fresh normal
stop after correcting the definite refusal requires a new reviewed single-use
operation, no blind retry of the spent actor.

## Constraints

- Existing sole MC writer only; source base70b8a72d722008fff9a131ef313ed5281d34f2e8.
- Root alone delivers or changes services. Workers do not stage/commit or spawn.
- Hash, freshness, complete projection/capabilities and all unrelated invariant
  checks remain enforced; no success/resume/repair authority is added.
- No generated-project edit, Q row mutation, guard/cap/timer relaxation or secrets.
- Preserve all evidence and npm cache; never delete this workspace.

Existing explicit user continuation and standing-owner authorization cover this
causal reversible fix; repeated design/delivery permission is not required.
