# RoverLab

A browser-based planetary rover sandbox for experimenting with autonomous decisions using TypeSafe AI.

Give a rover a mission, change its environment, and inspect how its choices affect exploration, energy use, and discoveries.

## Project status

Tickets [01](.scratch/first-playable-release/issues/01-watch-an-autonomous-expedition.md), [02](.scratch/first-playable-release/issues/02-discover-the-area-through-limited-perception.md), [03](.scratch/first-playable-release/issues/03-inspect-collect-and-deliver-scientific-samples.md), [04: Manage energy across multiple trips](.scratch/first-playable-release/issues/04-manage-energy-across-multiple-trips.md), and [05: Inspect decisions and update mission instructions](.scratch/first-playable-release/issues/05-inspect-decisions-and-update-mission-instructions.md) are implemented. Choose Investigate past water or Find unusual minerals, then watch a local 3D baseline expedition discover terrain, inspect samples, collect cargo, return it to base, and recharge for further trips. Orbit the camera and use pause/resume, reset, stop, and 1×/2×/4× playback. Battery and accumulated energy use are visible throughout. Results show discoveries, inspections, delivered science score, energy use, the ending condition, baseline attribution, and uncredited cargo. Edit mission instructions before or during the expedition and expand the decision timeline to inspect the exact knowledge, resources, complete candidates, and selected action at each decision. No API key is needed.

[Ticket 06](.scratch/first-playable-release/issues/06-run-a-typesafe-controlled-expedition.md) adds a selectable TypeSafe controller, a local Bun backend, returned Choice probabilities, bounded inference, and attempt/latency accounting. [Ticket 07](.scratch/first-playable-release/issues/07-recover-explicitly-from-inference-failures.md) adds explicit Retry and baseline continuation after inference failure, with controller transitions in the timeline and results. The baseline remains the default and requires no key or backend. [Ticket 08](.scratch/first-playable-release/issues/08-respond-to-a-localized-dust-storm.md) adds a discoverable dust storm, reduced sensing, increased movement costs, and selectable known detours. [Ticket 09](.scratch/first-playable-release/issues/09-follow-the-rover-and-inspect-perception.md) adds a rover-follow camera, current sensor coverage, an isolated full-world debugging view, and visible wheel/suspension articulation. [Ticket 10](.scratch/first-playable-release/issues/10-save-and-exchange-expedition-records.md) adds automatic browser-local saving, read-only inspection, and validated JSON export/import. [Ticket 11](.scratch/first-playable-release/issues/11-replay-recorded-expeditions.md) adds replay from saved or imported records, with independent playback controls and no new inference. [Ticket 12](.scratch/first-playable-release/issues/12-compare-and-tune-expeditions.md) adds saved-expedition comparison and measured scenario tuning.
## Playable expedition

A local 3D sandbox with one rover, a 42 × 38 authored area, a charging base, twelve sample sites in three research regions, and a localized dust storm. Eighteen-minute expeditions offer two scientific objectives, editable mission instructions, two-sample cargo capacity, and delivery-only scoring. The rover chooses between exploration, inspection, collection, returning to base, recharging, and waiting. Decisions can be inspected, saved, and replayed.

[Jev decision lab ticket 07](.scratch/jev-decision-lab/issues/07-explore-a-larger-world-over-longer-expeditions.md) adds the expanded world and version 8 records with explicit simulation settings. Saved versions 1 through 7 retain their original five-minute conditions. A deterministic survey delivers five samples in three trips, while skipping recharge can strand the rover. See [world parameters and measured outcomes](docs/expanded-world.md).

### Fullscreen expedition workspace

[Jev decision lab ticket 08](.scratch/jev-decision-lab/issues/08-use-fullscreen-expedition-layout-a.md) implements the selected Expedition layout A with real session data. The world fills the window beneath persistent live resources, provider attempts, and estimated inference cost. The latest completed choice shows its controller, trigger, returned probability, wall-time latency, and estimate. Pending decisions retain the previous choice as labeled history. Code execution appears separately from controller choice.

Open **Mission**, **Evidence**, **Usage & recovery**, or **Saved expeditions** for the existing controls and records. **Inspect decisions** pauses the live expedition; closing a panel does not resume it. Usage pauses and failures open their recovery controls, and **Review recovery** reopens them. Completed expeditions open **Results** and still save automatically even when the records panel is closed. Saved inspection, replay, and comparison identify historical usage; the top telemetry continues to identify the live expedition.

Panels support Tab, Enter, and Escape, with focus returning to the opener when closed. On narrow screens, panels scroll above the persistent pause, stop, reset, and speed controls. Orbit, follow, sensor coverage, and full-world debugging remain available. **Fullscreen** requests browser fullscreen only on a click; unavailable or rejected requests leave the normal window usable.

[Jev decision lab ticket 09](.scratch/jev-decision-lab/issues/09-inspect-decisions-spatially-and-use-teaching-mode.md) links numbered map targets to the decision card, timeline, and complete action table. Diamonds and text identify the selected target; circles identify offered targets. Wait identifies the recorded rover position and recharge identifies base. Selecting a decision pauses the session and shows that decision's original observations, memory, resources, probabilities, and usage. Historical maps disable full-world debugging. The top telemetry continues to describe the live expedition. Return to live view leaves the expedition paused until explicit continuation.

**Teaching mode** holds each completed controller choice before its action starts. **Continue selected action** executes it once, provided it is still valid and no inspection, usage guard, or failure blocks it. A pending result can settle during inspection without resuming time. Mission edits and detected storms invalidate held choices; stop and reset clear them. Ordinary viewing continues automatically regardless of a valid choice's probability. Explanations describe planned code execution and recorded route estimates, not completed outcomes or Jev's reasoning.

Version 9 records retain teaching changes, inspected decisions, held choices, continuation, and invalidation. Saved records and replay support spatial inspection without inference or changes to source exports. Replay has its own teaching control. Versions 1 through 8 remain supported under their original rules, with missing evidence shown as unavailable.

[Jev decision lab ticket 10](.scratch/jev-decision-lab/issues/10-compare-jev-and-baseline-choices-at-the-same-decision.md) adds a decision comparison. Each Jev request records the baseline's alternative from a detached copy of the same input. The card reports agreement or disagreement on the complete action, including its route. The inspector shows both numbered targets, the saved baseline version and code rule, and the free-text limitation. Map labels identify Jev and baseline choices without relying on color. Pending, failed, and obsolete Jev decisions retain the suggestion without executing it or changing the controller. A different choice does not establish a better expedition outcome.

Version 10 records preserve these alternatives through local saving, validated import/export, and replay without recomputing them. Versions 1 through 9 retain their original data; absent alternatives remain unavailable. Matched-expedition outcomes remain separate work in ticket 12.

[Jev decision lab ticket 11](.scratch/jev-decision-lab/issues/11-record-and-reproduce-intervention-schedules.md) adds **Use example schedule** in the Mission panel. It requests Explore more at 01:00, then introduces a fixed-location storm and requests Conserve energy at 06:00. Manual mission changes and storms join the captured schedule at their actual expedition times. The panel distinguishes request times from safe-boundary mission application and shows event data in live, saved, and replay views. Version 11 records preserve definitions, ordering, and actual history; versions 1 through 10 retain their original replay behavior. See [intervention schedules](docs/intervention-schedules.md) for clock resolution, ordering, and session reproduction.

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
bun test tests/baseline.test.ts # evidence rules, preset tradeoffs, resource plans, provenance, and legacy replay
bun test tests/energy.test.ts     # terrain costs, multiple trips, recharge, depletion, and interaction timeout
bun test tests/storm.test.ts    # disclosure, sensing, crossing/detours, expiry, safe reconsideration, and frozen time
bun test tests/mission.test.ts   # exclusive presets, shared SDK input, safe boundaries, history, and legacy replay
bun test tests/decisions.test.ts # instruction edits, safe reconsideration, pending decisions, and stale results
bun test tests/decision-viewing.test.ts # inspection, teaching, held-choice validity, guards, and legacy replay
bun test tests/interventions.test.ts # schedules, simultaneous boundaries, pauses, manual reproduction, and legacy replay
bun test tests/decision-comparison.test.ts # same-input alternatives, routes, failures, immutable evidence, and legacy replay
bun test tests/cadence.test.ts # provider request counts, coalesced triggers, resource boundaries, and legacy cadence
bun test tests/records.test.ts # completed histories, JSON validation, reset isolation, and inference settlement
bun test tests/replay.test.ts # recorded execution, playback independence, controller histories, and incompatible records
bun test tests/expanded-world.test.ts # long trips, failures, isolated knowledge, real SDK, and legacy replay
bun test tests/tuning.test.ts # baseline/scripted tradeoffs, storm responses, and replay across scenario versions
bun test tests/usage.test.ts # provider accounting, token costs, historical pricing, and legacy replay
bun test tests/usage-limits.test.ts # allowances, uncertainty, explicit continuation, late evidence, and version 4 replay
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

The session advances in 100 ms simulation steps, preserving partial steps across scheduler calls and pauses. Entering plain terrain takes four simulated seconds per cell; rough terrain takes eight. Routes minimize travel time through known traversable cells, with stable tie-breaking. The baseline uses inspected evidence, the scientific objective, and preset weights to rank science, exploration, delivery, and known route costs. Its resource plan reserves a return trip and an energy margin, and it retains the five-second wait after a completed frontier survey. See [baseline rules](docs/baseline-strategy.md) for the ordered rules, formulas, evidence vocabulary, and limitations. There is no direct piloting.

Inspection takes six seconds at the sample and reveals its authored properties; collection is a separate four-second interaction. Collection candidates require a reachable, available sample and a free cargo slot. Returning to base unloads cargo automatically. The fixed objective's rubric credits each delivered sample once: unrelated = 0, suggestive = 5, strong evidence = 10. Properties and classifications remain outside controller inputs before inspection; authored classifications stay private until delivery results. Select the objective before starting; reset begins a fresh expedition and unlocks selection. Battery starts at its 160-unit capacity in the expanded world. Earlier saved expeditions retain their recorded 100-unit capacity. Entering a plain cell uses two energy units; rough terrain uses four, charged continuously by distance traveled. Route energy estimates use only known terrain. Waiting, inspection, and collection consume time without additional battery use. Recharge is offered only at base below capacity, restores five units per simulated second, and ends at full charge. Recharging never reduces accumulated energy use. The baseline skips top-ups above 90% and otherwise recharges; away from base, it returns when battery falls to the cheapest known return-route cost plus the effective preset reserve. The reserve is ten energy units for Balanced and Explore more, twenty for Conserve energy. Positive battery still permits other controllers to select a route that may exhaust it. Movement stops at depletion; exhausting battery away from base ends with a stranded-rover result. Reaching base at exactly zero permits unloading and recharge.

The baseline interprets inspected properties against the selected objective, so the same specimen can prompt collection under one objective and be skipped under the other. Time spent inspecting, delivering, returning for energy, and recharging reduces exploration time, so an expedition may end with undiscovered sites or undelivered cargo. Cargo still aboard at timeout or manual stop earns no points.

Sensors accurately observe cell centers and objects within a three-cell Euclidean radius, including during travel, without occlusion. The snapshot separates current observations from timestamped rover memory. The scene renders only that memory: bright terrain is in range, dim terrain is remembered, and the dark surface is unknown. Sample labels and mission-control entries distinguish current from remembered observations and show last-seen times. Diamonds mark rough terrain. Twelve authored sites span the Western delta, Northern highlands, and Eastern volcanic field. Sample A is near base at (20, 24), and Sample B is at the storm center at (28, 24). Region names are learned with sensed terrain; sample properties remain private until inspection. See the [expanded-world measurements](docs/expanded-world.md) for all positions, route costs, and playtest outcomes.

Concrete exploration targets are known, reachable cells bordering unknown terrain. Neither candidates nor route estimates use undiscovered terrain or sample properties. The controller receives only current observations, memory, rover position, sensor range, previous action, and those candidates. `createExpedition({ scenario })` supplies alternate starting conditions for public-session scenarios; the browser uses the authored scenario. The normal scene reads snapshots and never imports the world catalog. The explicitly labeled full-world debugging view uses the separate, detached `getFullWorldView()` read method; hidden terrain and sample properties never enter a snapshot or controller input. Intervention schedules are separate mission-control metadata in snapshots; controllers receive neither the schedule nor its undiscovered storms.

Snapshots and records are detached copies. `getRecord()` captures full starting conditions separately from controller inputs, plus timestamped first discoveries, objective selections, inspections, collections, deliveries, movement/recharge resource changes, exact decision inputs/selections, and ordered lifecycle/action events with baseline attribution. Memory stores the last observation time, refreshed only while an object or cell is sensed, plus inspection time and the rover's known cargo/delivery status. Collected samples disappear from the scene but remain in discovery history. Reset preserves the session history and selected objective, increments the event's expedition number, restarts simulated time at zero, restores full battery, clears accumulated energy use, cargo, and science results, and restores only the initial sensor observations. Mission instructions persist across reset; their version restarts at zero and the reset event captures their text. Completed records are also available through `getCompletedRecords()` and `onExpeditionCompleted(listener)`; their events are scoped to one expedition, with detached final observations, memory, results, and decisions. The existing `getRecord()` retains its session-wide diagnostic history. `createReplay(record)` exposes the same session boundary for recorded playback, without publishing new completed records.

### Decision inspection and mission instructions

Mission instructions are limited to 20,000 characters, matching the shared decision and record contract; oversized drafts show feedback before they can be applied. Apply instruction edits to record them and update controller context without changing the scientific objective or rubric. The baseline receives the text and reconsiders with its existing fixed rules; it does not interpret free-form preferences. The timeline states this explicitly and shows no invented model probabilities or reasoning. Each expandable entry contains its trigger, controller, instruction version and text, selected candidate identity, all complete action-and-target candidates and route estimates, resource state, sensor range, previous completed action, observations, and timestamped memory. Historical entries never acquire knowledge from later sensing or inspections.

Action completion, newly discovered samples or inspected properties, detected or changed known storms, changed mission preferences, and resource threshold crossings prompt decisions. Routine terrain discovery updates memory without independently requesting a decision. All contributing trigger kinds appear in the recorded controller input and timeline. See [decision cadence](docs/decision-cadence.md) for thresholds and coalescing rules. Travel stops for reconsideration at the next grid waypoint; inspection, collection, and bounded waiting already underway finish first. Recharge can be interrupted while stationary. Refreshing last-seen timestamps during routine movement does not request another decision. This means the authored rover now pursues Sample A at its first discovery instead of finishing its initial exploration target first.

The coordinator admits at most one controller decision at a time. Pending decisions freeze expedition time, movement, energy, and perception. Camera, pause, stop, reset, speed, and instruction controls remain responsive. Edits and lifecycle changes discard obsolete results and cancel TypeSafe requests; replacements wait for the cancelled operation to settle. Returned identities must match an originally offered candidate that still satisfies current preconditions, and execution uses the simulator's copy. Invalid selections pause without automatic controller substitution. The baseline resolves synchronously. TypeSafe failures pause and offer Retry or Continue with the baseline controller; stop/reset remain available. Request latency is recorded separately from simulated time.

Retry starts a new five-second decision operation using current instructions and rover knowledge, with at most one automatic retry. Every provider attempt must satisfy the same expedition's configured attempt and estimated-cost guards. Unknown usage pauses before another request, including an otherwise eligible retry. Continuing with baseline requires an explicit choice and resumes the same expedition, retaining its objective, elapsed time, cargo, battery, energy use, and earned science. The timeline records the transition before the first baseline decision, each decision names its responsible controller, and results list both controllers in order. Late responses from abandoned operations cannot execute. Reset starts a fresh budget and controller history.

### Localized dust storm

Use **Introduce dust storm** once per expedition, before starting or while running or paused. Reset restores the control. The authored storm lasts 45 expedition seconds, centered at (28, 24) with a 4.5-cell radius. Inside it, sensor range drops from three to 1.5 cells and movement energy triples; travel speed stays unchanged. To see the baseline encounter it, select Find unusual minerals and introduce it around 01:30 elapsed (16:30 remaining), as the rover approaches the eastern area. No key is needed.

Until the sensor footprint intersects the storm, its region, duration, effects, and route costs remain absent from rover knowledge and the scene. Introduction is acknowledged to mission control without revealing those details. Detection discloses the circle, exact expiration time, remaining time, and effects, then prompts reconsideration at the next safe waypoint. Existing inspections, collection, and bounded waits finish first. A newly detected storm invalidates an outstanding decision without overlapping requests. Hidden introduction does not invalidate an otherwise valid choice.

Normal routes still minimize travel time through known terrain. Where an active known storm would affect travel, the same exploration, inspection, collection, or return target can also offer an `avoid-storm` route through known cells, when one exists. Each route has its own candidate identity, estimated travel duration, distance, energy, and distance inside the active storm. Estimates assume immediate departure and account for the known expiration time; actual energy is charged only for distance traveled inside the region while active, including partial grid edges and rough terrain. Waiting consumes time without movement energy. Strategic crossings remain available even when they could strand the rover.

The baseline compares offered crossings and detours using preset weights, known route costs, and its return plan. It waits in five-second intervals before an exposed route if a detected storm has at most ten seconds left and waiting fits the conservative time plan. These rules do not guarantee a successful expedition.

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

Version 4 records add initial inference allowances, allowance changes, uncertainty acknowledgements, and usage pauses. Version 3 records add execution status, evidence revisions, and later accounting, including updates after an expedition has ended. Version 2 records retain their original provider-attempt evidence and usage totals. Version 1 records remain supported with their original local-submission counters and unavailable model, token, and cost metadata. All supported versions contain the original scenario and simulation settings, initial mission and rubric, ordered events, exact decisions and returned probabilities, controller transitions, and the final snapshot including observations, memory, cargo, deliveries, inference attempts, and latency. Pre-start objective/controller selections and all instruction edits remain in the event history. Reset scopes subsequent completions to a new expedition with its own starting instructions, objective, and controller. A stop during inference waits for cancellation to settle before publishing the complete record, preserving latency even if reset happens first. Strict field validation keeps credentials and provider error bodies out of the record contract.

The record scenarios exercise baseline-only, TypeSafe-only, and explicitly mixed-controller histories with storms, changed instructions, failures, recovery, cancelled requests, and rapid stop/reset sequences. Browser checks cover persistence across reload, selection, JSON exchange in a separate browser context, invalid files, and inspection with backend access blocked. They use only the scripted inference service.

### Recorded replay

Open a saved or imported expedition and choose **Replay expedition**. The labeled replay view shows the original scenario unfolding, current telemetry and mission instructions, the growing decision timeline, and recorded final results. Orbit/follow cameras and observation overlays remain available. Use **Pause replay**, **Resume replay**, 1×/2×/4× playback, **Stop replay**, or **Restart replay**. Return to the saved record or live workspace at any time. Playback does not modify the source record or save another expedition.

Replay executes recorded choices through the same simulator, using the original scenario, objective, and rubric. Mission edits, controller transitions, storm events, and ending conditions occur at their recorded expedition times. Original pauses and inference waits consume no expedition time and are crossed immediately; the replay's own pause and speed controls govern viewing. The timeline and results retain the original probabilities, inference attempts, and latency. No controller is asked to select new actions, no inference attempts are submitted, and credentials are unnecessary.

Before playback starts, `createReplay(record)` validates the version 1 through 6 contract, checks that recorded simulation settings match the supported rules, and runs the history to verify every event, decision, and final result. Unsupported settings or an irreproducible history receive a clear error while the saved record remains available for inspection/export. Replay never falls back to a new live expedition. Session scenarios cover all ending conditions, baseline/TypeSafe/mixed histories, storms, instructions, recovery, cancellation/reset races, and matching outcomes at every playback speed. Browser checks cover save/import-to-replay, independent controls, unchanged JSON, rejection feedback, and TypeSafe/mixed replay with backend access blocked.

### Compare and tune expeditions

Select two saved expeditions and choose **Compare selected expeditions**. The comparison identifies matching or different scenarios, simulation settings, fixed objectives, and rubrics. Storm introduction times and effects remain visible even when never detected by the rover. Initial instructions, subsequent edits, and controller transitions appear beside the results; mixed-controller expeditions are labeled explicitly. Science score, discoveries, inspections, energy, cargo, and ending conditions are separate from inference usage and wall-clock latency. **Inspect expedition** opens the recorded timeline and its actual returned probabilities.

Comparison pauses an active expedition without changing records or making inference requests. Return to the live workspace and resume explicitly. On narrow screens, the comparison tables scroll horizontally and can be focused for keyboard scrolling.

The tuned `ochre-basin-v5` layout moves Sample C one cell to (17, 5). The original first-release survey delivered all three samples at 253.2 seconds, or 298.2 seconds when waiting on costly storm routes. Those measurements predate the current decision cadence and expanded world. Skipping recharge or crossing recklessly can strand the rover; a 50-second initial delay loses delivery credit. These are repeatable scripted checks, not claims about live TypeSafe quality. Run `bun scripts/playtest-tuning.ts` (or add `--sweep`) and see [the tuning report](docs/expedition-tuning.md) for parameters, measured costs, scenarios, and limitations. Existing records replay their original layouts. Browser checks cover matching/mismatching comparisons, mobile layout, mixed-controller histories, unchanged exports, and blocked-backend viewing.

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

The expedition reserves each local submission before sending its request, including retries and requests that fail before reaching TypeSafe. This conservative accounting prevents uncertain transport failures or cancellation from refunding usage. Each new live expedition defaults to 250 provider attempts and $0.10 estimated inference cost. A reached limit or unacknowledged unknown usage pauses further requests. Stop/reset and instruction changes abort obsolete operations; their attempts and settlement latency remain in the original expedition's event history. Reset gives the new expedition a fresh budget. Manual pause preserves an outstanding valid request but does not resume simulation when it returns.

### Jev usage and estimated inference cost

[Jev decision lab ticket 01](.scratch/jev-decision-lab/issues/01-show-actual-jev-usage-and-estimated-cost.md) adds usage accounting to the existing layout. Live telemetry, decision details, saved results, replay, and comparison distinguish controller decisions, local submissions, confirmed outbound provider attempts, and provider retries. The backend confirms an attempt only when the SDK invokes its outbound transport. Missing credentials and invalid input rejected before dispatch contribute zero provider attempts. The existing `inferenceAttempts` field retains its local-submission meaning. Version 1 through 3 records preserve the historical 100-submission guard during replay; live expeditions use the provider allowances below.

Each Jev decision records its expedition UUID and numeric decision identity. Each local submission has a separate attempt UUID, including a retry. The validated exchange returns those identities with the prompt version, requested alias, actual resolved model, input/output tokens, safe provider request ID, and available wall-time timing. Decision latency includes local transport and attempts; cumulative inference wait sums sequential Jev decisions. Attempt durations measure outbound work and are never added to that wait. A late response can arrive after its decision has already settled. Expedition time stays frozen during decisions.

Estimated inference cost is `(input tokens × input rate + output tokens × output rate) / 1,000,000`. The [official model reference](https://docs.typesafe.ai/models), checked on September 22, 2026, lists `jev-1.13.0` at USD $0.042 per million input tokens and $0 per million output tokens. Each response records these rates, their model, currency, capture time, verification date, and source. The `rover-action-v2` prompt selects bounded actions using the active preset or free-text mission preferences. Historical prompts retain their recorded version. `jev-latest` is only the requested alias; an absent resolved model stays unavailable. New model IDs require a separately verified pricing entry in `server/inference.ts`.

For example, 1,000 input tokens and 40 output tokens yield an estimated inference cost of $0.00004200 USD. Missing tokens or an unknown pricing basis leave the total incomplete, with a separately labeled known subtotal. An unconfirmed local submission does not establish zero provider access. These values are estimates, not verified provider charges. Ticket 03 adds configurable limits and uncertainty pauses, described below. Explicit failure recovery remains available when the usage guards are satisfied.

Current exports retain attempt evidence, execution status, revisions, and pricing. Validation checks identities, history, and totals, including accounting appended after an expedition ends. Inspection and replay use the saved prices without new inference or changes to the source record. Version 1 exports retain their original meaning and show the new metadata as unavailable. The legacy fixture in `tests/fixtures/legacy-usage-v1.json` was captured from commit `9713ae8` using its real session, backend, and SDK against a scripted provider. The version 2 fixture was captured the same way from ticket 01 commit `cb15524`. The version 3 fixture was captured from ticket 02 commit `227df55` through the same scripted integration and includes its original retry after unknown usage. All three legacy versions retain their original evidence and replay unchanged. Automated checks never call the paid service.

### Failure accounting and later evidence

[Jev decision lab ticket 02](.scratch/jev-decision-lab/issues/02-preserve-accounting-through-failures-and-cancellation.md) separates provider execution from choice validity. Inspect a decision to see whether each submission was rejected before dispatch, remains unconfirmed, is in flight, received a response, failed, was cancelled, or exceeded its deadline. Invalid or obsolete choices retain available model, tokens, safe request IDs, HTTP status, and attempt timing. Confirmed attempt counts are a lower bound when submissions remain unconfirmed. Missing usage or prices leave cost incomplete, with its known subtotal labeled as a lower bound.

Use **Refresh inference accounting** in **Saved expeditions** to check submissions made on the current page, including stopped expeditions after reset. The read-only `/api/decision/usage` lookup sends no new Jev requests and cannot execute an action. Repeated lookups use the original identities and evidence revisions without adding duplicate usage. Late evidence updates the original expedition and saves an accounting-only extension of its history. Reopen that entry to inspect the update; an already opened record or replay keeps its detached snapshot. Imports still reject conflicting identities, and playback never reads live accounting.

The backend retains evidence for its most recent 1,000 submissions in process memory. Duplicate delivery of an attempt in that window reuses its original response. Restarting the backend or evicting an entry leaves a lookup unresolved; refreshing the browser ends that page's reconciliation session. A provider connection that offers no further evidence remains unknown. A bounded observer can retain available metadata from an existing response after cancellation, but it never retries the provider to recover usage. Each refresh lookup has a five-second timeout independent of expedition time.

The failure scenarios cover provider failures with usage, retries, malformed choices and bodies, lost local responses, connection loss, cancellation, deadline expiry, stalled bodies, duplicate deliveries, late results after reset, and version 1/2/3/4 replay. Browser checks cover uncertainty labels, refresh without inference, durable updates, reload, and unchanged keyless replay exports.

### Mission modes and priorities

[Jev decision lab ticket 04](.scratch/jev-decision-lab/issues/04-choose-shared-priorities-or-free-text-instructions.md) adds **Mission mode** and the **Balanced**, **Conserve energy**, and **Explore more** presets. Free text remains the default. A preset replaces the written preferences supplied to the rover, and free-text mode replaces the preset. Inspect the numerical settings and their version in mission control or the decision timeline. See [mission priorities](docs/mission-priorities.md) for their units, adherence definitions, and limitations.

Edits record both their request time and their application at a safe action boundary. The interface distinguishes requested and effective preferences, superseded changes, and changes left unapplied when an expedition ends. The objective, rubric, and physical simulation remain fixed. Both controllers receive the same effective preferences and knowledge. The baseline interprets preset settings through versioned scientific and resource rules. Free-text experiments disclose that the baseline uses Balanced defaults and cannot interpret arbitrary instructions; they are not labeled matched-priority benchmarks.

Version 5 exports retain definitions, versions, and mission histories. Saved inspection, comparison, and replay display those preferences without new inference. Versions 1 through 4 keep their original free-text meaning and replay unchanged. A version 4 fixture captured from ticket 03 commit `c214d58` supplements the earlier legacy fixtures.

### Meaningful decision boundaries

[Jev decision lab ticket 06](.scratch/jev-decision-lab/issues/06-request-decisions-at-meaningful-boundaries.md) adds `meaningful-boundaries-v1`. Changes reaching one safe boundary share a decision and preserve all contributing triggers. Return-energy reserve, cargo delivery time, and full cargo capacity can request reconsideration without forcing the controller's action. Mission control can distinguish Jev choosing, code executing, and pauses in the existing action panel.

Version 7 exports preserve cadence and the exact trigger context supplied to the controller. Prompt provenance is `rover-action-v3`. Versions 1 through 6 retain their original trigger meanings and simulation behavior during inference-free replay. See [decision cadence](docs/decision-cadence.md) for the rules and deterministic provider-count evidence.

### Baseline scientific and resource rules

[Jev decision lab ticket 05](.scratch/jev-decision-lab/issues/05-make-the-baseline-use-scientific-evidence-and-priorities.md) introduces `evidence-priorities-v1`. The baseline inspects unknown properties, recognizes documented evidence phrases against the fixed objective, and applies shared preset weights to eligible science and exploration candidates. Known route energy, duration, remaining time, cargo, return reserves, recharge, and detected storms affect selection. The controller reads only its supplied input and candidates. It does not use authored classifications or sample IDs as a scientific answer key. See [the baseline strategy](docs/baseline-strategy.md) for formulas and measured behavior.

Expand a baseline decision to see its code rule, version, matched properties, planned return costs, utility, and excluded opportunities. These explain the code's selection; they are not a Jev reasoning transcript, scientific score, or prediction of success. Version 6 exports preserve the evidence in decisions and events. Baseline continuation remains explicit, with mixed-controller attribution. Versions 1 through 5 replay their original choices without inference or recomputation; their missing baseline metadata remains unavailable. The version 5 fixture was captured from ticket 04 commit `ce56480` before replacing the strategy.

### Inference limits and explicit continuation

[Jev decision lab ticket 03](.scratch/jev-decision-lab/issues/03-pause-at-usage-limits-or-unknown-cost.md) defaults each new live expedition to 250 provider attempts and $0.10 estimated inference cost. Set nonnegative limits before starting with **Apply inference limits**. Provider allowances must be whole numbers; zero prevents live inference. The selected allowances appear alongside current usage. Reset restores the defaults and clears consumed usage and acknowledgements for the new expedition.

Before every submission, including automatic and manual retries, the session counts confirmed provider attempts and reserves a possible slot for each unconfirmed submission. Confirmed pre-dispatch rejection releases that reservation. Explicitly acknowledging an unconfirmed submission allows its reservation to be released, while its unknown dispatch and missing cost remain visible. Later evidence can establish that the acknowledged submission did execute and increase the original expedition's confirmed count and estimate.

An **Inference usage pause** freezes expedition time, movement, battery use, and storm progression. It identifies unknown attempts, a reached provider allowance, or a reached estimated-cost threshold. Unknown usage takes precedence over an automatic retry. Raise a reached allowance and choose **Continue Jev inference**, acknowledge the listed uncertainty and continue, explicitly continue with baseline, or stop. All remaining guards still apply, and lowering an allowance during a pause is rejected. Acknowledgement applies only to the named attempts; newly unknown usage requires another acknowledgement. Baseline continuation finishes the current action to its next safe interruption point before choosing a baseline action. Action events retain the controller that originally selected them. Camera, stop, and reset remain available.

A response can cross the dollar threshold before its usage is known. The dollar allowance is an estimated-cost stopping rule, not a guaranteed billed-spending cap. Acknowledgement never turns missing usage into zero or removes it from the incomplete-estimate disclosure. Raising an allowance preserves consumed usage. The five-second total decision deadline, at most one automatic retry, one in-flight decision, and stale-action rejection remain unchanged.

Version 4 exports record starting allowances, every configured change, acknowledgements by attempt identity, pause causes, and controller transitions. Saved inspection shows this history. Late accounting updates its original expedition and the session rechecks guards before a subsequent request there. Saving, import/export, and replay retain the history without new inference; replay preserves version 1 through 3 rules. The scripted-provider scenarios cover the final retry slot, blocked dispatch, threshold crossing, reservations, acknowledgements, late evidence, and explicit baseline continuation.

Runtime contracts reject unexpected context fields and validate complete candidate identities, finite probabilities in [0, 1], and a complete distribution summing to one (0.01 rounding tolerance). TypeSafe sees only rover knowledge and resources, never authored sample classifications or undiscovered properties. Actual probabilities appear beside candidates and remain in events; they are not scientific value, a correctness guarantee, or reasoning. Uncertain valid choices proceed automatically.

The no-credential tests exercise the actual SDK against scripted external responses, including full expeditions, a shared retry deadline, stalled bodies, native Bun HTTP cancellation, stale results, invalid output, exhausted budgets, and credential/log isolation. Live scientific decision quality has not been evaluated with paid calls.

## References

- [TypeSafe concepts](https://docs.typesafe.ai/concepts/system-one)
- [TypeSafe JavaScript SDK](https://docs.typesafe.ai/sdk/javascript)
- [TypeSafe Choice primitive](https://docs.typesafe.ai/primitives/choice)
- [React Three Fiber](https://github.com/pmndrs/react-three-fiber)
- [Bun test runner](https://bun.sh/docs/test)
- [Bun lockfile](https://bun.sh/docs/pm/lockfile)
