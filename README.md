# RoverLab

A browser-based planetary rover sandbox for experimenting with autonomous decisions using TypeSafe AI.

Give a rover a mission, change its environment, and inspect how its choices affect exploration, energy use, and discoveries.

## Project status

Tickets [01](.scratch/first-playable-release/issues/01-watch-an-autonomous-expedition.md), [02](.scratch/first-playable-release/issues/02-discover-the-area-through-limited-perception.md), [03](.scratch/first-playable-release/issues/03-inspect-collect-and-deliver-scientific-samples.md), [04: Manage energy across multiple trips](.scratch/first-playable-release/issues/04-manage-energy-across-multiple-trips.md), and [05: Inspect decisions and update mission instructions](.scratch/first-playable-release/issues/05-inspect-decisions-and-update-mission-instructions.md) are implemented. Choose Investigate past water or Find unusual minerals, then watch a local 3D baseline expedition discover terrain, inspect samples, collect cargo, return it to base, and recharge for further trips. Orbit the camera and use pause/resume, reset, stop, and 1×/2×/4× playback. Battery and accumulated energy use are visible throughout. Results show discoveries, inspections, delivered science score, energy use, the ending condition, baseline attribution, and uncredited cargo. Edit mission instructions before or during the expedition and expand the decision timeline to inspect the exact knowledge, resources, complete candidates, and selected action at each decision. No API key is needed.

[Ticket 06](.scratch/first-playable-release/issues/06-run-a-typesafe-controlled-expedition.md) adds a selectable TypeSafe controller, a local Bun backend, returned Choice probabilities, bounded inference, and attempt/latency accounting. [Ticket 07](.scratch/first-playable-release/issues/07-recover-explicitly-from-inference-failures.md) adds explicit Retry and baseline continuation after inference failure, with controller transitions in the timeline and results. The baseline remains the default and requires no key or backend. [Ticket 08](.scratch/first-playable-release/issues/08-respond-to-a-localized-dust-storm.md) adds a discoverable dust storm, reduced sensing, increased movement costs, and selectable known detours. The remaining [first playable release tickets](.scratch/first-playable-release/issues/) add observation aids and saved records/replay.
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
bun test tests/science.test.ts    # inspection, cargo, fixed objectives, and delivery scoring
bun test tests/energy.test.ts     # terrain costs, multiple trips, recharge, depletion, and interaction timeout
bun test tests/storm.test.ts    # disclosure, sensing, crossing/detours, expiry, safe reconsideration, and frozen time
bun test tests/decisions.test.ts # instruction edits, safe reconsideration, pending decisions, and stale results
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

`bun run check` runs typechecking, the production build, the full Bun suite, and the browser smoke checks. These start their own Vite server on port 4173 and a scripted-service backend on port 4174. They verify the scene and labels, autonomous movement, an orbit-camera change while paused, every playback setting, reset, timeout, manual stop, visible discovery, remembered observations, objective selection, inspection, cargo, delivery scoring, battery use, recharge/pause behavior, instruction edits, decision inspection, TypeSafe selection/probabilities/failure status, storm introduction/discovery/expiry, and camera/control responsiveness during pending decisions. Verification never loads a real key or calls the paid service. Screenshots and failure traces go to ignored `test-results/`.

### Expedition boundary

`createExpedition()` in `src/simulation/expedition.ts` exposes `dispatch(command)`, `advanceWallTime(milliseconds)`, `getSnapshot()`, `getRecord()`, and `getDecisions()`. Decision history is read separately from frequently refreshed telemetry; `decisionRevision` changes only when that history changes. `onDecisionSettled()` lets the UI reset its wall-time anchor when an asynchronous request finishes, preventing pending time from being counted on the next timer callback. The UI and Bun scenarios use this same boundary. A browser timer supplies wall time independently of React Three Fiber frames; controls account for elapsed wall time before changing speed or status. Camera interaction only changes the presentation.

The session advances in 100 ms simulation steps, preserving partial steps across scheduler calls and pauses. Entering plain terrain takes four simulated seconds per cell; rough terrain takes eight. Routes minimize travel time through known traversable cells, with stable tie-breaking. The baseline waits five seconds after completing an exploration target, otherwise inspects and collects nearby reachable samples. It returns when its two cargo slots are full or it carries samples with no other reachable sample to pursue. With no sample work, it chooses the nearest frontier by estimated travel time (east, then north on ties), or waits when none remains. There is no direct piloting.

Inspection takes six seconds at the sample and reveals its authored properties; collection is a separate four-second interaction. Collection candidates require a reachable, available sample and a free cargo slot. Returning to base unloads cargo automatically. The fixed objective's rubric credits each delivered sample once: unrelated = 0, suggestive = 5, strong evidence = 10. Properties and classifications remain outside controller inputs before inspection; authored classifications stay private until delivery results. Select the objective before starting; reset begins a fresh expedition and unlocks selection. Battery starts at its 100-unit capacity. Entering a plain cell uses two energy units; rough terrain uses four, charged continuously by distance traveled. Route energy estimates use only known terrain. Waiting, inspection, and collection consume time without additional battery use. Recharge is offered only at base below capacity, restores five units per simulated second, and ends at full charge. Recharging never reduces accumulated energy use. The baseline skips top-ups above 90% and otherwise recharges; away from base, it chooses a return when battery falls to the known return-route cost plus a ten-unit reserve. This is controller strategy: positive battery still permits a route that may exhaust it. Movement stops at depletion; exhausting battery away from base ends with a stranded-rover result. Reaching base at exactly zero permits unloading and recharge.

The baseline follows the same collection strategy for both objectives; their delivery scores differ. Time spent inspecting, delivering, returning for energy, and recharging reduces exploration time, so an expedition may end with undiscovered sites or undelivered cargo. Cargo still aboard at timeout or manual stop earns no points.

Sensors accurately observe cell centers and objects within a three-cell Euclidean radius, including during travel, without occlusion. The snapshot separates current observations from timestamped rover memory. The scene renders only that memory: bright terrain is in range, dim terrain is remembered, and the dark surface is unknown. Sample labels and mission-control entries distinguish current from remembered observations and show last-seen times. Diamonds mark rough terrain. The authored sites are Sample A near base, Sample B at the storm center at (15, 13), and distant Sample C at (17, 4); their properties are private world data.

Concrete exploration targets are known, reachable cells bordering unknown terrain. Neither candidates nor route estimates use undiscovered terrain or sample properties. The controller receives only current observations, memory, rover position, sensor range, previous action, and those candidates. `createExpedition({ scenario })` supplies alternate starting conditions for public-session scenarios; the browser uses the authored scenario. Rendering reads snapshots and never imports the world catalog.

Snapshots and records are detached copies. `getRecord()` captures full starting conditions separately from controller inputs, plus timestamped first discoveries, objective selections, inspections, collections, deliveries, movement/recharge resource changes, exact decision inputs/selections, and ordered lifecycle/action events with baseline attribution. Memory stores the last observation time, refreshed only while an object or cell is sensed, plus inspection time and the rover's known cargo/delivery status. Collected samples disappear from the scene but remain in discovery history. Reset preserves the session history and selected objective, increments the event's expedition number, restarts simulated time at zero, restores full battery, clears accumulated energy use, cargo, and science results, and restores only the initial sensor observations. Mission instructions persist across reset; their version restarts at zero and the reset event captures their text. Persistence, import/export, and replay are later tickets.

### Decision inspection and mission instructions

Apply instruction edits to record them and update controller context without changing the scientific objective or rubric. The baseline receives the text and reconsiders with its existing fixed rules; it does not interpret free-form preferences. The timeline states this explicitly and shows no invented model probabilities or reasoning. Each expandable entry contains its trigger, controller, instruction version and text, selected candidate identity, all complete action-and-target candidates and route estimates, resource state, sensor range, previous completed action, observations, and timestamped memory. Historical entries never acquire knowledge from later sensing or inspections.

Action completion, newly discovered terrain or objects, detected or expired known storms, and changed instructions prompt decisions. Travel stops for reconsideration at the next grid waypoint; inspection, collection, and bounded waiting already underway finish first. Recharge can be interrupted while stationary. Refreshing last-seen timestamps during routine movement does not request another decision. This means the authored rover now pursues Sample A at its first discovery instead of finishing its initial exploration target first.

The coordinator admits at most one controller decision at a time. Pending decisions freeze expedition time, movement, energy, and perception. Camera, pause, stop, reset, speed, and instruction controls remain responsive. Edits and lifecycle changes discard obsolete results and cancel TypeSafe requests; replacements wait for the cancelled operation to settle. Returned identities must match an originally offered candidate that still satisfies current preconditions, and execution uses the simulator's copy. Invalid selections pause without automatic controller substitution. The baseline resolves synchronously. TypeSafe failures pause and offer Retry or Continue with the baseline controller; stop/reset remain available. Request latency is recorded separately from simulated time.

Retry starts a new five-second decision operation using current instructions and rover knowledge, with at most one automatic retry. Every attempt counts toward the same expedition's 100-attempt budget; the recovery button is disabled when it is exhausted. Continuing with baseline requires an explicit choice and resumes the same expedition, retaining its objective, elapsed time, cargo, battery, energy use, and earned science. The timeline records the transition before the first baseline decision, each decision names its responsible controller, and results list both controllers in order. Late responses from abandoned operations cannot execute. Reset starts a fresh budget and controller history.

### Localized dust storm

Use **Introduce dust storm** once per expedition, before starting or while running or paused. Reset restores the control. The authored storm lasts 45 expedition seconds, centered at (15, 13) with a 4.5-cell radius. Inside it, sensor range drops from three to 1.5 cells and movement energy triples; travel speed stays unchanged. To see the baseline encounter it, introduce it around 01:30 elapsed (03:30 remaining), as the rover approaches the eastern area. No key is needed.

Until the sensor footprint intersects the storm, its region, duration, effects, and route costs remain absent from rover knowledge and the scene. Introduction is acknowledged to mission control without revealing those details. Detection discloses the circle, exact expiration time, remaining time, and effects, then prompts reconsideration at the next safe waypoint. Existing inspections, collection, and bounded waits finish first. A newly detected storm invalidates an outstanding decision without overlapping requests. Hidden introduction does not invalidate an otherwise valid choice.

Normal routes still minimize travel time through known terrain. Where an active known storm would affect travel, the same exploration, inspection, collection, or return target can also offer an `avoid-storm` route through known cells, when one exists. Each route has its own candidate identity, estimated travel duration, distance, energy, and distance inside the active storm. Estimates assume immediate departure and account for the known expiration time; actual energy is charged only for distance traveled inside the region while active, including partial grid edges and rough terrain. Waiting consumes time without movement energy. Strategic crossings remain available even when they could strand the rover.

The baseline retains its existing priorities, preferring an offered detour for the chosen target when it saves energy and fits the remaining time. Otherwise it waits in five-second intervals if a costly crossing faces a storm with at most ten seconds left and there is time to wait and travel. This fixed rule is a demonstration strategy, not a guarantee of a successful expedition.

The scene shows the detected region with dust and a boundary ring, dimmed when remembered. The environment panel and decision timeline expose only rover knowledge. Out-of-range storm memory keeps its last-seen timestamp while its disclosed remaining time counts down to zero. Expiration removes the active observation and visual effect and restores ordinary sensing and energy rates. Manual pause and pending decisions freeze progression and dust animation while camera and controls remain responsive. Records retain the configured starting conditions, introduction, detection, expiration, effect transitions, and movement energy events separately from controller inputs. Saving and replay remain later tickets.

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

The expedition reserves each attempt before submitting its local inference request, including retries and requests that fail before reaching TypeSafe. This conservative accounting prevents uncertain transport failures or cancellation from refunding usage. At 100 attempts, further inference pauses before sending a request. Stop/reset and instruction changes abort obsolete operations; their attempts and settlement latency remain in the original expedition's event history. Reset gives the new expedition a fresh budget. Manual pause preserves an outstanding valid request but does not resume simulation when it returns.

Runtime contracts reject unexpected context fields and validate complete candidate identities, finite probabilities in [0, 1], and a complete distribution summing to one (0.01 rounding tolerance). TypeSafe sees only rover knowledge and resources, never authored sample classifications or undiscovered properties. Actual probabilities appear beside candidates and remain in events; they are not scientific value, a correctness guarantee, or reasoning. Uncertain valid choices proceed automatically.

The no-credential tests exercise the actual SDK against scripted external responses, including full expeditions, a shared retry deadline, stalled bodies, native Bun HTTP cancellation, stale results, invalid output, exhausted budgets, and credential/log isolation. Live scientific decision quality has not been evaluated with paid calls.

## References

- [TypeSafe concepts](https://docs.typesafe.ai/concepts/system-one)
- [TypeSafe JavaScript SDK](https://docs.typesafe.ai/sdk/javascript)
- [TypeSafe Choice primitive](https://docs.typesafe.ai/primitives/choice)
- [React Three Fiber](https://github.com/pmndrs/react-three-fiber)
- [Bun test runner](https://bun.sh/docs/test)
- [Bun lockfile](https://bun.sh/docs/pm/lockfile)
