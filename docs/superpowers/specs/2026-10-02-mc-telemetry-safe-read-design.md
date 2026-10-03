# Telemetry safe-read design

## Goal and causal scope

The qualifying Setfarm ALL observed unsupported `step_transitions` reads.
Mission Control also interpolates opaque run identifiers into executable
JavaScript and hides failed history/bottleneck discovery behind empty arrays.
This seven-file root fix replaces that consumer with an honest, bounded,
steps-only read. It is required by the same internal-production completion
objective, not a new analytics feature or Setfarm schema change.

Root is the sole writer and delivery owner. Read-only agents review independently.
All retained worktrees, builds, journals and historical dirty-file contents stay
visible and unchanged. No live selector, service, port, auth, pool, migration,
package or lock changes. Ordinary P1 does not authorize native/protected cutover.

## File map

1. `server/routes/telemetry.ts`: shared query/path handler, ID validation, exactly
   two supported parameterized SELECTs, normalized versioned responses.
2. `src/lib/api.ts`: exported telemetry types/validation, opaque query transport,
   streamed bounded decoding and closed failure reasons; other API unchanged.
3. `src/components/run-detail/TelemetryChart.tsx`: real exported pure
   `TelemetryResult`, limited-history notice, unavailable state and finite totals;
   preserve `TelemetryChart({runId})`, chart appearance and cancellation wrapper.
4. `server/routes/telemetry.test.ts`: owned actual-source HTTP/client harness,
   SQL capture, transport/wire/mutation/read-boundary tests and explicitly
   selected real read-only SQL witness.
5. `tests/telemetry-render.test.ts`: actual React SSR consumer tests using the
   same exported test-only harness, not extracted implementation.
6. This design.
7. `docs/superpowers/plans/2026-10-02-mc-telemetry-safe-read.md`.

No helper file, global DB utility, schema, source outside these seven, config,
dependency, index entry or generated runtime artifact is part of this change.
The shared route test module registers its tests only when it is the directly
selected process.argv[1] entry, verified against its canonical import.meta.url.
Importing it from render tests exports the helper but registers no route tests
and never selects the real SQL witness. Witness this import-only behaviour in
a separate owned child; one explicit real-SQL test owns that opt-in exactly once.

## Selected approach

Keep the existing human-step historical execution-duration heuristic; don't
copy Setfarm's unrelated queue/reliability/thrashing/saturation algorithms.
Server-only normalization would leave client/empty-state false-health gaps.
Adding transition-history tables or importing Setfarm's built output expands
authority and does not solve opaque-ID executable interpolation. Selected:
steps-only route + strict client result + explicit limited-history UI.

## Opaque identifier and transport

An ID is a nonempty string of at most256 UTF-8 bytes, without NUL or unpaired
UTF-16 surrogates. Never trim, normalize, coerce or decode twice. Query transport
is `/api/telemetry?runId=${encodeURIComponent(runId)}`. Raw query must contain
exactly one literal `runId=` key, no other/duplicate/bracket key or trailing
separator. Decode its value once with decodeURIComponent: `+` is literal plus,
`%20` space, `%2B` plus. Malformed percent encoding fails before SQL.

Keep `/api/telemetry/:runId` as compatibility path, sharing the same handler and
ID policy; reject competing query parameters. Malformed path escapes that fail
Express parameter decoding produce the same400 before SQL. Preserve existing
case-insensitive/trailing-slash/GET/implicit HEAD compatibility behaviour;
missing IDs use controlled400, not implicit healthy responses. Do not change
global Express query parsing/router/index settings.
Query IDs including `.`, `..`, slash, question/hash, quotes, percent, plus and
Unicode remain data after standard URL construction and actual HTTP transport.

## Wire contract

All server responses use `schema: "mission-control.pipeline-telemetry.v1"`.

200 exact keys: schema,status,runId,history,analysis,steps,transitions,bottlenecks.
`status: "available_limited"`; exact validated runId;
`history: {state:"unavailable",reasonCode:"PRECISE_TRANSITION_HISTORY_UNAVAILABLE"}`;
`analysis: {coverage:["historical_execution_duration"]}`; transitions always[].
Steps exact keys: step_id,agent_id,status,started_at,updated_at,duration_ms,
isBottleneck. Text fields have their actual string/null types; unknown status
strings stay unchanged. Duplicate human step IDs are allowed, ordered as SQL
returns them; bottleneck association is by human step group, not row identity.
duration_ms is null or a finite nonnegative integer (including0); numbers only
for done/failed. Flags exact keys: type,stepId,message,value,threshold with
type execution_bottleneck and finite raw value > threshold >0.

400 exact keys schema,status,runId,code,reason:
unavailable/null/TELEMETRY_RUN_ID_INVALID/invalid_run_id. No SQL or subprocess.
503 same keys: unavailable/exact valid ID/TELEMETRY_READ_FAILED/sql.
Never expose raw SQL errors or successful arrays on refusal.

Client result is that validated200 or normalized
`{status:"unavailable",runId:string|null,reason:TelemetryUnavailableReason}`.
Closed reasons: invalid_run_id,sql,http,network,invalid_json,invalid_response,
run_id_mismatch. Exact own keys and nested shapes, no coercion/default arrays.
Validate400/503 wire shapes/status correlation as rigorously as200.

## Client decoding and precedence

Maximum decoded response body1048576 bytes inclusive, independent of
Content-Length. Count chunks before concatenate/fatal UTF-8 decode/JSON.parse.
Do not use post-allocation response.text as a size guard. Overflow cancels the
owned reader; await cancellation/settlement/release, preserving primary result
if cleanup throws. Early unknown HTTP status returns http before body parsing.
Accepted Content-Type is application/json, case-insensitive, with optional
single charset=utf-8 (unquoted or double-quoted); surrounding/parameter ASCII
spaces or tabs allowed. No other parameter, duplicate charset, comma-list,
vendor +json, non-UTF8 charset or missing header. Test all these refusal cases.

Precedence: invalid local ID -> fetch network error -> unknownHTTP http ->
expected status bad content type/UTF8/size invalid_response -> read network ->
JSON syntax invalid_json -> exact shape/status invalid_response -> otherwise
valid200/503 wrong run echo run_id_mismatch -> accept result.400 must carry null
runId; a200 refusal or400 success cannot masquerade. Preserve no-store and the
existing token header. All unrelated fetchApi methods remain unchanged.

## SQL and time

Exactly two SELECTs through the existing SQL tag, with validated runId bound
as a parameter in each. No unsupported history query, child process, Setfarm
dist import, config read, mutating SQL or global parser/pool change.
Query1 reads steps for runId ordered by step_index. Query2 groups all terminal
positive samples across runs (including current), restricted to this run's
human step groups. No row/string/memory cap is added to server queries here.

Duration eligible only when both timestamps are nonnull/finite, status done or
failed and updated_at > started_at. Use UTC date difference cast to numeric
before multiplying by86400000, plus the difference of numeric EXTRACT(EPOCH)
from each UTC time-of-day multiplied by1000. Do not subtract timestamps:
finite extremes can overflow an interval. Nor subtract whole timestamp epochs:
PostgreSQL17.10's overflow branch can lose microseconds near its maximum even
before the final float8 cast. UTC date differences fit int32 across these
timestamp bounds; time extraction preserves six fractional digits. Cast final
duration/AVG to float8, reject nonfinite or invalid numeric rows, compare raw
duration strictly >2*AVG before display rounding. AVG ignores ineligible rows.
Positive submillisecond durations round to display0 and can still be flagged.

Select timestamps as nullable TEXT: finite guarded UTC
`to_char(value AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z" AD')`.
No JavaScript Date or driver date parser loss. Client manually validates four
to six-digit positive year, no year0000, canonical zero-padding, valid Gregorian
day/leap-year (BC astronomical year1-year), clock fields and exactly6 microsecond
digits, AD/BC. Bounds4714-11-24T00:00:00.000000Z BC through
294276-12-31T23:59:59.999999Z AD. Nonfinite database timestamps map to null.
Ordered total-duration addition must stay finite; overflow is unavailable
invalid_response, never Infinity/healthy display.

## Test ownership and safety

Outer focused Node26 test imports pinned TypeScript5.9.3 and transpiles exact
raw source snapshots in memory with original filename, ES2022/ESNext/Bundler,
ReactJSX/esModuleInterop, reportDiagnostics; no custom transformer, emitted
source, import rewrite or handler extraction. Compiler initialization has
ordinary filesystem operations; it is outside the controlled child.

Fresh inline-JS child has no tsx/TypeScript/esbuild/preload. One synchronous
registerHooks maps exact original sourceURLs and explicit parentURL/specifier
edges for actual route/API/chart/operational-snapshot/product-build-authority.
Actual Express/React/Recharts/ReactDOM dependencies remain real. Enumerate and
pin approved dependency leaves and internal symlinks before execution; no broad
repo/node_modules path allowance. Unknown source edge/SQL/config/driver port
latches HARNESS_FAULT before throwing, independently of route catches.
Membership is initial post-ci physical admission, not permission to execute
every installed file. Approve only Express/React/Recharts/ReactDOM SSR package
closure and literal imports/requires extracted from the pinned actual files;
unknown/dynamic edge refuses. Deny .node/native-addon format/process.dlopen,
worker_threads and all child subprocesses (except the nominated route sentinel),
plus TypeScript/tsx/esbuild/Vite/rolldown/Playwright/postgres driver origins.
No .bin symlink execution. Enumerate permitted builtins for the reviewed real
closure (including legitimate util/crypto/async_hooks/stream); final source/
dependency observations must match the initial admitted manifest, never refresh
expected bytes during a consumer. These boundaries precede real imports.
Config/pg mock-miss selfwitness must refuse before secret read/driver factory.
Guard known sensitive sync/async/open/read APIs before delegation, including
fs.promises aliases; restore guards and syncBuiltinESMExports after settlement.
This is known boundary admission, not global native-loader/all-realm containment.

Nominated baseline execFileSync port records the actual consumer call and denies
it without launching; it is not a generic harness fault that can satisfy RED.
Legacy SQL nomination uses exact independently captured template values/shapes;
unknown SQL is sticky fault. Actual route mounts at/api on one owned server at
port0. API real fetch bridges relative URL only to that exact owned origin;
document meta stub precedes API evaluation. SSR uses real exported pure result.
Drain response bodies and owned sockets/server; deregister hooks; child owns
actual exit and close0/null and both EOFs with complete bounded output. Preserve
primary and cleanup failures. Baseline export/JSX/CJS/edge/evaluation-once parity
and safety selfwitnesses precede semantic RED. Mutants alter raw source narrowly
and follow the identical ordinary transpilation/loader/consumer path.

## Mandatory separate real SQL witness

Mocked arithmetic does not qualify SQL. Before delivery, explicitly select one
credential-free, exact-whitelist read-only witness to primary127.0.0.1:5432,
database setfarm/user setrox. No HOME/PG URL/config/pgpass/service discovery,
password'', no authentication changes/fallback/retry. postgres3.4.8 max1,
preparefalse/fetch_typesfalse/sslfalse/connect5/idle0/max_lifetimenull/
max_pipeline1/backofffalse/keep_alive0/debugfalse/noticefault. Own socket close
promise before connect, connect5sec, reject second factory. Endtimeout alone
does not prove closure.
The factory is postgres options.socket, not merely one postgres() invocation.
Allocate one owned raw socket, register its close promise before connect, pin
that socket, and sticky-deny every later socket-factory request BEFORE any
allocation/connect. backofffalse is zero delay, not disabled reconnect. Always
settle the original socket; any later request invalidates the witness.

With fetch_typesfalse, postgres3.4.8's initial reserve path clears its initial
reserve marker and returns before opening the queue; incidental drain may
rescue it, but the normal startup path can strand the reservation. First execute
the sole whitelisted `SELECT 1::integer AS connection_admitted` under startup
default_transaction_read_only=on; require exactly one row/value1, no implicit
type/catalog queries. This starts the ordinary query path on the same sole
owned socket before reserving its already-open backend. It is setup admission,
not identity/arithmetic proof; no second connection or relaxed option is allowed.

Reserve that backend, BEGIN READ ONLY, statement_timeout5000, UTC,
search_pathpg_catalog,public, application_name mc-telemetry-cte-v1. Check exact
backend/server/database/user/data directory `/opt/homebrew/var/postgresql@17`
and approved migration31 name/checksum against the retained source helper.
No DDL, initialization, advisory locks or real step-row query. Execute captured
query bytes/parameter array unchanged inside reviewed literal typed VALUES
outer CTE named steps; the two inner queries must remain unqualified steps-only
SELECTs, no inner steps CTE, other relations/functions, mutating CTE or lock.
Here other functions means unreviewed functions: isfinite, to_char,
EXTRACT(EPOCH), AVG and required built-in casts are explicitly permitted by
the exact two independently reviewed query byte allowlists.
Outer fixture has no parameters. Compare results as multiplicity-preserving
multisets (outer SELECT has no order guarantee); separately prove actual query
ORDER BY and route row preservation. ROLLBACK, end and definite raw socket close
are awaited. Optional unselected test stays visibly skipped/unqualified.

Fixtures cover250/100/100 (no flag),400/100/100 (equality no flag),450/100/100
(flag), subms0 display, invalid/nonterminal exclusion, duplicated human IDs,
UTC, BC/AD, wide years/microseconds, exact extrema and full-range endpoint pair.
Real successful SQL plus owned closure is mandatory before PR delivery; a
configuration/auth failure remains failure, not simulated success.

The sole opt-in test owner executes the positive fixture first, then a fresh
closed child for the one fixed exclude-current mutation. Mutate the actual
route's single GROUP BY prefix to add the fixture-only exclusion literal;
admit its independently nominated exact query bytes, never arbitrary SQL.
Q1 and parameters remain unchanged. After identical identity/closure gates,
the normal13-average assertion must fail specifically with AssertionError,
and the result must exactly match five hand-frozen historical-only averages:
below/equal/above/duplicate100 and subms0.001. This killed semantic control
does not qualify positive SQL; unknown-SQL or cleanup refusal cannot satisfy it.

## Completion gates

Independent literal design/plan review, owned harness selfwitness/parity, actual
HTTP/client/render RED, minimal GREEN, coherent mutants, mandatory real SQL,
focused tests/build, independent exact diff and GitHub feedback review, normal
scoped PR/merge, preserved clean-main build. Live rollout/host proof occurs only
under the later guarded cutover phase. No percentage/ETA or runtime readiness
is inferred from ordinary tests.

## Primary references (inference, not executed SQL)

- https://raw.githubusercontent.com/postgres/postgres/REL_17_10/src/backend/utils/adt/timestamp.c
- https://www.postgresql.org/docs/17/sql-select.html#SQL-FROM
- https://www.postgresql.org/docs/17/functions-formatting.html
- https://nodejs.org/docs/v26.4.0/api/module.html#moduleregisterhooksoptions
