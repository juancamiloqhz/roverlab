# RoverLab

A browser-based planetary rover sandbox for experimenting with autonomous decisions using TypeSafe AI.

Give a rover a mission, change its environment, and inspect how its choices affect exploration, energy use, and discoveries.

## Project status

Tickets [01](.scratch/first-playable-release/issues/01-watch-an-autonomous-expedition.md), [02](.scratch/first-playable-release/issues/02-discover-the-area-through-limited-perception.md), [03](.scratch/first-playable-release/issues/03-inspect-collect-and-deliver-scientific-samples.md), [04: Manage energy across multiple trips](.scratch/first-playable-release/issues/04-manage-energy-across-multiple-trips.md), and [05: Inspect decisions and update mission instructions](.scratch/first-playable-release/issues/05-inspect-decisions-and-update-mission-instructions.md) are implemented. Choose Investigate past water or Find unusual minerals, then watch a local 3D baseline expedition discover terrain, inspect samples, collect cargo, return it to base, and recharge for further trips. Orbit the camera and use pause/resume, reset, stop, and 1×/2×/4× playback. Battery and accumulated energy use are visible throughout. Results show discoveries, inspections, delivered science score, energy use, the ending condition, baseline attribution, and uncredited cargo. Edit mission instructions before or during the expedition and expand the decision timeline to inspect the exact knowledge, resources, complete candidates, and selected action at each decision. No API key is needed.

The remaining [first playable release tickets](.scratch/first-playable-release/issues/) add TypeSafe decisions, storms, observation aids, and saved records/replay.
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
bun test tests/decisions.test.ts # instruction edits, safe reconsideration, pending decisions, and stale results
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

`bun run check` runs typechecking, the production build, the full Bun suite, and the browser smoke checks. These start their own Vite server on port 4173. They verify the scene and labels, autonomous movement, an orbit-camera change while paused, every playback setting, reset, timeout, manual stop, visible discovery, remembered observations, objective selection, inspection, cargo, delivery scoring, battery use, recharge/pause behavior, instruction edits, baseline decision inspection, and camera/control responsiveness during scripted pending decisions with controlled browser time. Screenshots and failure traces go to ignored `test-results/`.

### Expedition boundary

`createExpedition()` in `src/simulation/expedition.ts` exposes `dispatch(command)`, `advanceWallTime(milliseconds)`, `getSnapshot()`, `getRecord()`, and `getDecisions()`. Decision history is read separately from frequently refreshed telemetry; `decisionRevision` changes only when that history changes. `onDecisionSettled()` lets the UI reset its wall-time anchor when an asynchronous request finishes, preventing pending time from being counted on the next timer callback. The UI and Bun scenarios use this same boundary. A browser timer supplies wall time independently of React Three Fiber frames; controls account for elapsed wall time before changing speed or status. Camera interaction only changes the presentation.

The session advances in 100 ms simulation steps, preserving partial steps across scheduler calls and pauses. Entering plain terrain takes four simulated seconds per cell; rough terrain takes eight. Routes minimize travel time through known traversable cells, with stable tie-breaking. The baseline waits five seconds after completing an exploration target, otherwise inspects and collects nearby reachable samples. It returns when its two cargo slots are full or it carries samples with no other reachable sample to pursue. With no sample work, it chooses the nearest frontier by estimated travel time (east, then north on ties), or waits when none remains. There is no direct piloting.

Inspection takes six seconds at the sample and reveals its authored properties; collection is a separate four-second interaction. Collection candidates require a reachable, available sample and a free cargo slot. Returning to base unloads cargo automatically. The fixed objective's rubric credits each delivered sample once: unrelated = 0, suggestive = 5, strong evidence = 10. Properties and classifications remain outside controller inputs before inspection; authored classifications stay private until delivery results. Select the objective before starting; reset begins a fresh expedition and unlocks selection. Battery starts at its 100-unit capacity. Entering a plain cell uses two energy units; rough terrain uses four, charged continuously by distance traveled. Route energy estimates use only known terrain. Waiting, inspection, and collection consume time without additional battery use. Recharge is offered only at base below capacity, restores five units per simulated second, and ends at full charge. Recharging never reduces accumulated energy use. The baseline skips top-ups above 90% and otherwise recharges; away from base, it chooses a return when battery falls to the known return-route cost plus a ten-unit reserve. This is controller strategy: positive battery still permits a route that may exhaust it. Movement stops at depletion; exhausting battery away from base ends with a stranded-rover result. Reaching base at exactly zero permits unloading and recharge.

The baseline follows the same collection strategy for both objectives; their delivery scores differ. Time spent inspecting, delivering, returning for energy, and recharging reduces exploration time, so an expedition may end with undiscovered sites or undelivered cargo. Cargo still aboard at timeout or manual stop earns no points.

Sensors accurately observe cell centers and objects within a three-cell Euclidean radius, including during travel, without occlusion. The snapshot separates current observations from timestamped rover memory. The scene renders only that memory: bright terrain is in range, dim terrain is remembered, and the dark surface is unknown. Sample labels and mission-control entries distinguish current from remembered observations and show last-seen times. Diamonds mark rough terrain. The authored sites are Sample A near base, Sample B beside the planned storm center at (15, 13), and distant Sample C at (17, 4); their properties are private world data.

Concrete exploration targets are known, reachable cells bordering unknown terrain. Neither candidates nor route estimates use undiscovered terrain or sample properties. The controller receives only current observations, memory, rover position, sensor range, previous action, and those candidates. `createExpedition({ scenario })` supplies alternate starting conditions for public-session scenarios; the browser uses the authored scenario. Rendering reads snapshots and never imports the world catalog.

Snapshots and records are detached copies. `getRecord()` captures full starting conditions separately from controller inputs, plus timestamped first discoveries, objective selections, inspections, collections, deliveries, movement/recharge resource changes, exact decision inputs/selections, and ordered lifecycle/action events with baseline attribution. Memory stores the last observation time, refreshed only while an object or cell is sensed, plus inspection time and the rover's known cargo/delivery status. Collected samples disappear from the scene but remain in discovery history. Reset preserves the session history and selected objective, increments the event's expedition number, restarts simulated time at zero, restores full battery, clears accumulated energy use, cargo, and science results, and restores only the initial sensor observations. Mission instructions persist across reset; their version restarts at zero and the reset event captures their text. Persistence, import/export, and replay are later tickets.

### Decision inspection and mission instructions

Apply instruction edits to record them and update controller context without changing the scientific objective or rubric. The baseline receives the text and reconsiders with its existing fixed rules; it does not interpret free-form preferences. The timeline states this explicitly and shows no invented model probabilities or reasoning. Each expandable entry contains its trigger, controller, instruction version and text, selected candidate identity, all complete action-and-target candidates and route estimates, resource state, sensor range, previous completed action, observations, and timestamped memory. Historical entries never acquire knowledge from later sensing or inspections.

Action completion, newly discovered terrain or objects, and changed instructions prompt decisions. Travel stops for reconsideration at the next grid waypoint; inspection, collection, and bounded waiting already underway finish first. Recharge can be interrupted while stationary. Refreshing last-seen timestamps during routine movement does not request another decision. This means the authored rover now pursues Sample A at its first discovery instead of finishing its initial exploration target first.

The coordinator admits at most one controller request at a time. Pending decisions freeze expedition time, movement, energy, and perception. Camera, pause, stop, reset, speed, and instruction controls remain responsive. Edits and lifecycle changes discard obsolete results; a replacement request waits for the outstanding request to settle. Returned identities must match an originally offered candidate that still satisfies current preconditions, and execution uses the simulator's copy. Invalid selections pause without automatic controller substitution. The baseline resolves synchronously; scripted delayed controllers exist only in verification. Live inference, cancellation/deadlines/retries, and recovery controls belong to tickets 06–07. Request latency is recorded separately from simulated time.

## Design principles

- Code owns movement, pathfinding, resource accounting, action validity, and execution.
- TypeSafe selects bounded actions using observations, memory, mission instructions, and available options.
- The rover sees only what its sensors have discovered; observations carry timestamps.
- Rendering is separate from simulation and decision making.
- Record actual decisions and actions for faithful replay.
- Keep API credentials on the server.

See [the build plan](docs/build-plan.md) for the accepted decisions, starting defaults, milestones, and validation; [the domain glossary](CONTEXT.md) defines the project vocabulary.

## TypeSafe access

Live AI decisions will require a TypeSafe API key. The first simulation milestone uses a rule-based controller and can be developed without that key. The environment example is a placeholder for the planned backend; configuration loading will be implemented with it.

Ticket 06 must verify the official SDK under the selected Bun version, including cancellation, deadlines, and retries. The [SDK quickstart](https://docs.typesafe.ai/sdk/javascript) currently documents Node.js 20 or newer; Bun compatibility has not yet been tested for RoverLab.

## References

- [TypeSafe concepts](https://docs.typesafe.ai/concepts/system-one)
- [TypeSafe JavaScript SDK](https://docs.typesafe.ai/sdk/javascript)
- [TypeSafe Choice primitive](https://docs.typesafe.ai/primitives/choice)
- [React Three Fiber](https://github.com/pmndrs/react-three-fiber)
- [Bun test runner](https://bun.sh/docs/test)
- [Bun lockfile](https://bun.sh/docs/pm/lockfile)
