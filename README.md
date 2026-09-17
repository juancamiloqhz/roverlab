# RoverLab

A browser-based planetary rover sandbox for experimenting with autonomous decisions using TypeSafe AI.

Give a rover a mission, change its environment, and inspect how its choices affect exploration, energy use, and discoveries.

## Project status

[Ticket 01: Watch an autonomous expedition](.scratch/first-playable-release/issues/01-watch-an-autonomous-expedition.md) is implemented. Start a local 3D baseline expedition, watch autonomous grid navigation and bounded waits, orbit the camera, and use pause/resume, reset, stop, and 1×/2×/4× playback. A five-minute timeout or manual stop displays the ending condition. No API key is needed.

The remaining [first playable release tickets](.scratch/first-playable-release/issues/) add limited perception, samples, energy, scientific objectives, TypeSafe decisions, storms, and saved records/replay. The current scene shows the authored area; limited perception belongs to ticket 02.
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

`bun run check` runs typechecking, the production build, the full Bun suite, and the browser smoke check. The smoke check starts its own Vite server on port 4173. It verifies the scene and labels, autonomous movement, an orbit-camera change while paused, every playback setting, reset, timeout, and manual stop with controlled browser time. Screenshots and failure traces go to ignored `test-results/`.

### Expedition boundary

`createExpedition()` in `src/simulation/expedition.ts` exposes `dispatch(command)`, `advanceWallTime(milliseconds)`, `getSnapshot()`, and `getRecord()`. The UI and Bun scenarios use this same boundary. A browser timer supplies wall time independently of React Three Fiber frames; controls account for elapsed wall time before changing speed or status. Camera interaction only changes the presentation.

The session advances in 100 ms simulation steps, preserving partial steps across scheduler calls and pauses. Travel takes four simulated seconds per grid cell. The baseline chooses from supplied reachable exploration targets in authored order, waits five seconds after each target, then repeats bounded waits after reaching all targets. Grid paths avoid the authored obstacles with stable tie-breaking. There is no direct piloting.

Snapshots and records are detached copies. `getRecord()` captures starting conditions and ordered lifecycle/action events with simulation timestamps and baseline attribution. Reset preserves the session history, increments the event's expedition number, and restarts simulated time at zero. Persistence, import/export, and replay are later tickets.

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
