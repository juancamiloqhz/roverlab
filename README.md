# RoverLab

A browser-based planetary rover sandbox for experimenting with autonomous decisions using TypeSafe AI.

Give a rover a mission, change its environment, and inspect how its choices affect exploration, energy use, and discoveries.

## Project status

Tickets [01](.scratch/first-playable-release/issues/01-watch-an-autonomous-expedition.md), [02](.scratch/first-playable-release/issues/02-discover-the-area-through-limited-perception.md), [03](.scratch/first-playable-release/issues/03-inspect-collect-and-deliver-scientific-samples.md), [04: Manage energy across multiple trips](.scratch/first-playable-release/issues/04-manage-energy-across-multiple-trips.md), and [05: Inspect decisions and update mission instructions](.scratch/first-playable-release/issues/05-inspect-decisions-and-update-mission-instructions.md) are implemented. Choose Investigate past water or Find unusual minerals, then watch a local 3D baseline expedition discover terrain, inspect samples, collect cargo, return it to base, and recharge for further trips. Orbit the camera and use pause/resume, reset, stop, and 1×/2×/4× playback. Battery and accumulated energy use are visible throughout. Results show discoveries, inspections, delivered science score, energy use, the ending condition, baseline attribution, and uncredited cargo. Edit mission instructions before or during the expedition and expand the decision timeline to inspect the exact knowledge, resources, complete candidates, and selected action at each decision. No API key is needed.

[Ticket 06](.scratch/first-playable-release/issues/06-run-a-typesafe-controlled-expedition.md) adds a selectable TypeSafe controller, a local Bun backend, returned Choice probabilities, bounded inference, and attempt/latency accounting. [Ticket 07](.scratch/first-playable-release/issues/07-recover-explicitly-from-inference-failures.md) adds explicit Retry and baseline continuation after inference failure, with controller transitions in the timeline and results. The baseline remains the default and requires no key or backend. [Ticket 08](.scratch/first-playable-release/issues/08-respond-to-a-localized-dust-storm.md) adds a discoverable dust storm, reduced sensing, increased movement costs, and selectable known detours. [Ticket 09](.scratch/first-playable-release/issues/09-follow-the-rover-and-inspect-perception.md) adds a rover-follow camera, current sensor coverage, an isolated full-world debugging view, and visible wheel/suspension articulation. [Ticket 10](.scratch/first-playable-release/issues/10-save-and-exchange-expedition-records.md) adds automatic browser-local saving, read-only inspection, and validated JSON export/import. [Ticket 11](.scratch/first-playable-release/issues/11-replay-recorded-expeditions.md) adds replay from saved or imported records, with independent playback controls and no new inference. [Ticket 12](.scratch/first-playable-release/issues/12-compare-and-tune-expeditions.md) adds saved-expedition comparison and measured scenario tuning.
## Planned complete demo

A local 3D sandbox with one rover, a designed planetary area, a charging base, three sample sites, and a localized dust storm. Five-minute expeditions offer two scientific objectives, editable mission instructions, two-sample cargo capacity, and delivery-only scoring. The rover chooses between exploration, inspection, collection, returning to base, recharging, and waiting. Decisions can be inspected, saved, and replayed.

## Stack

- React, TypeScript, and Vite for the browser application.
- Three.js through React Three Fiber for the world and rover.
- An independent TypeScript simulation with fixed time steps and grid navigation.
- Bun for dependency management, package scripts, and expedition tests.
- A small Bun backend using the official TypeSafe JavaScript SDK.

## Tooling

Use **Bun 1.4.2**, pinned in `.bun-version` and `package.json`. Dependencies are locked in the Bun-generated `bun.lock`; use Bun for dependency changes. Vite development and production builds run explicitly under Bun, following the [Bun Vite guide](https://bun.sh/guides/ecosystem/vite).

Install the pinned version using a version manager or the [official Bun installer](https://bun.sh/docs/installation), then:

```sh
bun --version # 1.4.2
bun install --frozen-lockfile
bun run dev
```

Open the local address printed by Vite (normally `http://127.0.0.1:5173`). Start the expedition; drag the scene to orbit, scroll to zoom, and use the controls below it. Reset returns the rover, time, speed, and exploration targets to their authored starting state.

### Verification

```sh
bun run typecheck
bun test tests/expedition.test.ts # focused public-session scenarios
bun test tests/perception.test.ts # sensor boundaries, memory, and known-map navigation
bun test tests/presentation.test.ts # detached full-world reads preserve knowledge, decisions, and outcomes
bun test tests/science.test.ts    # inspection, cargo, fixed objectives, and delivery scoring
bun test tests/energy.test.ts     # terrain costs, multiple trips, recharge, depletion, and interaction timeout
bun test tests/storm.test.ts    # disclosure, sensing, crossing/detours, expiry, safe reconsideration, and frozen time
bun test tests/decisions.test.ts # instruction edits, safe reconsideration, pending decisions, and stale results
bun test tests/records.test.ts # completed histories, JSON validation, reset isolation, and inference settlement
bun test tests/replay.test.ts # recorded execution, playback independence, controller histories, and incompatible records
bun test tests/tuning.test.ts # baseline/scripted tradeoffs, storm responses, and replay across scenario versions
bun test tests/usage.test.ts # provider accounting, token costs, historical pricing, and legacy replay
bun test tests/typesafe.test.ts # real SDK with scripted service, retries, deadlines, budget, recovery, controller history
bun test                        # all non-browser tests
bun run build
bun run preview                 # serve the production build locally
```

The browser smoke check uses Playwright's Node-based runner through a Bun script. It needs Node.js 22 or newer and Chromium; Node is only needed for this browser check. Install Playwright's matching browser once:

```sh
bunx playwright install chromium
bun run test:browser
```

On Linux, Playwright may also need system browser libraries (`bunx playwright install --with-deps chromium`). To use an already installed Chromium instead:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium bun run test:browser
```

`bun run check` runs typechecking, the production build, the full Bun suite, and the browser smoke checks. These start their own Vite server on port 4173 and a scripted-service backend on port 4174. They verify the scene and labels, autonomous movement, an orbit-camera change while paused, every playback setting, reset, timeout, manual stop, visible discovery, remembered observations, objective selection, inspection, cargo, delivery scoring, battery use, recharge/pause behavior, instruction edits, decision inspection, TypeSafe selection/probabilities/failure status, storm introduction/discovery/expiry, camera/control responsiveness during pending decisions, follow tracking and orbit restoration, sensor coverage changes, full-world isolation, stationary wheel/suspension poses during pauses, and saved-record reload, selection, export/import, invalid import feedback, and inspection without inference. Replay checks cover saved and imported histories, pause/speed/stop/restart controls, rejection feedback, unchanged exports, and TypeSafe/mixed playback with backend access blocked. Verification never loads a real key or calls the paid service. Screenshots and failure traces go to ignored `test-results/`.

### Expedition boundary

`createExpedition()` in `src/simulation/expedition.ts` exposes `dispatch(command)`, `advanceWallTime(milliseconds)`, `getSnapshot()`, `getRecord()`, and `getDecisions()`. Decision history is read separately from frequently refreshed telemetry; `decisionRevision` changes only when that history changes. `onDecisionSettled()` lets the UI reset its wall-time anchor when an asynchronous request finishes, preventing pending time from being counted on the next timer callback. The UI and Bun scenarios use this same boundary. A browser timer supplies wall time independently of React Three Fiber frames; controls account for elapsed wall time before changing speed or status. Camera interaction only changes the presentation.

The session advances in 100 ms simulation steps, preserving partial steps across scheduler calls and pauses. Entering plain terrain takes four simulated seconds per cell; rough terrain takes eight. Routes minimize travel time through known traversable cells, with stable tie-breaking. The baseline waits five seconds after completing an exploration target, otherwise inspects and collects nearby reachable samples. It returns when its two cargo slots are full or it carries samples with no other reachable sample to pursue. With no sample work, it chooses the nearest frontier by estimated travel time (east, then north on ties), or waits when none remains. There is no direct piloting.

Inspection takes six seconds at the sample and reveals its authored properties; collection is a separate four-second interaction. Collection candidates require a reachable, available sample and a free cargo slot. Returning to base unloads cargo automatically. The fixed objective's rubric credits each delivered sample once: unrelated = 0, suggestive = 5, strong evidence = 10. Properties and classifications remain outside controller inputs before inspection; authored classifications stay private until delivery results. Select the objective before starting; reset begins a fresh expedition and unlocks selection. Battery starts at its 100-unit capacity. Entering a plain cell uses two energy units; rough terrain uses four, charged continuously by distance traveled. Route energy estimates use only known terrain. Waiting, inspection, and collection consume time without additional battery use. Recharge is offered only at base below capacity, restores five units per simulated second, and ends at full charge. Recharging never reduces accumulated energy use. The baseline skips top-ups above 90% and otherwise recharges; away from base, it chooses a return when battery falls to the known return-route cost plus a ten-unit reserve. This is controller strategy: positive battery still permits a route that may exhaust it. Movement stops at depletion; exhausting battery away from base ends with a stranded-rover result. Reaching base at exactly zero permits unloading and recharge.

The baseline follows the same collection strategy for both objectives; their delivery scores differ. Time spent inspecting, delivering, returning for energy, and recharging reduces exploration time, so an expedition may end with undiscovered sites or undelivered cargo. Cargo still aboard at timeout or manual stop earns no points.

Sensors accurately observe cell centers and objects within a three-cell Euclidean radius, including during travel, without occlusion. The snapshot separates current observations from timestamped rover memory. The scene renders only that memory: bright terrain is in range, dim terrain is remembered, and the dark surface is unknown. Sample labels and mission-control entries distinguish current from remembered observations and show last-seen times. Diamonds mark rough terrain. The authored sites are Sample A near base, Sample B at the storm center at (15, 13), and distant Sample C at (17, 5); their properties are private world data.

Concrete exploration targets are known, reachable cells bordering unknown terrain. Neither candidates nor route estimates use undiscovered terrain or sample properties. The controller receives only current observations, memory, rover position, sensor range, previous action, and those candidates. `createExpedition({ scenario })` supplies alternate starting conditions for public-session scenarios; the browser uses the authored scenario. The normal scene reads snapshots and never imports the world catalog. The explicitly labeled full-world debugging view uses the separate, detached `getFullWorldView()` read method; world truth never enters a snapshot or controller input.

Snapshots and records are detached copies. `getRecord()` captures full starting conditions separately from controller inputs, plus timestamped first discoveries, objective selections, inspections, collections, deliveries, movement/recharge resource changes, exact decision inputs/selections, and ordered lifecycle/action events with baseline attribution. Memory stores the last observation time, refreshed only while an object or cell is sensed, plus inspection time and the rover's known cargo/delivery status. Collected samples disappear from the scene but remain in discovery history. Reset preserves the session history and selected objective, increments the event's expedition number, restarts simulated time at zero, restores full battery, clears accumulated energy use, cargo, and science results, and restores only the initial sensor observations. Mission instructions persist across reset; their version restarts at zero and the reset event captures their text. Completed records are also available through `getCompletedRecords()` and `onExpeditionCompleted(listener)`; their events are scoped to one expedition, with detached final observations, memory, results, and decisions. The existing `getRecord()` retains its session-wide diagnostic history. `createReplay(record)` exposes the same session boundary for recorded playback, without publishing new completed records.

### Decision inspection and mission instructions

Mission instructions are limited to 20,000 characters, matching the shared decision and record contract; oversized drafts show feedback before they can be applied. Apply instruction edits to record them and update controller context without changing the scientific objective or rubric. The baseline receives the text and reconsiders with its existing fixed rules; it does not interpret free-form preferences. The timeline states this explicitly and shows no invented model probabilities or reasoning. Each expandable entry contains its trigger, controller, instruction version and text, selected candidate identity, all complete action-and-target candidates and route estimates, resource state, sensor range, previous completed action, observations, and timestamped memory. Historical entries never acquire knowledge from later sensing or inspections.

Action completion, newly discovered terrain or objects, detected or expired known storms, and changed instructions prompt decisions. Travel stops for reconsideration at the next grid waypoint; inspection, collection, and bounded waiting already underway finish first. Recharge can be interrupted while stationary. Refreshing last-seen timestamps during routine movement does not request another decision. This means the authored rover now pursues Sample A at its first discovery instead of finishing its initial exploration target first.

The coordinator admits at most one controller decision at a time. Pending decisions freeze expedition time, movement, energy, and perception. Camera, pause, stop, reset, speed, and instruction controls remain responsive. Edits and lifecycle changes discard obsolete results and cancel TypeSafe requests; replacements wait for the cancelled operation to settle. Returned identities must match an originally offered candidate that still satisfies current preconditions, and execution uses the simulator's copy. Invalid selections pause without automatic controller substitution. The baseline resolves synchronously. TypeSafe failures pause and offer Retry or Continue with the baseline controller; stop/reset remain available. Request latency is recorded separately from simulated time.

Retry starts a new five-second decision operation using current instructions and rover knowledge, with at most one automatic retry. Every local submission counts toward the same expedition's 100-submission budget; the recovery button is disabled when it is exhausted. Continuing with baseline requires an explicit choice and resumes the same expedition, retaining its objective, elapsed time, cargo, battery, energy use, and earned science. The timeline records the transition before the first baseline decision, each decision names its responsible controller, and results list both controllers in order. Late responses from abandoned operations cannot execute. Reset starts a fresh budget and controller history.

### Localized dust storm

Use **Introduce dust storm** once per expedition, before starting or while running or paused. Reset restores the control. The authored storm lasts 45 expedition seconds, centered at (15, 13) with a 4.5-cell radius. Inside it, sensor range drops from three to 1.5 cells and movement energy triples; travel speed stays unchanged. To see the baseline encounter it, introduce it around 01:30 elapsed (03:30 remaining), as the rover approaches the eastern area. No key is needed.

Until the sensor footprint intersects the storm, its region, duration, effects, and route costs remain absent from rover knowledge and the scene. Introduction is acknowledged to mission control without revealing those details. Detection discloses the circle, exact expiration time, remaining time, and effects, then prompts reconsideration at the next safe waypoint. Existing inspections, collection, and bounded waits finish first. A newly detected storm invalidates an outstanding decision without overlapping requests. Hidden introduction does not invalidate an otherwise valid choice.

Normal routes still minimize travel time through known terrain. Where an active known storm would affect travel, the same exploration, inspection, collection, or return target can also offer an `avoid-storm` route through known cells, when one exists. Each route has its own candidate identity, estimated travel duration, distance, energy, and distance inside the active storm. Estimates assume immediate departure and account for the known expiration time; actual energy is charged only for distance traveled inside the region while active, including partial grid edges and rough terrain. Waiting consumes time without movement energy. Strategic crossings remain available even when they could strand the rover.

The baseline retains its existing priorities, preferring an offered detour for the chosen target when it saves energy and fits the remaining time. Otherwise it waits in five-second intervals if a costly crossing faces a storm with at most ten seconds left and there is time to wait and travel. This fixed rule is a demonstration strategy, not a guarantee of a successful expedition.

The scene shows the detected region with dust and a boundary ring, dimmed when remembered. The environment panel and decision timeline expose only rover knowledge. Out-of-range storm memory keeps its last-seen timestamp while its disclosed remaining time counts down to zero. Expiration removes the active observation and visual effect and restores ordinary sensing and energy rates. Manual pause and pending decisions freeze progression and dust animation while camera and controls remain responsive. Records retain the configured starting conditions, introduction, detection, expiration, effect transitions, and movement energy events separately from controller inputs. Completed records preserve these events for inspection, JSON exchange, and replay at their original expedition times.

### Cameras, sensor coverage, and full-world debugging

Use **Follow rover** to watch from nearby as the camera tracks the rover. Drag to look around it and scroll to zoom; these adjustments remain while it moves. **Orbit camera** restores the last orbit perspective. Switching, dragging, zooming, and toggling overlays work before starting, during movement, while paused, and while a controller decision is pending. Reset retains the view settings and follows the rover back to base.

**Sensor coverage** starts enabled. Its cyan disc and boundary show the current sensor radius around the rover, using the snapshot's position and range directly. It contracts inside a storm and expands when ordinary sensing resumes. The radius label gives the current range in cells. This overlay does not discover terrain or change sensing.

**Full-world debugging view** starts disabled. Enabling it labels the scene **Full-world view · DEBUG** and reveals all terrain, obstacles, remaining sample sites, and any active storm, including hidden ones. Object labels still say whether the rover knows them. Discovery telemetry and the decision timeline continue to show only rover knowledge. Collected samples and expired storms disappear; reset restores the original world. The debug projection excludes sample properties and scoring classifications. Toggling it changes only presentation.

Wheel treads and spokes rotate with simulated distance, suspension arms articulate, and the chassis gently moves over its suspension. These are visual effects within the existing simplified movement model. Stationary, paused, and pending expeditions hold their wheel/suspension pose; camera interaction remains available. No traction, slip, or tipping simulation is added.

The observation browser scenarios compare the complete decision history and expedition record against an identical run without view changes, exercise pending decisions and storm range changes, and verify follow tracking, orbit restoration, paused inspection, and reset. Their screenshots are written to `test-results/observation-*.png` and `test-results/rover-moving-*.png`.

### Saved expeditions and JSON exchange

Completed expeditions save automatically in this browser using IndexedDB. The header’s **Saved expeditions** link leads to the list below the live workspace. The list identifies each run by its completion time, objective, science score, and controller history. Use **Open expedition** to inspect the saved results, decision timeline, final observations, and rover memory. Opening a record pauses an active live expedition without advancing it; returning to the live view leaves it paused until you resume. Inspection uses no TypeSafe requests or credentials.

From the saved view, **Export expedition JSON** downloads the entire record. **Import expedition JSON** validates and saves a compatible export, then opens its history. Importing an identical record again keeps one copy; an existing identity with different data is rejected without overwriting the saved record. Malformed, incomplete, unsupported-version, or unexpected-field data is rejected with a message. Validation reconciles decision requests, attempts, outcomes, action events, mission edits, and controller transitions with the saved timeline and results; it does not execute the simulation. Imported data is never passed to the live command interface. Imports are limited to 32 MB. If browser storage is unavailable or full, completed histories remain available in the current page for JSON export; unsaved entries are labeled explicitly.

Version 3 records add execution status, evidence revisions, and later accounting, including updates after an expedition has ended. Version 2 records retain their original provider-attempt evidence and usage totals. Version 1 records remain supported with their original local-submission counters and unavailable model, token, and cost metadata. All three versions contain the original scenario and simulation settings, initial mission and rubric, ordered events, exact decisions and returned probabilities, controller transitions, and the final snapshot including observations, memory, cargo, deliveries, inference attempts, and latency. Pre-start objective/controller selections and all instruction edits remain in the event history. Reset scopes subsequent completions to a new expedition with its own starting instructions, objective, and controller. A stop during inference waits for cancellation to settle before publishing the complete record, preserving latency even if reset happens first. Strict field validation keeps credentials and provider error bodies out of the record contract.

The record scenarios exercise baseline-only, TypeSafe-only, and explicitly mixed-controller histories with storms, changed instructions, failures, recovery, cancelled requests, and rapid stop/reset sequences. Browser checks cover persistence across reload, selection, JSON exchange in a separate browser context, invalid files, and inspection with backend access blocked. They use only the scripted inference service.

### Recorded replay

Open a saved or imported expedition and choose **Replay expedition**. The labeled replay view shows the original scenario unfolding, current telemetry and mission instructions, the growing decision timeline, and recorded final results. Orbit/follow cameras and observation overlays remain available. Use **Pause replay**, **Resume replay**, 1×/2×/4× playback, **Stop replay**, or **Restart replay**. Return to the saved record or live workspace at any time. Playback does not modify the source record or save another expedition.

Replay executes recorded choices through the same simulator, using the original scenario, objective, and rubric. Mission edits, controller transitions, storm events, and ending conditions occur at their recorded expedition times. Original pauses and inference waits consume no expedition time and are crossed immediately; the replay's own pause and speed controls govern viewing. The timeline and results retain the original probabilities, inference attempts, and latency. No controller is asked to select new actions, no inference attempts are submitted, and credentials are unnecessary.

Before playback starts, `createReplay(record)` validates the version 1, 2, or 3 contract, checks that recorded simulation settings match the supported rules, and runs the history to verify every event, decision, and final result. Unsupported settings or an irreproducible history receive a clear error while the saved record remains available for inspection/export. Replay never falls back to a new live expedition. Session scenarios cover all ending conditions, baseline/TypeSafe/mixed histories, storms, instructions, recovery, cancellation/reset races, and matching outcomes at every playback speed. Browser checks cover save/import-to-replay, independent controls, unchanged JSON, rejection feedback, and TypeSafe/mixed replay with backend access blocked.

### Compare and tune expeditions

Select two saved expeditions and choose **Compare selected expeditions**. The comparison identifies matching or different scenarios, simulation settings, fixed objectives, and rubrics. Storm introduction times and effects remain visible even when never detected by the rover. Initial instructions, subsequent edits, and controller transitions appear beside the results; mixed-controller expeditions are labeled explicitly. Science score, discoveries, inspections, energy, cargo, and ending conditions are separate from inference usage and wall-clock latency. **Inspect expedition** opens the recorded timeline and its actual returned probabilities.

Comparison pauses an active expedition without changing records or making inference requests. Return to the live workspace and resume explicitly. On narrow screens, the comparison tables scroll horizontally and can be focused for keyboard scrolling.

The tuned `ochre-basin-v5` layout moves Sample C one cell to (17, 5). A deliberate survey can deliver all samples at 253.2 seconds, or 298.2 seconds when waiting on costly routes after a storm at 90 seconds. Skipping recharge or crossing recklessly can strand the rover; a 50-second initial delay loses delivery credit. These are repeatable scripted checks, not claims about live TypeSafe quality. Run `bun scripts/playtest-tuning.ts` (or add `--sweep`) and see [the tuning report](docs/expedition-tuning.md) for parameters, measured costs, scenarios, and limitations. Existing records replay their original layouts. Browser checks cover matching/mismatching comparisons, mobile layout, mixed-controller histories, unchanged exports, and blocked-backend viewing.

## Design principles

- Code owns movement, pathfinding, resource accounting, action validity, and execution.
- TypeSafe selects bounded actions using observations, memory, mission instructions, and available options.
- The rover sees only what its sensors have discovered; observations carry timestamps.
- Rendering is separate from simulation and decision making.
- Record actual decisions and actions for faithful replay.
- Keep API credentials on the server.

See [the build plan](docs/build-plan.md) for the accepted decisions, starting defaults, milestones, and validation; [the domain glossary](CONTEXT.md) defines the project vocabulary.

## TypeSafe access

To run TypeSafe, copy `.env.example` to the ignored `.env` and set `TYPESAFE_API_KEY` there, or supply it in the backend process environment. Never prefix it with `VITE_`. Run these in separate terminals:

```sh
bun run dev:server # loopback backend on 127.0.0.1:3001; Bun loads .env
bun run dev        # Vite proxies /api to that backend
```

Choose **TypeSafe · Server key required** before starting. Reset unlocks controller selection for a fresh expedition. `bun run start:server` runs the backend without watching; `bun run preview` also proxies to it. `ROVERLAB_BACKEND_URL` optionally changes the local proxy target (used by browser verification). No credential enters browser code, responses, records, or SDK logs. The server explicitly disables SDK logging and returns only validated choices or fixed failure codes, never provider error bodies.

The official `@typesafe-ai/sdk` **0.6.0** is exercised under **Bun 1.4.2**. Its installed types/source and [official SDK reference](https://docs.typesafe.ai/sdk/javascript) were checked: `systemOne` accepts typed `choice` questions, `AbortSignal`, per-attempt timeout, and retry configuration. The SDK normally retries twice and has no total retry deadline. RoverLab sets `maxRetries: 0` on the client and each call. The browser controller owns one five-second operation across local transport, body reading, and at most one immediate retry; the backend receives the same absolute deadline and aborts its one SDK attempt within the remaining time. Only transport failures and provider 408, 429, or 5xx failures are eligible for automatic retry. Invalid output and configuration failures do not retry.

The expedition reserves each local submission before sending its request, including retries and requests that fail before reaching TypeSafe. This conservative accounting prevents uncertain transport failures or cancellation from refunding usage. At 100 local submissions, further inference pauses before sending a request. Stop/reset and instruction changes abort obsolete operations; their attempts and settlement latency remain in the original expedition's event history. Reset gives the new expedition a fresh budget. Manual pause preserves an outstanding valid request but does not resume simulation when it returns.

### Jev usage and estimated inference cost

[Jev decision lab ticket 01](.scratch/jev-decision-lab/issues/01-show-actual-jev-usage-and-estimated-cost.md) adds usage accounting to the existing layout. Live telemetry, decision details, saved results, replay, and comparison distinguish controller decisions, local submissions, confirmed outbound provider attempts, and provider retries. The backend confirms an attempt only when the SDK invokes its outbound transport. Missing credentials and invalid input rejected before dispatch contribute zero provider attempts. The existing `inferenceAttempts` field and 100-submission guard retain their local-submission meaning.

Each Jev decision records its expedition UUID and numeric decision identity. Each local submission has a separate attempt UUID, including a retry. The validated exchange returns those identities with the prompt version, requested alias, actual resolved model, input/output tokens, safe provider request ID, and available wall-time timing. Decision latency includes local transport and attempts; cumulative inference wait sums sequential Jev decisions. Attempt durations measure outbound work and are never added to that wait. A late response can arrive after its decision has already settled. Expedition time stays frozen during decisions.

Estimated inference cost is `(input tokens × input rate + output tokens × output rate) / 1,000,000`. The [official model reference](https://docs.typesafe.ai/models), checked on September 22, 2026, lists `jev-1.13.0` at USD $0.042 per million input tokens and $0 per million output tokens. Each response records these rates, their model, currency, capture time, verification date, and source. The `rover-action-v1` prompt retains the existing bounded action-selection instructions. `jev-latest` is only the requested alias; an absent resolved model stays unavailable. New model IDs require a separately verified pricing entry in `server/inference.ts`.

For example, 1,000 input tokens and 40 output tokens yield an estimated inference cost of $0.00004200 USD. Missing tokens or an unknown pricing basis leave the total incomplete, with a separately labeled known subtotal. An unconfirmed local submission does not establish zero provider access. These values are estimates, not verified provider charges. Configurable limits and uncertainty pauses remain ticket 03. The existing 100-submission ceiling and explicit failure recovery still apply.

Version 3 exports retain attempt evidence, execution status, revisions, and pricing. Validation checks identities, history, and totals, including accounting appended after an expedition ends. Inspection and replay use the saved prices without new inference or changes to the source record. Version 1 exports retain their original meaning and show the new metadata as unavailable. The legacy fixture in `tests/fixtures/legacy-usage-v1.json` was captured from commit `9713ae8` using its real session, backend, and SDK against a scripted provider. The version 2 fixture was captured the same way from ticket 01 commit `cb15524`. Both legacy versions retain their original evidence and replay unchanged. Automated checks never call the paid service.

### Failure accounting and later evidence

[Jev decision lab ticket 02](.scratch/jev-decision-lab/issues/02-preserve-accounting-through-failures-and-cancellation.md) separates provider execution from choice validity. Inspect a decision to see whether each submission was rejected before dispatch, remains unconfirmed, is in flight, received a response, failed, was cancelled, or exceeded its deadline. Invalid or obsolete choices retain available model, tokens, safe request IDs, HTTP status, and attempt timing. Confirmed attempt counts are a lower bound when submissions remain unconfirmed. Missing usage or prices leave cost incomplete, with its known subtotal labeled as a lower bound.

Use **Refresh inference accounting** in **Saved expeditions** to check submissions made on the current page, including stopped expeditions after reset. The read-only `/api/decision/usage` lookup sends no new Jev requests and cannot execute an action. Repeated lookups use the original identities and evidence revisions without adding duplicate usage. Late evidence updates the original expedition and saves an accounting-only extension of its history. Reopen that entry to inspect the update; an already opened record or replay keeps its detached snapshot. Imports still reject conflicting identities, and playback never reads live accounting.

The backend retains evidence for its most recent 1,000 submissions in process memory. Duplicate delivery of an attempt in that window reuses its original response. Restarting the backend or evicting an entry leaves a lookup unresolved; refreshing the browser ends that page's reconciliation session. A provider connection that offers no further evidence remains unknown. A bounded observer can retain available metadata from an existing response after cancellation, but it never retries the provider to recover usage. Each refresh lookup has a five-second timeout independent of expedition time.

The failure scenarios cover provider failures with usage, retries, malformed choices and bodies, lost local responses, connection loss, cancellation, deadline expiry, stalled bodies, duplicate deliveries, late results after reset, and version 1/2/3 replay. Browser checks cover uncertainty labels, refresh without inference, durable updates, reload, and unchanged keyless replay exports.

Runtime contracts reject unexpected context fields and validate complete candidate identities, finite probabilities in [0, 1], and a complete distribution summing to one (0.01 rounding tolerance). TypeSafe sees only rover knowledge and resources, never authored sample classifications or undiscovered properties. Actual probabilities appear beside candidates and remain in events; they are not scientific value, a correctness guarantee, or reasoning. Uncertain valid choices proceed automatically.

The no-credential tests exercise the actual SDK against scripted external responses, including full expeditions, a shared retry deadline, stalled bodies, native Bun HTTP cancellation, stale results, invalid output, exhausted budgets, and credential/log isolation. Live scientific decision quality has not been evaluated with paid calls.

## References

- [TypeSafe concepts](https://docs.typesafe.ai/concepts/system-one)
- [TypeSafe JavaScript SDK](https://docs.typesafe.ai/sdk/javascript)
- [TypeSafe Choice primitive](https://docs.typesafe.ai/primitives/choice)
- [React Three Fiber](https://github.com/pmndrs/react-three-fiber)
- [Bun test runner](https://bun.sh/docs/test)
- [Bun lockfile](https://bun.sh/docs/pm/lockfile)
