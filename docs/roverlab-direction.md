# RoverLab direction

Design interview complete. The user has agreed to recommendations Q1 through Q18. These decisions guide the next iteration; they do not describe completed features or replace the first playable release's spec.

## Agreed direction

- Developers evaluating Jev are the primary audience. An expedition should make clear where Jev contributes, what the simulation handles, and how to assess the result.
- The user acts as mission control: setting priorities, editing mission instructions, and introducing environmental events while the rover chooses its actions.
- Comparisons should reveal better, equivalent, and worse outcomes under matched conditions. The rule-based baseline must be a credible alternative; defeating the existing baseline alone is insufficient evidence of Jev's usefulness.
- The experience should fill the screen like a game, with a larger world and longer expeditions that create meaningful choices.
- Jev's involvement should be visible in the world and through a compact display of the decision context, available actions, returned probabilities, and selected action. Recorded evidence explains what happened; it is not a transcript of Jev's reasoning.
- Request counts, token usage, latency, and estimated inference cost should be visible. Cost estimates must be distinguished from verified billed spending.

## Expedition experience

- The main decision challenges are interpreting scientific observations against mission priorities and adapting when mission instructions or conditions change. A representative choice involves an interesting sample, an approaching dust storm, and limited remaining cargo space.
- The simulation handles navigation, resource calculations, and action execution.
- A persistent indicator identifies when Jev is choosing. Candidate targets are highlighted in the world, and a compact decision card shows what changed, the selected action, returned probabilities, and estimated request cost.
- Selecting a decision pauses the expedition for inspection. An optional teaching mode pauses at every decision.
- Each decision can show the baseline alternative from the same information. Completed expeditions can be compared against baseline expeditions with matching starting conditions and scheduled events. Different choices alone do not establish better outcomes.
- Longer expeditions target 15 to 20 minutes of simulated time, with pause and speed controls. The larger world should contain distinct research areas and support several trips to base.
- A short guided scenario should help a new viewer understand Jev's contribution quickly.

## World and scenarios

- Start with one authored world with roughly four times the current area, three distinct research regions, and 10 to 12 sample sites.
- Use the world for scenarios involving scientific interpretation, changes in mission priorities, and dust storms. Include clear and ambiguous scientific evidence so both controllers' successes and difficulties remain observable.
- Tune travel distances to support several meaningful trips to base within the agreed expedition duration.

## Fullscreen interface

- Fill the browser viewport with the world and offer an optional browser fullscreen button.
- Place mission status, time, battery, and cargo across the top. Keep Jev's status, call count, and estimated cost visible.
- Put the current decision and a compact timeline along the bottom. Use expandable panels for instructions, decision inspection, and comparisons.
- Prioritize desktop camera controls. Use collapsible panels and usable touch controls on smaller screens.

## First experience and access

- Offer a short guided replay of an authentic Jev expedition without requiring an API key.
- Distinguish the original expedition's historical calls and cost from the current playback, which makes no inference calls.
- Offer live Jev expeditions using the user's own API key, and retain the keyless baseline experience.
- Keep distribution local for this iteration.
- Capture an authentic Jev expedition for the guided replay. The existing scripted test histories are not authentic Jev recordings.

## Mission priorities and instructions

- Start with Balanced, Conserve energy, and Explore more presets, each with documented behavior shared by both controllers.
- In a separate free-text experiment mode, written mission instructions replace preset behavioral preferences. The scientific objective and simulation rules remain fixed.
- Label the baseline's inability to interpret arbitrary instructions when it is compared with Jev in a free-text experiment.

## Fair comparison and outcomes

- Improve the baseline with documented science rules, resource planning, and structured mission priorities that both controllers receive. Both use observed scientific evidence; neither receives hidden sample scores.
- Keep free-text mission instructions available as a separate experiment in Jev's language understanding. Disclose the baseline's limitations when interpreting that comparison.
- Assess delivered science and safe completion first, alongside adherence to measurable mission priorities. Show time, energy, API usage, and estimated cost separately so the trade-offs remain visible.
- Choice probabilities describe the returned decision distribution. Higher probability does not establish better expedition performance.
- Benchmark scenarios use predefined intervention schedules. During free exploration, record manual instruction changes and storms at their exact expedition time so a baseline run can receive the same schedule.
- Apply a scheduled storm at the same expedition time and location in both runs, even if the rovers occupy different locations.

## Jev calls and cost

- Request a Jev decision when meaningful choices arise: discovering a sample, completing an action, changing mission instructions, detecting a hazard, or crossing a resource threshold. Ordinary travel continues through simulation code.
- Explain each decision trigger and distinguish when Jev is choosing from when the rover is executing an action.
- Count decisions, actual provider attempts, and retries separately. Display token usage, latency, and estimated dollars for individual decisions and expedition totals.
- Flag requests whose usage is unknown. An estimate derived from received usage is not a verified account charge.
- Provide adjustable request and estimated-cost limits. Reaching either pauses the expedition for an explicit continuation choice; an estimated-cost limit does not guarantee an exact billing cap.
- Start with 250 provider attempts and $0.10 estimated cost per expedition, adjustable before starting and subject to playtest validation. Retries consume the attempt allowance.
- If a limit is reached or any attempt leaves usage unknown, pause before further decisions. The user can explicitly increase a limit, continue with the uncertainty acknowledged, or switch to the baseline.

## Comparison provenance

- Record scenario and simulation versions, baseline version, the resolved Jev model, decision-prompt version, and the pricing used.
- Clearly identify mismatched conditions and missing historical usage.
- A single expedition demonstrates only that expedition's outcome. Claims of consistent improvement require repeated matched runs, including losses and failures.

## Existing constraints to preserve

- Pending inference pauses expedition time and modeled evolution, as recorded in [ADR 0001](adr/0001-pause-expedition-time-during-decisions.md). Request latency remains an operational metric.
- Replay uses recorded choices and performs no inference. Existing expedition records must retain the simulation settings under which they were recorded when longer expeditions are introduced.

## Implementation evidence

- The existing baseline receives the objective, instructions, and observed sample descriptions but does not use those fields to choose actions. Neither controller receives the hidden sample classifications or numeric sample scores.
- The current replay path can run without a Jev API key. The repository contains scripted test histories, but no tracked authentic Jev expedition recording is available for a guided demo.
- The scene already supports orbit and rover-follow cameras. Fullscreen behavior and touch-camera coverage still need work.

## Validation work after the design interview

- The fullscreen prototype has been reviewed and layout A selected. Validate its final implementation at desktop and narrow viewport sizes.
- Tune exact map dimensions, travel distances, preset parameters, and request volume against the agreed expedition duration and sample count.
- Verify that the stronger baseline uses general observed-evidence rules instead of hidden sample classifications or sample-specific answers.
- Capture and check the guided replay's provenance after the new decision and usage records are available.

## Prototype handoff

The fullscreen layout study is preserved on branch `codex/fullscreen-prototype`, with its question, run command, illustrative-data limitations, and verification in `docs/fullscreen-prototype.md` on that branch. It offers Expedition, Decision desk, and Comparison layouts through `?variant=A`, `?variant=B`, and `?variant=C`.

The user selected A, Expedition, as the layout reference. The world remains the primary view, with a compact status and usage header, a floating decision card and timeline, and expandable inspection panels. Carry this selection and branch reference into the future UI implementation ticket. The prototype remains a design reference; production implementation follows the next spec.
