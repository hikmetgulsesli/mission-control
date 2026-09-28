# Task6A Mission Control project-start no-spawn private proof

## Context and decision

Task6A cannot claim old-writer exclusion while Mission Control can launch a
generated local project with its full ambient environment. `startLocalProject`
passes `process.env` to `npm` or Python; the project toggle/start-all routes can
reach that operation after port, registry, log and PID side effects. The prior
selected-CLI fence does not cover it. Live writer exclusion and credential
separation remain separate work.

Add a separate, startup-sampled opt-in flag
`MC_TASK6A_PROJECT_START_NO_SPAWN_V1`. Presence of any value must refuse
`POST /projects/:id/toggle` when action is `start`, and
`POST /projects/start-all`, with fixed HTTP 503/code
`MC_TASK6A_PROJECT_START_NO_SPAWN`. Refuse at route entry before loading the
project registry, enriching from DB, allocating/killing ports or spawning a
child. Express case/trailing-slash aliases must behave alike. A stop action
remains available; no flag means ordinary behavior. This conservative private
mode also refuses service starts through those endpoints; it makes no claim
about other MC child paths or Setfarm's own agent child.

## Proof and safety

An isolated HTTP fixture starts only the projects router with an explicit
harmless environment and the existing test-only env-file-read-denial preload.
A disposable runnable project and fake `npm` marker demonstrate that ordinary
start reaches child execution (RED), then private mode returns fixed 503 with
no marker, registry, runner log/PID or project runtime artifact (GREEN). Both
entry routes, invalid flag value, aliases, stop behavior and normal mode are
covered. The normal-mode proof stops only its identity-checked disposable
child process group; it never calls the production port-killing stop path.
The fixture may create and remove only its own exact temporary root.
No live flag, service, DB role/credential, selected CLI or generated project is
changed. This negative proof is not the full Task6A writer fence.
