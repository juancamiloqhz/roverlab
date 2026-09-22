# Fullscreen Jev decision lab

Status: ready-for-agent

## Problem Statement

As a developer evaluating Jev, I want to understand what it contributes to an autonomous rover's decisions, what ordinary code still does, and what that contribution costs. The current RoverLab makes this difficult: the world occupies part of a scrolling page, decision details sit away from the rover, the five-minute expedition provides little room for investigation, and the small map offers few competing scientific opportunities.

The existing inference counter counts local submissions even when they never reach the provider. Successful provider responses contain usage and model information that the application currently discards. The baseline receives scientific observations and mission instructions but ignores their meaning. These limitations make it difficult to explain Jev's operational cost or draw a fair conclusion from a comparison.

I need an engaging experiment that makes choices and consequences visible, including occasions when Jev ties or loses to a capable rule-based alternative. A convincing presentation must distinguish observations from hidden world truth, choice probabilities from scientific value, estimated cost from verified charges, and an illustrative prototype from an authentic recorded expedition.

## Solution

Build the next local RoverLab experience around the selected Expedition layout A. The planetary world fills the browser viewport. A compact header keeps mission resources and Jev usage visible, a floating decision card and timeline identify the latest choice, and expandable panels expose the evidence, alternatives, and cost without losing the world as the primary view. Offer optional browser fullscreen, orbit and rover-follow cameras, pause and speed controls, and teaching mode.

Expand to one authored world with roughly four times the current area, three research regions, and 10 to 12 sample sites. Longer expeditions target 15 to 20 minutes of simulated time and several meaningful trips to base. Scientific observations, limited resources, changed priorities, and dust storms create consequential choices. The simulation continues to own movement, arithmetic, action execution, and scoring. Jev selects among bounded available actions using rover knowledge.

Provide shared mission-priority presets and a stronger baseline for matched comparisons. Keep free-text experiments as a distinct way to explore Jev's language understanding. At a decision point, show what the baseline would choose from the same input. After a run, compare expedition outcomes under matching starting conditions and intervention schedules, with differences and failures disclosed.

Record actual provider attempts, retries, tokens, latency, resolved models, and the prices used for estimates. Make usage uncertainty visible and pause further requests when limits or unknown usage require a user choice. Introduce new users through a short guided replay of an authentic Jev expedition that requires no key and makes no inference calls. Live expeditions use the user's own server-side API key.

## User Stories

1. As a developer evaluating Jev, I want to distinguish Jev's choices from simulation behavior, so that I can understand where the model contributes.
2. As mission control, I want the planetary world to fill the browser viewport, so that the expedition feels like a game I can follow continuously.
3. As mission control, I want an optional fullscreen control, so that I can remove browser chrome when presenting the experiment.
4. As mission control, I want mission status, expedition time, battery, cargo, and delivered science visible, so that I can understand the rover's situation.
5. As mission control, I want Jev's status, provider attempts, and estimated cost visible throughout the experience, so that inference does not become invisible background activity.
6. As mission control, I want decision details in expandable panels, so that I can inspect evidence while retaining the world's spatial context.
7. As mission control, I want orbit and rover-follow cameras, so that I can examine either the wider environment or the rover's immediate situation.
8. As mission control, I want usable keyboard, mouse, and touch controls, so that I can operate the experience on desktop and smaller screens.
9. As mission control, I want compact panels on narrow screens, so that essential telemetry and controls remain accessible without hiding the whole world.
10. As mission control, I want sensor coverage and timestamped observations, so that I can distinguish current perception from remembered information.
11. As mission control, I want full-world debugging clearly labeled and isolated from rover knowledge, so that I can inspect the scenario without improving a controller's information.
12. As mission control, I want a larger authored world with distinct research regions, so that exploration involves different scientific and travel opportunities.
13. As mission control, I want 10 to 12 sample sites, so that cargo, inspection, and delivery choices matter across several trips.
14. As mission control, I want clear and ambiguous scientific observations, so that I can observe how controllers interpret evidence against the objective.
15. As mission control, I want longer expeditions of 15 to 20 simulated minutes, so that there is time to explore and adapt.
16. As mission control, I want pause and playback speed controls, so that I can study decisions or move through routine travel faster.
17. As mission control, I want inference and inspection pauses to preserve expedition time, so that network delays and reading time do not alter the experiment.
18. As mission control, I want to reset or stop an expedition, so that I can repeat conditions or finish an experiment when I have learned enough.
19. As mission control, I want the rover to remain autonomous, so that my role is to set priorities and introduce events rather than drive it.
20. As mission control, I want to select a scientific objective whose scoring rubric stays fixed, so that outcomes retain a consistent meaning.
21. As mission control, I want Balanced, Conserve energy, and Explore more presets, so that I can express priorities through documented settings.
22. As mission control, I want both controllers to receive the same preset settings, so that a benchmark comparison uses matching priorities.
23. As mission control, I want preset changes recorded at their expedition time, so that adaptations can be inspected and reproduced.
24. As mission control, I want a distinct free-text experiment mode, so that I can explore how Jev responds to written instructions.
25. As mission control, I want free-text instructions to replace preset preferences, so that conflicting instruction sources do not silently compete.
26. As a developer evaluating Jev, I want the baseline's free-text limitations disclosed, so that I do not mistake unequal language support for better planning.
27. As mission control, I want sample properties to require inspection and scientific credit to require delivery, so that choices have observable consequences.
28. As mission control, I want Jev to be called at meaningful decision boundaries, so that routine movement does not generate unnecessary requests.
29. As mission control, I want each request's trigger shown, so that I can understand why the rover reconsidered its action.
30. As mission control, I want separate choosing, executing, paused, and failed states, so that I can locate Jev's involvement in the action cycle.
31. As mission control, I want candidate targets and the chosen target highlighted in the world, so that abstract choices correspond to visible places.
32. As mission control, I want the decision card to show the chosen action and its returned probability, so that I can identify the result immediately.
33. As mission control, I want to inspect the exact input, available actions, probabilities, and resources for a decision, so that the explanation is grounded in recorded evidence.
34. As mission control, I want probability labels that distinguish confidence from scientific value and success, so that I interpret the output correctly.
35. As mission control, I want the interface to describe what code will execute after a choice, so that I can connect the decision with movement, inspection, or delivery.
36. As mission control, I want the decision timeline linked to map highlights, so that I can revisit where earlier choices applied.
37. As mission control, I want selecting a past decision to pause the expedition, so that I can inspect its original state without consuming expedition time.
38. As mission control, I want teaching mode to pause at each completed decision, so that I can follow the experiment one choice at a time.
39. As mission control, I want the same-state baseline alternative visible beside Jev's choice, so that I can identify agreement and disagreement.
40. As a developer evaluating Jev, I want the baseline to use scientific evidence, resource planning, and mission priorities, so that it is a credible alternative.
41. As a developer evaluating Jev, I want neither controller to receive hidden sample scores or undiscovered information, so that their information is fair.
42. As mission control, I want benchmark scenarios with predefined interventions, so that controller runs can share the same external conditions.
43. As mission control, I want manual storm and instruction changes recorded, so that a later baseline expedition can receive the same schedule.
44. As mission control, I want scheduled events to occur at the same expedition time and location across runs, so that different rover trajectories do not change the schedule.
45. As mission control, I want a fresh baseline run from a Jev expedition's starting conditions and schedule, so that I can compare complete outcomes.
46. As mission control, I want matching and differing comparison conditions identified, so that I know which conclusions the comparison supports.
47. As mission control, I want delivered science and safe completion compared, so that I can assess the mission outcome.
48. As mission control, I want measurable priority adherence, energy, time, and inference costs shown separately, so that trade-offs remain visible.
49. As a developer evaluating Jev, I want ties, losses, failures, and mixed-controller runs retained and labeled, so that the presentation does not conceal unfavorable evidence.
50. As a developer evaluating Jev, I want a single run distinguished from repeated evidence, so that a demonstration does not imply a general performance guarantee.
51. As mission control, I want decision count, provider-attempt count, and retries separated, so that I understand how many API attempts a choice required.
52. As mission control, I want local failures distinguished from provider attempts, so that missing credentials do not appear as completed Jev calls.
53. As mission control, I want uncertain dispatch or usage identified, so that incomplete accounting is not presented as an exact total.
54. As mission control, I want input and output token usage recorded, so that the estimate has an inspectable basis.
55. As mission control, I want decision and expedition latency measured in wall time, so that service performance remains separate from expedition outcomes.
56. As mission control, I want per-decision and total estimated cost displayed with enough precision, so that small charges do not all appear as zero.
57. As mission control, I want the resolved Jev model and pricing basis recorded, so that I can interpret the cost and behavior later.
58. As mission control, I want retries, cancelled requests, and obsolete results retained in usage accounting, so that discarded actions do not erase possible cost.
59. As mission control, I want defaults of 250 provider attempts and $0.10 estimated cost per expedition, so that a live run begins with explicit limits.
60. As mission control, I want to adjust limits before starting, so that they suit my experiment.
61. As mission control, I want the expedition to pause when a limit is reached or usage becomes unknown, so that I choose whether more requests may proceed.
62. As mission control, I want to raise a limit or acknowledge known uncertainty explicitly, so that continuation is deliberate and recorded.
63. As mission control, I want explicit baseline continuation after a failure or usage pause, so that controller ownership remains visible.
64. As a new developer, I want a short guided replay without an API key, so that I can understand the experience before configuring live inference.
65. As a new developer, I want the guided replay to use authentic recorded Jev responses, so that the demonstration reflects a real expedition.
66. As a new developer, I want historical calls and costs distinguished from the current playback, so that I know replay makes no new inference calls.
67. As mission control, I want a keyless baseline expedition and live Jev using my own server-side key, so that I can choose how to try the lab.
68. As mission control, I want the application to remain local, so that I can run it with the repository's existing workflow.
69. As mission control, I want completed expedition records saved locally, so that I can revisit outcomes and accounting.
70. As mission control, I want records to retain conditions, priority changes, decisions, schedules, and usage, so that comparisons and replays are reproducible.
71. As mission control, I want JSON export and import to retain the new data, so that I can exchange evidence without sharing credentials.
72. As mission control, I want older five-minute records to remain inspectable and replayable under their supported original rules, so that the longer expedition does not invalidate past work.
73. As mission control, I want missing historical token usage shown as unavailable, so that old records are not assigned invented costs.
74. As mission control, I want replay, inspection, and comparison to make no inference requests, so that reviewing evidence cannot spend credits.
75. As a developer evaluating Jev, I want scenario, simulation, baseline, prompt, model, and pricing versions recorded, so that changes in the experiment remain visible.
76. As a maintainer, I want deterministic behavioral tests through the existing expedition boundary, so that changes can be verified without model variability.
77. As a maintainer, I want the real backend and SDK exercised against a scripted provider, so that accounting and recovery are tested without paid calls.
78. As a maintainer, I want browser checks for the selected layout, inspection, usage, and replay, so that the user-facing integration stays usable.
79. As a maintainer, I want representative long expeditions and adverse scenarios playtested, so that the larger map offers meaningful choices within its duration and budgets.
80. As a developer evaluating Jev, I want the illustrative prototype kept separate from authentic results, so that visual examples never become performance evidence.

## Implementation Decisions

### Existing architecture and ownership

- Extend the existing local browser application and Bun decision backend. Retain React, TypeScript, Vite, Three.js, React Three Fiber, and the official TypeSafe SDK. Continue using Bun for dependencies, scripts, runtime, and non-browser tests.
- Keep the expedition/session boundary authoritative for commands, simulated time, snapshots, decision history, completed records, and replay. Extend that boundary for priorities, schedules, usage pauses, and the longer scenario rather than creating another simulation engine in the interface.
- Keep the scene as a presentation of expedition state. Camera changes, map highlights, and full-world debugging must not modify rover knowledge or choose actions.
- Jev continues to select a complete action and target from supplied candidates. Code owns observation, memory, candidate construction, routing, resource arithmetic, validity, execution, and delivery scoring. Strategic mistakes remain possible.
- Keep credentials and provider access on the local backend. Do not place keys in browser state, exports, logs, prototype assets, or guided replay records.

### Selected fullscreen experience

- Use Expedition layout A as the visual reference. Reimplement the selected behavior against real session data; the throwaway components and fixtures are not production implementation.
- Fill the available viewport with the world. Keep mission, time, battery, cargo, and science telemetry across the top, with Jev's current status, provider-attempt count, and estimated cost persistently visible.
- Keep the latest decision card and compact timeline over the world. Open detailed evidence, instructions, usage, and comparisons in expandable panels. The B and C prototype layouts were not selected as the main experience.
- Provide optional browser fullscreen with a usable normal-viewport experience when fullscreen is unavailable. Retain orbit, follow, sensor coverage, and clearly labeled full-world debugging controls.
- Support desktop pointer and keyboard use and smaller-screen touch interaction. Collapse detail panels when space is limited while keeping essential status, usage, and pause controls accessible. Do not rely on color alone to identify controller ownership or selected targets.
- Show distinct states for Jev choosing, code executing, manual or teaching pause, usage pause, and request failure. Preserve the last completed decision as history while a new choice is pending; do not show an old result as the pending request's answer.
- Highlight offered spatial targets and the selected target. Agreement and disagreement with the baseline must match the recorded actions. Non-spatial actions such as waiting or recharging have an explicit rover or base indication.
- The decision card exposes the trigger, chosen action, returned probability, latency, and estimated cost. Its inspector provides the exact recorded context and complete offered probability distribution. Explanatory text may describe observed changes and code-calculated consequences; it must not invent Jev's internal reasoning.
- Decision inspection pauses the live session without consuming time. Viewing historical evidence must identify the selected decision's time and observations rather than substituting the rover's current state.
- Teaching mode pauses after each completed controller choice and before its action proceeds. Ordinary viewing proceeds automatically after a valid choice. Uncertain but valid probabilities alone do not require approval.

### World, duration, and mission behavior

- Author one larger world with approximately four times the current area, three distinct research regions, and 10 to 12 sample sites. Keep one rover, a base, and the existing action vocabulary and dust-storm hazard.
- Configure and record the longer expedition time budget within the agreed 15-to-20-minute range. Retain pause, reset, manual stop, and 1x, 2x, and 4x playback. Playback speed changes viewing pace, not simulation rules or provider deadlines.
- Tune travel distances, sample placement, and resource settings so several trips are viable and choices involve opportunity cost. A larger empty travel area is insufficient. Exact dimensions and numeric preset parameters are tuning work within these bounds, not new product scope.
- Include scenarios exercising evidence interpretation, priority changes, and storm responses. Provide both clear and ambiguous sample properties, with classifications and scoring authored independently of controller output.
- Keep the existing scientific objectives and delivery-only rubric semantics. The objective and scoring rubric remain fixed during an expedition. Inspection reveals properties; collection occupies cargo; only delivery earns science credit.
- Preserve limited perception and timestamped memory. Neither controller receives hidden sample scores, classifications, unexplored terrain, or undiscovered properties. Known route calculations may use only rover knowledge.
- Extend mission configuration with mutually exclusive preset-priority and free-text modes. Start preset mode with Balanced, Conserve energy, and Explore more, each defined through documented structured preferences supplied to both controllers.
- Balanced weighs scientific opportunity with delivery and resource needs. Conserve energy emphasizes preserving energy and avoiding costly travel. Explore more emphasizes acquiring new knowledge while retaining the same simulation rules and scientific objective. Express their measurable settings explicitly and version them; labels alone are not sufficient controller input.
- Free-text mode replaces preset behavioral preferences with editable mission instructions. Retain baseline access but disclose its inability to interpret arbitrary instructions. Do not label free-text results as a matched-priority benchmark.
- Record changes to presets or instructions with their expedition times and versions. Apply them at safe action boundaries and reject stale decisions. Keep the scientific objective unchanged by such edits.

### Decisions and the baseline

- Reconsider at meaningful boundaries: expedition start, completed actions, newly available scientific evidence, changed mission priorities or instructions, detected or changed hazards, and resource thresholds that affect a choice. Rendering and ordinary movement do not trigger inference by themselves.
- Coalesce changes that reach the same safe boundary into one decision context. Record its triggers. Do not turn every newly visible terrain cell on the larger map into a separate provider request.
- Keep one decision in flight. Preserve ADR 0001: pause expedition time, movement, resource use, and storm evolution while inference is pending, while leaving camera and interface interaction responsive.
- Preserve bounded action validation, obsolete-result rejection, cancellation, the five-second total decision deadline, and at most one automatic retry. Retries must also pass the new attempt, cost, and uncertainty guards; the old retry allowance cannot bypass a usage pause.
- Strengthen the baseline with documented rules that interpret observed scientific evidence against the objective, compare available route costs, account for cargo and delivery, and apply shared mission priorities. Use general evidence rules rather than hidden classifications or a lookup of the authored sample IDs and correct answers.
- At each Jev decision, evaluate the baseline against a detached copy of the same recorded input and candidate set. Record its alternative and the applicable baseline version. This evaluation must not mutate the live expedition, issue a Jev request, or advance a second rover in the live session.
- Baseline rule explanations may report the rule that selected its action. A same-state action difference is a decision comparison, not proof of an improved outcome.
- Preserve explicit controller attribution and controller transitions. A usage or inference failure pauses the expedition; it must not silently substitute baseline actions.

### Matched expeditions and outcomes

- Define benchmark scenarios with starting conditions, objective and rubric, mission-priority history, and a predefined intervention schedule. Both controllers receive the same external schedule and simulation rules, while their decisions may lead to different observations and trajectories.
- For free exploration, record manual instruction or preset changes and storms at exact expedition times, including storm location and effects. Support a fresh baseline expedition from the recorded starting conditions and schedule. This run executes the baseline's own choices; it is not a replay of Jev's action history.
- Schedule events by expedition time and world location, not by a particular controller's decision number, observation time, or current position. A storm introduced at minute six occurs at minute six for both runs, even if only one rover observes it.
- Retain both matched and unmatched comparisons. Identify differing scenario, simulation settings, objectives, rubrics, mission histories, schedules, and controller mixtures rather than presenting them as equivalent conditions.
- Assess delivered science and safe completion first. Show measurable preset adherence, energy, time, delivered and undelivered cargo, provider attempts, latency, token usage, and estimated cost separately. Do not combine these into an unexplained overall AI score.
- Keep failures, ties, losses, manual stops, and mixed-controller histories visible. Distinguish unfinished or failed runs from successful completion. Do not infer baseline benefit or Jev benefit from an unexecuted alternative action alone.
- Treat a single run as an observation about that run. Claims of consistent advantage require repeated matched runs and disclosure of their unfavorable outcomes. This release does not require an unattended benchmark service or automatic paid batch runner.

### Provider usage and estimates

- Separate controller decisions, local submissions, actual provider attempts, and retries. A provider attempt is an outbound attempt initiated by the backend, not a count inferred merely from the browser starting a local request. It does not prove that the provider completed or billed it.
- Give each expedition, decision, and attempt a stable identity. Carry these identities through browser/backend handling, retries, settlement, cancellation, and recorded history so accounting can be reconciled and duplicated messages do not count twice.
- A confirmed local rejection before dispatch contributes zero provider attempts. If a lost local response prevents dispatch confirmation, expose the unconfirmed submission separately and reserve its possible attempt against the limit until resolved or explicitly acknowledged. Do not present a lower-bound count as a known exact total.
- Preserve the provider's resolved model and input/output token usage whenever available, plus safe request identity and timing metadata where supported. Keep request execution status separate from whether a returned choice was valid, current, and applied.
- Count retries and preserve usage associated with invalid, obsolete, cancelled, or discarded choices. A result that cannot execute may still contribute cost. Attribute late accounting to its original expedition and never apply an obsolete action to a new expedition.
- Keep decision latency and cumulative inference wait as wall-time operational metrics, separate from simulated expedition time. Retain per-attempt timing when available so retries can be inspected without double-counting elapsed time.
- Calculate dollar estimates from recorded token usage and an explicit pricing basis associated with the model and capture time. Preserve the input/output rates and provenance used in that calculation. Do not infer dollars from request count or silently reprice an old record using today's rates.
- Show meaningful precision for small amounts. Expose the components of the estimate in a breakdown. Mark missing tokens, unknown pricing, unconfirmed dispatch, and legacy fields as unavailable or incomplete; do not replace missing information with zero.
- Label monetary values as estimated inference cost. Provider-attempt counts and successful-response usage cannot establish verified billed spending, particularly for requests with missing responses.

### Limits, uncertainty, and continuation

- Default each live expedition to 250 provider attempts and $0.10 estimated cost. Allow adjustment before starting. Persist the selected limits and subsequent changes as part of the experiment.
- Check limits before each provider attempt, including retries. Use conservative reservations for outstanding or unconfirmed submissions so concurrency, retries, or transport loss cannot silently release an attempt allowance.
- When a limit is reached or any attempt leaves usage or its cost basis unknown, pause before further provider requests. The new uncertainty guard takes precedence over otherwise eligible automatic retries.
- Offer explicit actions appropriate to the cause: increase a reached limit, acknowledge the identified uncertainty and continue, continue with the baseline, or stop. Keep the known estimate and uncertainty visible after acknowledgement; acknowledgement does not convert missing usage to zero.
- Record acknowledgements against the affected attempts. A later, newly unknown attempt requires a new decision to continue. Record budget changes and controller transitions so comparison can disclose them.
- Estimated-cost limits are operational stopping rules, not guaranteed billing caps. Usage arriving after dispatch can change the estimate, and acknowledged unknown usage remains unresolved spending uncertainty.
- Keep the existing failure and stale-result behavior when it is compatible with these guards. Stop and reset remain available during pending requests, and accounting stays attributed to the originating expedition.

### Records, replay, and first use

- Extend the versioned expedition record and validated browser/backend contracts to include mission mode, preset definitions and histories, schedules, same-state alternatives, attempt accounting, estimates and uncertainty, limits and acknowledgements, and comparison provenance.
- Record scenario, simulation, baseline, prompt, and pricing versions, as well as the actual resolved model for each relevant response. A floating model alias alone is insufficient provenance. Expose within-run version differences when present.
- Preserve browser-local saving, validated import/export, and replay without inference. Credentials and raw provider error bodies must not enter exported records.
- Keep supported older records inspectable and replayable under their original simulation settings, including the five-minute duration and original scenario layouts. Version or migrate contracts explicitly; changing a global duration must not silently rewrite old conditions or reject all previously supported records.
- Old local-submission counters are not newly verified provider-attempt counts. Preserve their historical meaning and mark newly unavailable model, token, and cost data as unavailable. Replay itself still has zero new inference usage.
- Preserve source records during inspection, comparison, and replay. Validation rejects incompatible or malformed data before execution and never falls back to fresh inference to repair a replay.
- Offer a short guided replay, a keyless baseline expedition, and live Jev with the user's own backend key. Keep local distribution and the existing setup workflow.
- Capture the guided replay from an authentic Jev expedition after real instrumentation and record support exist. Include its actual choices, probabilities, usage availability, and model/pricing provenance. The user-facing playback clearly separates historical inference from its own zero new calls.
- Guide viewers through observations, a decision, the baseline alternative, action consequences, and cost. Do not fabricate an authentic record from the prototype or deterministic test fixtures, or select a recording on a requirement that Jev must win.

## Testing Decisions

- The user confirmed the existing testing boundaries: the expedition/session API is the primary behavioral seam; integration checks retain the real backend and SDK against a scripted provider; focused browser checks cover the interface. Prefer these seams to new low-level test-only APIs.
- Good tests drive commands, advance controlled simulated or wall time, and inspect public snapshots, decisions, records, and visible outcomes. Avoid assertions about private helpers, component structure, or a particular live model choice.
- Extend the existing Bun expedition, perception, science, energy, storm, decision, record, replay, and tuning scenarios. Cover longer runs, multiple deliveries, all three presets, free-text mode, safe-boundary changes, and recorded intervention schedules through the session boundary.
- Verify limited knowledge and scoring separation at that boundary: neither controller sees hidden classifications, scores, undiscovered properties, or debugging-only terrain. A changed objective or observed property can affect the improved baseline; changing hidden sample identity alone must not supply an answer.
- Verify that routine movement does not create repeated requests, meaningful changes do, and simultaneous changes are coalesced. Check that inference, inspection, and teaching pauses freeze modeled evolution while camera interaction remains available.
- Use the existing integration pattern that connects an expedition through the controller, local decision handler, and actual TypeSafe SDK with only the provider transport scripted. Add successful usage, known and unknown usage failures, local pre-dispatch rejection, unconfirmed dispatch, retries, malformed choices, cancellation, late results, and reset isolation.
- Assert exact provider-attempt counts where dispatch is confirmed, separate uncertain counts where it is not, token-derived estimates, preserved pricing, and no double counting. Cover a retry consuming the last attempt slot, a response crossing the estimated-cost threshold, unknown usage stopping the next request, explicit acknowledgement, and a new unknown attempt requiring another acknowledgement.
- Preserve five-second total deadlines, one in-flight decision, bounded retries, stale-action rejection, explicit baseline continuation, and credential isolation. Script failures and clocks; automated checks must not load live keys or spend credits.
- Verify that a decision comparison uses the same detached input and candidates without mutating the live session. Verify that matched baseline expeditions receive the same external events at the same times despite different paths and observations.
- Round-trip new records and supported legacy records. Replay their original outcomes and schedules without any provider access. Assert that historical usage remains historical, absent data stays unavailable, and inspection or comparison leaves source exports unchanged.
- Extend the existing Playwright prior art for expedition controls, observation/cameras, inference recovery, persistence, replay, and comparison. Check layout A at desktop and the existing narrow-viewport size, readable usage, target/decision correspondence, opening and closing inspectors, historical selection, teaching mode, comparison conditions, and guided replay with provider routes blocked.
- Keep browser checks focused on behavior and accessibility: usable controls, visible statuses, keyboard interaction, touch camera/panel behavior, absence of destructive overlap, and no horizontal page overflow. Use screenshots as review evidence, not pixel-perfect assertions about the prototype.
- Playtest the authored world with deterministic scripts and the improved baseline to establish viable multi-trip runs, competing opportunities, avoidable failures, and time pressure within the agreed duration. Record measured parameters and outcomes, and check that normal scenarios fit the configured request allowance.
- Keep live Jev evaluation separate from deterministic verification. Capture the authentic guided replay and representative matched results under explicit configured limits, retaining failures and uncertainty. Live evidence can assess usefulness but cannot make CI depend on Jev returning one exact action or outperforming the baseline.
- Run the repository's required typechecking, production build, Bun tests, and focused browser checks during implementation. The prototype's successful checks establish only that the layout study ran; they do not verify this feature.

## Out of Scope

- Public interactive hosting, shared server-funded inference, user accounts, collaboration, or multiplayer.
- Native desktop packaging or replacing the existing browser application and Bun stack.
- Multiple rovers, multiple planets, procedural world generation, a world editor, or new hazard types beyond dust storms.
- Direct rover piloting, Jev-controlled motor commands, model arithmetic in place of code calculations, or unrestricted action generation.
- Changing a scientific objective or scoring rubric inside an existing expedition.
- A generative narration model, fabricated reasoning transcripts, or interpreting choice probabilities as scientific scores or correctness guarantees.
- A billing dashboard, provider-account reconciliation, a guarantee of exact billed-cost caps, or invented costs for missing historical usage.
- Automatic baseline takeover, silently ignored usage uncertainty, or mandatory human approval solely because a valid choice has low confidence.
- An unattended benchmark service, automatic paid experiment batches, statistical guarantees, or a promise that Jev beats the baseline.
- Promoting the B or C prototype layout as the main interface, shipping the prototype switcher, or using illustrative fixtures as an authentic guided replay.
- A broad simulator rewrite or unrelated refactoring beyond what the longer scenario, preserved replay, and new behavior require.

## Further Notes

- This spec synthesizes the completed design interview, recommendations Q1 through Q18, and the user's selection of layout A. No new product interview is needed.
- The first playable release and ticket 12 are complete. This is a separate next-iteration specification; the original release spec remains the record of its scope.
- The agreed design is captured in commit `76649e8`. The throwaway prototype is preserved on branch `codex/fullscreen-prototype`, initially captured at `b23f154`; commit `fcd5d9a` records the user's choice, "I like the A better." Carry this reference into the future fullscreen implementation ticket.
- The prototype provides a layout reference, not decision logic or production snippets. Its apparent costs, model behavior, terrain, and outcome comparisons are illustrative.
- The selected testing boundaries were explicitly confirmed during preparation of this spec.
- Numeric map dimensions, baseline preference parameters, and request volume require measured tuning within the agreed world size, duration, and default limits. Preserve resulting parameters and versions in records rather than treating tuning as an unrecorded change.
- No authentic Jev expedition is currently bundled. Capturing and validating one is required work for the guided replay, not evidence that already exists.
- The local prototype server was stopped before this specification was published.
