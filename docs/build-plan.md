# RoverLab build plan

## Goal and status

Build a local browser-based 3D planetary exploration sandbox for observing and comparing an autonomous rover's decisions. Mission control supplies priorities and changes environmental conditions; the rover chooses its actions.

The design decisions below were accepted during the design interview, and the consolidated design was confirmed on 2026-09-16. The [first playable release specification](../.scratch/first-playable-release/spec.md) is published in the local issue tracker with status `ready-for-agent` and the agreed testing approach. The 12 approved [implementation tickets](../.scratch/first-playable-release/issues/) are published with their blocking dependencies. The first unblocked step is [ticket 01: Watch an autonomous expedition](../.scratch/first-playable-release/issues/01-watch-an-autonomous-expedition.md). Application implementation has not started.

## Experience

- One deliberately designed planetary area with a base and three sample sites: an accessible sample, a distant discovery, and a tempting location near a hazard. Starting conditions are repeatable.
- Convincing 3D movement with simplified physics. Terrain and obstacles affect routes and energy use; wheel and suspension animation provide visual feedback. Mechanical simulation of traction, wheel slip, and tipping is outside this release.
- The main view reveals the area as the rover discovers it. An optional full-world debugging view exposes hidden state without changing rover knowledge.
- Mission control can pause, reset, change playback speed, edit mission instructions, and trigger the first environmental hazard. The rover remains autonomous.
- Orbit and rover-follow cameras, rover status, sensor coverage, a decision timeline, and expedition results support observation and experimentation.

## Starting defaults

| Parameter | Initial value |
| --- | --- |
| Expedition duration | Five simulated minutes |
| Sample sites | Three |
| Cargo capacity | Two samples |
| Playback speeds | 1x, 2x, 4x |
| Decision deadline | Five seconds of wall-clock time, including retries |
| Automatic retry allowance | At most one retry within that same deadline |
| Inference budget | 100 total attempts per expedition, including retries |

Travel, inspection, collection, waiting, and recharging consume expedition time. Distances, action durations, and energy rates are tuning parameters to measure during playtesting; collecting all samples should require good decisions. Request limits are adjustable starting defaults rather than provider guarantees.

## Missions and scoring

A mission combines a selected scientific objective with editable mission instructions. The objective and its scoring rubric stay fixed throughout an expedition; mission instructions may change while it runs. A new objective starts a new expedition.

Initial objectives:

- **Investigate past water.** Favor geological samples whose properties provide evidence relevant to past water.
- **Find unusual minerals.** Favor samples whose properties provide evidence relevant to unusual mineral formations.

Each objective has predefined sample classifications: unrelated earns 0, suggestive earns 5, and strong evidence earns 10. The sample catalog's predefined properties determine these classifications. TypeSafe evaluates the observed descriptions and chooses actions; the simulator computes the science score independently from the fixed rubric.

Only samples delivered to base earn science score. Discoveries and inspections are reported separately. Samples still aboard when an expedition ends do not earn delivery credit. Returning to base unloads cargo automatically; charging is a separate action.

## Expedition lifecycle

An expedition may include several trips to base, deliveries, and recharging. It ends when its time budget expires, the rover becomes stranded, or mission control stops it. Results retain the science score, discoveries, inspections, energy use, ending condition, controller history, and inference usage and latency.

Poor strategy may strand the rover by exhausting its battery away from base. Code enforces physical constraints without guaranteeing strategic success. A spread-out Choice distribution alone does not require human intervention: the rover proceeds with the selected valid action and exposes the returned uncertainty.

Reset restores the initial scenario. Repeatability means replaying recorded decisions and events against that starting scenario; a fresh live AI expedition is a separate experiment and may make different choices.

## Perception and memory

Sensors provide accurate observations within their range. Nearby terrain and objects are detected reliably; inspection reveals sample properties. Memory retains observations with their times, and observed conditions may subsequently change.

The rover receives only its observations and memory. Hidden sample properties and undiscovered objects remain outside its decision input. Candidate generation and route estimates use the rover's known map. Full-world rendering and experiment recording must preserve this information boundary.

## Dust storm

The first hazard is a localized dust storm that mission control can trigger. It reduces sensor range and increases movement energy consumption within its region. Its duration is fixed. Once the rover detects it, the affected region and remaining duration become known.

The resulting choices have distinct costs: waiting consumes expedition time, crossing consumes extra energy, and detouring adds distance. Storm progression follows expedition time, including pauses.

## Rover actions

The controller chooses one of six kinds of bounded task with a concrete target where needed:

1. **Explore:** move toward a supplied unexplored-area target.
2. **Inspect:** travel to and examine a discovered sample.
3. **Collect:** travel to and pick up a sample when capacity and physical conditions permit.
4. **Return to base:** travel to base and unload cargo automatically.
5. **Recharge:** replenish the battery at base while consuming expedition time.
6. **Wait:** allow expedition time to advance for a bounded interval.

Code owns target construction, navigation, movement, resource accounting, action preconditions, and execution. It presents complete action-and-target candidates to TypeSafe, such as `inspect_sample_3`, `collect_sample_2`, `explore_sector_east`, or `return_to_base`.

Request decisions on action completion or meaningful changes such as a new observation, changed mission instructions, or a detected storm. Routine movement alone does not request inference. Travel can stop at the next safe waypoint before reconsideration; short interactions can finish before the next decision. Keep tasks stable between these boundaries to prevent oscillation.

## Decision execution and failure handling

Use a local Bun backend and the official TypeSafe JavaScript SDK. Verify the SDK under the selected Bun version when implementing the integration, including cancellation, deadlines, and retries. Credentials remain on the backend. Send the objective, mission instructions, observations, timestamped memory, resource state, and available actions; obtain a typed Choice and its returned probabilities.

Keep one decision in flight. Bound the complete request-and-retry operation by five seconds, with at most one automatic retry inside that deadline. Every inference attempt counts toward the expedition's 100-attempt limit, including retries. Reaching the limit pauses the expedition rather than continuing to send requests.

While awaiting a decision, pause expedition time and modeled evolution: movement, resource consumption, and storm progression. Keep the camera and interface responsive. Record inference latency separately. See [ADR-0001](adr/0001-pause-expedition-time-during-decisions.md).

Associate requests with the expedition and mission-instruction versions, and recheck relevant preconditions before applying a returned action. Reset, changed instructions, or a relevant state change can invalidate an in-flight result. Routine render updates must not invalidate every request.

After inference failure, keep the expedition paused and offer Retry or Continue with the baseline controller. Baseline continuation requires an explicit user choice. Record the controller responsible for each decision and clearly identify controller changes in results. Low confidence on an otherwise valid Choice is displayed and does not by itself suspend autonomy.

## Decision inspection and expedition records

Show a chronological decision timeline containing the observations used, available actions, actual returned probabilities, and selected action. Show returned uncertainty, request usage, and latency as their own measurements.

Save completed expeditions locally in the browser. Provide JSON export and import plus replay of the recorded decisions and events. An expedition record includes the starting scenario, objective and rubric, mission-instruction changes, environmental events, decisions, executed actions, controller history, and results needed to reproduce and inspect the expedition. Credentials are excluded from records and logs.

## Delivery and architecture

The first release runs locally. The public GitHub repository distributes the source; interactive hosting is a later decision.

Planned stack: React, TypeScript, and Vite for the application; Three.js through React Three Fiber for rendering; a framework-independent TypeScript simulation with fixed time steps and grid pathfinding; a small Bun decision backend.

Use Bun for dependency management, package scripts, and automated expedition tests, with separate TypeScript typechecking and real-browser checks. Ticket 01 establishes the tested Bun version and committed dependency lockfile. See [tooling conventions](../README.md#tooling).

Proposed module boundaries:

- `src/simulation/`: state, observations, navigation, action lifecycle, resource accounting, scoring, and event recording. Independent of React and network calls.
- `src/scene/`: terrain, rover, objects, lights, cameras, and visual effects.
- `src/ui/`: mission and expedition controls, status, results, and decision timeline.
- `src/controllers/`: baseline strategy and browser connection to the decision backend.
- `server/`: TypeSafe client, question construction, validation, and bounded request handling.
- `shared/`: browser/backend contracts.

Create these directories when their first implementations are added. Consult [the domain glossary](../CONTEXT.md) for the project's vocabulary.

## Build sequence

### Milestone 1: A working simulation

Build the small 3D area and complete the explore, inspect, collect, return, unload, and recharge loop with the baseline controller. Include limited perception, the two scientific objectives, delivery scoring, expedition end states, pause/reset/speed controls, and basic results.

Completion: a rover can make several trips, deliver samples, recharge, and finish an expedition with correct results. Strategic failure remains possible. Reset reproduces the initial scenario.

### Milestone 2: TypeSafe decisions

Add the local decision backend, typed candidate selection, live mission-instruction updates, request limits, safe interruption, stale-response handling, decision-time pauses, explicit failure recovery, and the decision timeline.

Completion: TypeSafe drives complete expeditions using only rover knowledge. Returned decisions are inspectable, and request errors or delay cannot silently change controllers, consume expedition time, or apply obsolete actions.

### Milestone 3: An interactive experiment

Add the storm interaction, rover-follow camera, sensor overlay, local expedition storage, export/import, and recorded replay. Compare different instructions or controllers under the same starting conditions and fixed objective.

Completion: a user can run, intervene, inspect, save, replay, and compare expeditions. Numerical tuning is evaluated against representative scenarios rather than inferred from model confidence.

## Validation priorities

- Resource bounds, cargo capacity, blocked routes, action completion, delivery scoring, pause/reset, and all expedition end conditions.
- Accurate observations within range, inspection-only disclosure of sample properties, stale memory, and isolation of full-world knowledge from rover inputs.
- Storm detection, revealed extent and duration, energy and sensor effects, and frozen storm progression during decision pauses.
- The same simulated outcomes for the same actions regardless of inference delay or playback speed.
- Safe waypoint interruption, stale decisions after reset or changed instructions, invalid targets, total deadlines, retry counting, and exhaustion of the inference budget.
- Autonomous continuation for a valid uncertain Choice; explicit baseline continuation after a failure; truthful controller labels.
- Local record export/import and faithful replay without new AI decisions.

Evaluate representative mission outcomes against the baseline controller. Typed output guarantees an interface, not the correctness or usefulness of a decision.
