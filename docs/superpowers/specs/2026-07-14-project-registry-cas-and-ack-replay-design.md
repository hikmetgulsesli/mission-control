# Project Registry CAS, ACK Replay, and Observed Health

## Scope

Mission Control must preserve every concurrent `projects.json` mutation, publish
one immutable Setfarm project-transfer acknowledgement per canonical v3
projection, and distinguish deployment-receipt status from current observed
runtime health. Legacy project behavior remains available outside the canonical
v3 boundary.

## Project registry persistence

Every `projects.json` read used for a later write is bound to the SHA-256 hash
of the exact source bytes and to an immutable baseline copy. A write compares
that revision with the current file. When the revision changed, the repository
performs a record-level three-way merge by exact project ID:

- concurrent additions and changes to other records are preserved;
- identical changes are idempotent;
- a removal applies only when the current record still equals its baseline;
- two different changes to the same record fail with a revision conflict.

The merged result is written with the existing durable temporary-file, file
`fsync`, atomic rename, and directory `fsync` sequence. All whole-file writer
paths must use this repository boundary; direct `projects.json` writes are not
allowed. A canonical v3 transfer reads its persisted record back from the
committed revision before constructing an acknowledgement.

## Project-transfer acknowledgement replay

The first transfer builds an acknowledgement from the settled pre-ACK Setfarm
snapshot, persists the canonical Mission Control projection, publishes the ACK,
and verifies it by refetching the canonical Setfarm snapshot.

On later periodic syncs, if the fetched snapshot already contains a transfer
ACK whose run, candidate, packet, source, deployment receipt, projection hash,
project-record hash, and project identity match the persisted Mission Control
record, Mission Control reuses that acknowledgement as confirmed authority. It
does not derive a new ACK from the post-ACK snapshot hash and does not issue a
second callback. Any mismatch fails closed.

## Runtime visibility

Canonical receipt fields remain immutable evidence of what Setfarm deployed.
Read-time enrichment adds `observedServiceStatus` and
`observedServiceCheckedAt`; it never overwrites receipt `serviceStatus`.
Projects UI presents receipt status and current live health separately. Missing
or invalid observations display `UNKNOWN`, never inferred success.

## Verification

Tests cover stale-reader merging with a concurrently added canonical record,
same-record conflict rejection, durable readback identity, zero callback calls
on replay of an already-bound ACK, ACK mismatch rejection, and live-health
projection/UI behavior. The full Mission Control test suite and production
build must pass.
