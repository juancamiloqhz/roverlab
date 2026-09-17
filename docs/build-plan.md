# RoverLab build plan

## Goal

Build an interactive 3D planetary rover simulation where a user can change the mission and environment, observe autonomous behavior, and compare decision strategies.

## Milestone 1: A working simulation

Create a React and TypeScript browser application with a small 3D terrain, geometric rover, charging base, and three sample sites. Implement fixed-step simulation, grid pathfinding, battery consumption, cargo capacity, scanning, collection, delivery, and charging.

Provide play/pause, reset, speed controls, an orbit camera, and a basic rover status panel. Use a simple rule-based controller to exercise the complete loop.

Completion: the rover can leave base, discover and collect a sample, deliver it, and recharge. Pausing stops simulation time. Reset restores the initial scenario.

## Milestone 2: TypeSafe decisions

Add a Node.js backend using `@typesafe-ai/sdk` and a server-only `TYPESAFE_API_KEY`. Send compact structured observations, timestamped memory, mission instructions, resource state, and currently available actions.

Represent each action and target as one candidate, for example `inspect_crater_3`, `collect_sample_7`, `explore_sector_east`, `return_to_base`, or `wait`. Select a candidate with a Choice question.

Generate candidates and estimate route costs from the rover's known map. Keep unrevealed objects and hidden world properties out of observations. Treat remaining unknowns as uncertainty rather than silently providing the rover with privileged knowledge.

Request a decision on action completion, a significant new observation, a changed mission, or a material environmental event. Keep requests bounded and prevent overlapping decisions. Associate each request with its scenario and mission versions, then recheck relevant preconditions before applying its result. Ordinary simulation ticks must not invalidate every in-flight response.

Keep the current task until completion or an explicit interruption condition so that the rover does not oscillate between tasks. Bound retries and request age. Provide a visible fallback state when live inference fails; never label baseline actions as TypeSafe decisions.

Completion: the rover completes a mission using live TypeSafe choices, and the inspector shows the actual inputs, action options, returned distribution, chosen action, latency, and usage. Credential values never reach browser code or logs.

## Milestone 3: An interactive experiment

Add a changing hazard and controls for injecting events such as a blocked route or a new signal. Add rover-follow camera, sensor coverage, and discovered-map views. Keep user-visible world knowledge distinct from the rover's knowledge.

Compare different mission instructions from the same scenario, such as collecting nearby samples versus prioritizing unusual geological discoveries. Retain the baseline controller for comparison.

Record the scenario seed, user events, decisions, and executed actions. Replay recorded actions for reproducibility; a fresh live AI run is a separate experiment and may return different decisions.

Completion: a user can run, alter, replay, and compare scenarios with results for discoveries delivered, energy use, completion, stranded runs, request count, and latency.

## Proposed boundaries

- `src/simulation/`: world state, observations, navigation, action lifecycle, resource accounting, and event recording. Independent of React and the network.
- `src/scene/`: terrain, rover, objects, lighting, cameras, and visual effects.
- `src/ui/`: mission controls, simulation controls, status, and decision inspector.
- `src/controllers/`: the baseline controller and browser connection to the decision backend.
- `server/`: TypeSafe client, question construction, request validation, and bounded request handling.
- `shared/`: contracts used by the browser and backend.

Create these directories when their first implementation is added.

## Validation priorities

Test meaningful simulation behavior: resource bounds, blocked routes, sensor visibility, pause/reset, and action completion. Test async integration behavior: stale decisions after reset or mission changes, invalid targets, timeouts, and fallback labeling. Verify recorded action replay against the same starting scenario.

Evaluate AI behavior on a small set of representative scenarios. Typed output is an interface guarantee, not proof that a decision is correct. Judge success by mission outcomes and compare with the baseline.

## First implementation task

Scaffold the application and complete the leave-base, discover, collect, deliver, and recharge loop in one small 3D scene.
