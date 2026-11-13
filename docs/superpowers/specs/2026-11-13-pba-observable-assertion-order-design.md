# Product authority assertion ordering

The current b8bb Setfarm run exposes an actual Mission Control defect: the V3
dashboard authority returns HTTP200, but Mission Control returns502 because its
parser compares the original ProductSpec assertion order against the canonical
DesignGraph assertion order. This prevents the requested page review from
showing valid product authority. This correction belongs to the existing
working-system objective; it does not change generated software or model retry
authority.

Use the producer's nonmutating lexical phase/property ordering on a copy of
ProductSpec assertions before comparison. Preserve the stored graph ordering,
full member values, multiplicity and original hashes. Explicitly reject duplicate
phase/property identities on both lists. An unordered set comparison would lose
multiplicity; changing the producer would contradict its existing schemas and
other consumers. Those alternatives are rejected.

Change only the MC parser and its focused regression fixtures/tests. Return the
original wire unchanged. Keep all envelope, source-map, selector, evidence,
element, role, productObservableHash and assertionsHash checks. No dependencies,
transport/default-schema changes, credentials, source guards or live run edits.

Validate a complete synthetic native Stitch wire with two distinct assertions:
ProductSpec in reverse order, graph in canonical order. Reseal all genuine inner
relationships and enclosing hashes. Prove acceptance and nonmutation. Prove
changed/missing/extra assertions, duplicate phase/property identities (including
on both sides), noncanonical graph order and corrupted inner hashes still fail.
The regression must fail on the current parser for the observed relationship,
not an unrelated stale hash. Use private live wire only as supplemental read-only
diagnosis; never commit production payload or secrets.

After focused RED/GREEN, task and whole-branch review, Root delivers by scoped PR,
builds the clean merged source, and performs the already authorized guarded
MC-only transition. Verify actual V3 HTTP200 and a fresh page capture. Keep
Setfarm/Gateway/current blocked model run and all historical records unchanged.
Full workflow success remains unqualified.

Standing Owner Authorization v1 and the user's explicit continuous-fix request
cover this reversible root fix; repeated design/commit/delivery permission menus
are not needed. Preserve the task workspace and all new records.
