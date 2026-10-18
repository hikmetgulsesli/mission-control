# Fresh runtime PR35 review corrections

The fresh-runtime source commit1370fa42 is under review, not deployed. Two
findings are causally required to make that same selected installation usable.
No database schema, credential value, old project or runtime guard is changed.

## File map and behavior

- server/config.ts: preserve the existing parser and process > .env.local > .env
  precedence. Selected mode must load non-runtime authentication, network and
  provider settings. Filter captured runtime/path/database aliases and protected
  execution/mode keys before assigning environment DATA. Env files cannot
  select another installation or reconfigure its private paths after admission.
  The unselected loader keeps its previous parsing/precedence behavior.
- server/services/fresh-prd-workflow-run.ts: only when the existing private busy
  error proves no child launched, remove this request's own task and exclusively
  created repository after exact pre-launch graph/identity/hash verification.
  Preserve unknown/accepted outcomes and changed or foreign artifacts. Use
  checked leaf unlink and empty-only rmdir, with no broad recursive deletion or
  adoption. This is ordinary same-UID request cleanup, not an atomic-unlink or
  Native custody claim. Existing real entry, acknowledgement, row and CAS checks
  remain required.
- tests/fresh-selected-config-and-busy-cleanup.test.ts: actual parsed source-body
  DATA components for configuration and an actual owned temporary filesystem
  component for busy cleanup, mutations and unknown acceptance. No simulated
  operational authority qualifies a real runtime.

Cleanup preparation has finite ordinary request bounds:4096 entries,64MiB
aggregate,8MiB per regular file and depth32. They bound the new request-owned
snapshot and its checked deletion; overflow refuses before launch. These are
new application bounds, not historical Native experiment limits or evidence
of whole-machine resource health. Never expand them silently to pass a test.

Run tests against1370fa42 first and preserve RED, then apply the minimum source
correction and require focused GREEN, existing18-case acceptance/preimport
regressions, server/frontend TypeScript and source contracts. Independently
review exact source/test changes, commit/push the scoped correction and request
new-head cloud review. Only resolve each finding after actual fix evidence.
Stock clean-main builds and new actual selected installation/HTTP/workflow
qualification still follow reviewed delivery.

## Verified correction evidence

On the original1370fa42 source, the seven-case regression suite returned six
failures and one pass. The real busy composer retained its newly created
repository, proving the reported orphan independently of missing helper names.
After the reviewed production correction, all seven cases passed. Both existing
suites also passed all18 cases, including unknown/accepted-run preservation.
Server TypeScript and all version, prompt, path and12-artifact contracts passed.
Original RED/GREEN captures are private workspace evidence. Independent exact
production/test review reported no critical, important or minor findings.
Clean-main stock build and actual selected runtime checks remain delivery gates.
