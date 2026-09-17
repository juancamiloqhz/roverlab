# RoverLab: First playable release

Status: ready-for-agent

## Problem Statement

As mission control, I want to explore how an autonomous planetary rover makes decisions when scientific priorities, limited knowledge, battery capacity, cargo, time, and environmental hazards compete. I want a fun, visible experiment in which I can change instructions or introduce a hazard, watch the consequences, and understand what information informed each choice.

The repository currently contains the agreed design, domain glossary, engineering workflow, and an architecture decision about pausing expedition time during inference. It has no application code, dependencies, or tests. The first release needs to turn those decisions into a complete local experience whose simulated outcomes can be inspected and reproduced.

## Solution

Build a local browser application with a small 3D planetary area, one autonomous rover, a charging base, three sample sites, and a localized dust storm. Mission control selects a scientific objective, supplies editable mission instructions, and observes a five-minute expedition with two cargo slots. The rover explores, inspects samples, collects them, delivers them to base, recharges, and waits.

The baseline controller provides an initial working expedition and a comparison strategy. TypeSafe subsequently selects bounded actions from candidates constructed by code using only rover knowledge. Code owns the simulated world, navigation, action validity, resource accounting, and scoring. Strategic mistakes remain possible.

Mission control can inspect decisions, pause or reset, change playback speed, stop an expedition, introduce the storm, save results locally, and export, import, and replay expedition records. The first release runs locally; the public repository distributes its source.

## User Stories

1. As mission control, I want to run RoverLab locally in my browser, so that I can experiment on my own machine.
2. As mission control, I want to run an expedition with the baseline controller without a TypeSafe API key, so that I can use the simulation before configuring live inference.
3. As mission control, I want a convincing 3D planetary area with a visible rover, base, terrain, obstacles, and sample sites, so that decisions have an understandable spatial context.
4. As mission control, I want an orbit camera, so that I can inspect the environment from different viewpoints.
5. As mission control, I want a rover-follow camera, so that I can watch the expedition from the rover's vicinity.
6. As mission control, I want the main view to reveal the area as the rover discovers it, so that I can understand its choices from its available knowledge.
7. As mission control, I want a clearly identified full-world view for debugging, so that I can inspect hidden conditions without changing rover knowledge.
8. As mission control, I want to see sensor coverage, so that I can understand what the rover can currently observe.
9. As mission control, I want repeatable starting conditions, so that I can compare different instructions or controllers.
10. As mission control, I want to choose Investigate past water or Find unusual minerals, so that the rover's expedition has a concrete scientific objective.
11. As mission control, I want the scientific objective and scoring rubric to remain fixed during an expedition, so that its results retain a consistent meaning.
12. As mission control, I want to supply mission instructions before an expedition, so that I can express priorities for pursuing the objective.
13. As mission control, I want to edit mission instructions during an expedition, so that I can observe how the rover responds to changing priorities.
14. As mission control, I want to initiate a new expedition when changing the scientific objective, so that results from different objectives are kept distinct.
15. As mission control, I want the rover to choose its own actions, so that the experience demonstrates autonomous decisions.
16. As mission control, I want a five-minute budget measured in expedition time, so that each experiment has a bounded duration.
17. As mission control, I want to pause and resume an expedition, so that I can inspect the situation without consuming its time budget.
18. As mission control, I want playback speeds of 1×, 2×, and 4×, so that I can watch closely or advance the experiment faster.
19. As mission control, I want to reset to the initial scenario, so that I can begin another experiment from the same conditions.
20. As mission control, I want to stop an expedition and inspect its results, so that I can end an experiment when I have learned enough.
21. As mission control, I want to see battery, cargo, current action, remaining expedition time, and science score, so that I can follow the rover's situation.
22. As mission control, I want observations to contain only information sensed within range, so that the rover's decisions reflect limited perception.
23. As mission control, I want sample properties to be revealed through inspection, so that scientific discovery requires an action.
24. As mission control, I want timestamped rover memory, so that previously observed information can remain useful while its age is visible.
25. As mission control, I want the rover to explore concrete unexplored-area targets, so that exploration makes visible progress.
26. As mission control, I want the rover to travel to and inspect discovered samples, so that it can learn their mission relevance.
27. As mission control, I want the rover to travel to and collect samples when physical conditions and cargo capacity permit, so that its choices can produce scientific returns.
28. As mission control, I want the rover to carry at most two samples, so that collecting and returning involve meaningful tradeoffs.
29. As mission control, I want returning to base to unload cargo automatically, so that successful delivery is clear.
30. As mission control, I want recharging to be a separate action at base that consumes expedition time, so that recovering energy is a strategic choice.
31. As mission control, I want bounded waiting to consume expedition time, so that waiting for a storm has a visible cost.
32. As mission control, I want an expedition to allow multiple trips to base, so that delivery and recharging are part of the full exploration loop.
33. As mission control, I want terrain and obstacles to affect routes and energy use, so that movement choices have consequences.
34. As mission control, I want physically invalid actions to be prevented, so that the simulation remains consistent.
35. As mission control, I want poor strategy to be able to strand the rover, so that failure is a meaningful experimental outcome.
36. As mission control, I want delivered samples to earn objective-specific science scores, so that the experiment measures progress toward its scientific aim.
37. As mission control, I want discoveries and inspections reported separately from science score, so that exploration remains visible without receiving delivery credit.
38. As mission control, I want cargo remaining aboard at the end to earn no delivery credit, so that returning samples matters.
39. As mission control, I want to trigger a localized dust storm, so that I can observe a response to an environmental change.
40. As mission control, I want the storm to reduce sensor range and increase movement energy consumption in its region, so that crossing, detouring, and waiting have different costs.
41. As mission control, I want a detected storm's extent and remaining duration to become known to the rover, so that it can choose among those responses.
42. As mission control, I want meaningful new observations and changed instructions to prompt reconsideration at safe action boundaries, so that the rover adapts without constantly changing its mind during routine movement.
43. As mission control, I want TypeSafe to choose a complete available action and target, so that its judgment can be executed reliably by the simulator.
44. As mission control, I want the decision timeline to show the observations, candidate actions, returned probabilities, and selected action, so that I can inspect what happened at each decision point.
45. As mission control, I want a valid uncertain choice to proceed autonomously while its uncertainty remains visible, so that ambiguity does not continually require intervention.
46. As mission control, I want expedition time, movement, energy use, and storm progression to pause during inference, so that network speed does not affect simulated outcomes.
47. As mission control, I want the interface and camera to remain responsive during inference, so that I can continue observing the experiment.
48. As mission control, I want total decision deadlines, bounded retries, and an expedition inference budget, so that inference usage stays controlled.
49. As mission control, I want obsolete decisions to be discarded after reset, changed instructions, or relevant state changes, so that the rover cannot act on superseded context.
50. As mission control, I want inference failure to pause the expedition and offer Retry or explicit baseline continuation, so that I control how the experiment proceeds.
51. As mission control, I want the responsible controller and any controller changes recorded, so that I can interpret results honestly.
52. As mission control, I want results to report science score, discoveries, inspections, energy use, ending condition, controller history, inference usage, and latency, so that I can assess each expedition.
53. As mission control, I want completed expeditions saved locally in the browser, so that I can revisit experiments.
54. As mission control, I want JSON export and import of expedition records, so that I can retain and reopen them.
55. As mission control, I want replay to use recorded decisions and events without new inference, so that I can reproduce the recorded expedition.
56. As mission control, I want to compare expeditions with the same starting conditions and scientific objective, so that I can assess the effects of different instructions or controllers.
57. As mission control, I want credentials excluded from browser code, expedition records, and logs, so that using live inference does not disclose my API key.

## Implementation Decisions

### Scope and starting configuration

- Deliver one local application comprising a browser interface and a small local Bun decision backend. Use React, TypeScript, and Vite for the application and Three.js through React Three Fiber for rendering. Do not add interactive hosting to this release.
- Use Bun for dependency management, package scripts, the backend runtime, and automated expedition tests. Pin a tested Bun version and commit its generated dependency lockfile during initial scaffolding. Run the Vite development server and build through Bun explicitly; retain Vite as the frontend tool.
- Author one repeatable planetary area with a base and three sample sites: an accessible sample, a distant discovery, and a tempting sample near a hazard.
- Start with a five-minute expedition, two cargo slots, and playback speeds of 1×, 2×, and 4×. Movement, inspection, collection, recharging, and waiting consume expedition time.
- Tune travel distances, energy rates, and action durations through playtesting. Collecting all samples should require good decisions; the initial numerical tuning is not a promise that every strategy succeeds.
- Use convincing rover movement and wheel/suspension animation with simplified physics. Terrain and obstacles affect navigation and energy, without mechanical traction, slip, or tipping simulation.

### Modules and responsibilities

- The simulation owns world state, observations, rover memory, navigation, action lifecycle, resource accounting, objective scoring, expedition lifecycle, and event recording. It is independent of React and network calls and advances through fixed time steps with grid pathfinding.
- The scene renders the environment, rover, objects, lighting, cameras, and visual effects from simulation state. Rendering and camera interaction do not advance the simulation or grant the rover extra knowledge.
- The mission-control interface owns controls, telemetry, decision inspection, results, and access to saved expedition records.
- Controllers select among candidates supplied by the simulation. Provide a fixed rule-based baseline controller and a TypeSafe controller using the local backend.
- The backend owns the TypeSafe client, question construction, validation, and bounded request handling. Shared browser/backend contracts define request context, candidate identity, decision results, probabilities, and failure outcomes.
- Expose the expedition's commands, observable state, and events at a cohesive application boundary. The browser and automated expedition scenarios should drive the same behavior.

### Scientific objectives and scoring

- Provide Investigate past water and Find unusual minerals. A mission consists of the selected scientific objective and editable mission instructions.
- Keep the scientific objective and scoring rubric fixed for the expedition. Changing the objective begins a new expedition; changing instructions does not change the rubric.
- Give authored samples predefined properties and objective-specific classifications. Unrelated earns 0, suggestive earns 5, and strong evidence earns 10.
- Inspection reveals sample properties. TypeSafe evaluates observed descriptions to choose actions; the simulation calculates science score independently using the authored rubric.
- Only delivered samples contribute to science score. Report discoveries and inspections separately. Onboard cargo at an expedition's end does not receive delivery credit.
- Returning to base unloads automatically. Recharging is a separate action.

### Expedition lifecycle and perception

- An expedition can contain multiple trips and recharges. End it when its time budget expires, the rover becomes stranded, or mission control stops it. A stranded rover has exhausted its battery away from base.
- Enforce physical constraints, capacity, and resource bounds without guaranteeing strategic success or forcing a safe return.
- Pause suspends expedition time and modeled evolution. Playback speed changes how quickly expedition time is presented, not the rules or outcomes for identical actions and events.
- Reset restores the initial scenario and invalidates decisions from the previous expedition. A fresh live AI expedition may choose differently from an earlier one.
- Sensors accurately detect terrain and objects within range. Inspection is the action that reveals sample properties. Memory retains timestamped observations that may become stale.
- Candidate generation and route estimates use the rover's known map. Keep hidden sample properties and undiscovered objects out of controller inputs.
- The normal scene reflects rover discovery. A clearly identified full-world view can expose hidden state for debugging without modifying observations or memory. Recording full starting conditions must also preserve the controller's information boundary.

### Actions and reconsideration

- Provide six bounded action kinds with concrete targets when needed: explore a supplied unexplored-area target; travel to and inspect a discovered sample; travel to and collect a sample; return to base; recharge at base; and wait for a bounded interval.
- Code constructs complete action-and-target candidates and owns pathfinding, movement, physical preconditions, resource changes, and execution. TypeSafe selects a candidate; it does not invent targets or motor commands.
- Request a decision after an action completes or a meaningful change occurs, such as a new observation, changed instructions, or a detected storm. Routine movement alone does not trigger inference.
- Interrupt travel at the next safe waypoint for reconsideration. Short interactions can complete before the next decision. Keep actions stable between these boundaries to prevent oscillation.
- Recheck relevant preconditions before applying a returned decision. Associate each request with its expedition and mission-instruction versions so that superseded results cannot apply. Relevant state changes can invalidate a result; routine rendering does not.

### Dust storm

- Allow mission control to trigger a temporary localized region with a fixed duration. Within that region, the storm reduces sensor range and raises movement energy consumption.
- Once detected, the storm's extent and remaining duration become known to the rover. Before detection, the controller must not receive those hidden conditions through candidate generation or other inputs.
- Waiting consumes expedition time, crossing costs extra movement energy, and detouring adds distance. Storm progression follows expedition time and pauses whenever expedition time pauses.

### TypeSafe decisions and recovery

- Use the official TypeSafe JavaScript SDK on the Bun backend, with credentials kept on the server. Verify compatibility under the selected Bun version when implementing the integration, particularly cancellation, deadlines, and retries.
- Supply the scientific objective, mission instructions, observations, timestamped memory, resource state, and available action-and-target candidates. Obtain a typed Choice and its actual returned probabilities.
- Keep one decision in flight. Bound the entire decision request and retry operation by five seconds of wall-clock time, with at most one automatic retry inside that same deadline.
- Allow at most 100 inference attempts per expedition, including retries. Track attempts rather than completed decisions. Reaching the limit pauses further inference; Retry must not bypass the expedition limit.
- Treat those limits as application starting defaults, not provider guarantees. Configure or wrap SDK behavior so that implicit retries cannot exceed them.
- While a decision is pending, pause expedition time and all modeled evolution, including movement, resource consumption, and storm progression. Keep interface and camera interaction responsive. This implements the accepted architecture decision; record inference latency separately.
- A valid Choice with spread-out probabilities proceeds autonomously. Display returned probabilities without treating them as utility, science score, guaranteed correctness, or a generated explanation.
- After bounded inference failure, keep the expedition paused and offer Retry, subject to the remaining inference budget, or Continue with the baseline controller. Baseline continuation requires an explicit choice.
- Record the controller responsible for each decision and make controller changes visible in the timeline and results. Do not silently substitute baseline decisions for TypeSafe decisions.

### Decision inspection and expedition records

- Show observations used, available actions, actual returned probabilities when provided by TypeSafe, and the selected action in a chronological decision timeline. Keep latency and inference usage separate from simulation metrics.
- Save completed expeditions in browser-local storage. Support JSON export, JSON import, and replay.
- An expedition record contains the starting scenario, scientific objective and rubric, mission-instruction changes, environmental events, decisions, executed actions, controller history, and results sufficient to inspect and reproduce the expedition.
- Validate imported data against the expedition-record contract before replay. Exclude credentials from exported data and logs.
- Replay executes recorded decisions and events against the recorded starting conditions without calling TypeSafe. A new live AI run is a separate experiment.
- Support comparing results under the same starting conditions and fixed objective. A particular comparison dashboard layout is not prescribed.

## Testing Decisions

- Use Bun's test runner for automated expedition scenarios and a separate TypeScript typechecking step. Retain the agreed real-browser integration checks.
- Use one primary behavioral boundary: an expedition session driven through the same commands, observable state, and events used by the application. Exercise simulation, action execution, controllers, decision coordination, and record/replay behavior together at this boundary.
- Control simulated time, wall-clock deadlines, and TypeSafe responses in automated scenarios. Substitute the external inference service while retaining RoverLab's request, validation, retry, and recovery behavior. These tests must not require credentials or spend inference credits.
- Prefer complete scenarios and observable outcomes over tests of private helpers, internal component structure, incidental call order, or snapshots that mirror the implementation. The repository has no existing test suite or prior test seams to reuse.
- Cover an expedition that explores, inspects, collects, returns, unloads, recharges, and makes another trip. Check capacity, resources, scoring, pause/resume, reset, and each ending condition.
- Verify objective-dependent 0/5/10 scoring, delivery-only credit, independent discovery/inspection counts, and uncredited cargo when an expedition ends.
- Assert the exact observation and candidate information available to a controller. Cover sensor range, properties revealed only by inspection, timestamped memory, undiscovered terrain/objects, and the absence of hidden-state leakage through full-world view, route estimates, or recording.
- Exercise blocked routes and invalidated targets through visible action behavior. Check safe waypoint interruption and stable actions between reconsideration boundaries.
- Exercise storm detection, disclosure of extent and remaining duration, sensor and movement-energy effects, and storm progression during normal time, manual pause, and inference pause.
- For the same recorded actions and events, compare outcomes across playback speeds and different inference delays. Latency can differ; expedition time, energy, storm state, and scientific results must remain consistent.
- Use scripted success, uncertain valid choices, invalid responses, failures, and delayed responses to verify the total deadline, at most one automatic retry, attempt accounting, inference-budget exhaustion, and at most one active decision.
- Exercise reset, instruction changes, and relevant state changes while a response is pending. Verify that obsolete results cannot execute and that ordinary rendering does not invalidate valid decisions.
- Verify that a valid uncertain Choice continues automatically, inference failure leaves the expedition paused, and baseline continuation occurs only after explicit selection with truthful controller attribution.
- Round-trip a completed expedition through local storage and JSON export/import. Replay it without inference and compare its recorded events and final results. Invalid imported records must not begin replay.
- Add a small set of real-browser integration checks for startup, the visible 3D scene, mission controls, cameras, timeline, results, and record controls. Include interface/camera responsiveness while inference is pending and the baseline experience without an API key.
- Use optional live TypeSafe playtests to evaluate the usefulness of choices against the baseline controller for representative missions. Do not use an exact live model choice as a deterministic test expectation.
- Verify that credentials are absent from browser-visible responses, records, and logs. Use non-secret test values for these assertions.
- Evaluate numerical tuning in representative expeditions after the complete loop works. Passing interface and simulation tests does not establish that model decisions are scientifically useful.

## Out of Scope

- Public interactive hosting, deployment infrastructure, user accounts, cloud synchronization, or shared online experiment storage.
- Multiplayer, fleets of rovers, multiple planets, procedural world generation, or a general-purpose scenario editor.
- Direct piloting, manual motor control, or TypeSafe-generated navigation code or physics rules.
- Detailed mechanical traction, wheel slip, tipping, damage, or engineering-grade planetary physics.
- Additional hazard types beyond the localized dust storm.
- Noisy sensors or probabilistic measurement error; uncertainty in the first release comes from limited range, uninspected properties, changing conditions, and decisions.
- Changing the scientific objective or scoring rubric inside an existing expedition.
- Model-generated sample properties, model-assigned science scores, free-form action generation, or a generated reasoning transcript.
- Automatic baseline takeover after inference failure, or mandatory human approval solely because a valid Choice has low confidence.
- A guarantee that fresh live AI runs make identical choices, that every expedition succeeds, or that TypeSafe outperforms the baseline controller.
- Implementation tickets or application code as part of writing this specification.

## Further Notes

- This spec synthesizes the design confirmed on 2026-09-16 and uses the repository's domain glossary. The accepted decision to pause expedition time during inference is binding.
- Deliver the release incrementally. First complete the baseline simulation loop, limited perception, objectives, delivery scoring, lifecycle, controls, and basic results. Next add TypeSafe decisions, bounded requests, safe interruption, stale-result handling, explicit recovery, and decision inspection. Then add the storm interaction, remaining observation aids, persistence, export/import, replay, comparison, and tuning.
- Keep these increments end-to-end and demonstrable when creating implementation tickets. The full scope of this spec remains the first playable release.
- Action durations, route distances, energy rates, storm duration and strength, and other balancing constants are implementation/playtesting parameters within the accepted rules. Their final values have not been fixed by the design interview.
- No prototype or code snippets were produced for this specification. Verify the installed TypeSafe SDK's current contract when implementing the integration; the application deadline and attempt limits remain authoritative.
- This specification belongs to the repository's local Markdown issue tracker. Do not maintain a second specification or review snapshot outside the repository.
