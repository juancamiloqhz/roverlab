# Benchmark scenarios

Ticket [13](../.scratch/jev-decision-lab/issues/13-offer-tuned-benchmark-scenarios.md) adds three selectable benchmarks to the Mission panel in layout A. Choose a scenario before starting, inspect its objective, preset settings, and schedule, then select the keyless baseline or TypeSafe controller. Selection creates a fresh setup with the default inference limits. A completed or stopped saved expedition offers **Run matched baseline**, followed by **Compare with source expedition**.

## Selected scenarios

All three use one authored world, `ochre-basin-v6`. Each benchmark definition is version 1. The objective and 0/5/10 delivery rubric remain fixed during a run. Mission changes affect preferences, not scoring.

| Benchmark | Objective | Starting preset | External schedule |
| --- | --- | --- | --- |
| Evidence survey, `evidence-survey` | Investigate past water | Balanced | No scheduled interventions |
| Changing priorities, `changing-priorities` | Investigate past water | Explore more | Request Conserve energy at 360 seconds |
| Storm response, `storm-response` | Find unusual minerals | Balanced | At 60 seconds, introduce a storm at 26 / 24 and request Conserve energy, in that order |

The storm has radius 5 cells, lasts 180 seconds, reduces sensing to 1.5 cells inside it, and multiplies movement energy by 3. It expires at 240 seconds. Its fixed location and expedition time apply to both controllers, independently of their trajectories. Mission requests apply at safe action boundaries. The benchmark schedule replaces the world's default manual storm parameters for its scheduled event. Manual storms in free exploration keep the original 45-second duration and center 28 / 24.

The UI shows exact schedules before starting. Neither benchmark names, future schedules, hidden classifications, sample scores, nor authored properties enter controller input. Controllers learn scheduled hazards through sensing and receive mission preferences when applied. Full-world debugging remains separate from rover knowledge.

## Retained world and preference parameters

The calibration retains the larger world's geometry, sample placement, resource rules, and preset definitions. The measurements below establish viable delivery trips, resource failures, competing scientific opportunities, and distinct preset behavior with those parameters. Changing these merely to favor a controller would weaken comparison. The new calibrated variables are the predefined objective, starting preset, and external schedule, including the longer storm.

| Parameter | Value |
| --- | --- |
| World | 42 × 38 cells, four times the original area; three regions; twelve sites |
| Duration; step | 1,080 seconds; 100 ms |
| Start; cargo | Base 16 / 24; empty cargo; two slots |
| Initial battery; capacity | 160; 160 energy units |
| Normal sensing | 3 cells |
| Travel per cell, plain / rough | 4 / 8 seconds, 2 / 4 energy units |
| Inspection; collection; wait | 6; 4; 5 seconds |
| Recharge | 5 energy units per second at base |
| Delivered science | Unrelated 0; suggestive 5; strong evidence 10 |
| Default inference guards | 250 confirmed or reserved attempts; $0.10 estimated inference cost; unknown usage pauses |

[Expanded-world documentation](expanded-world.md#research-and-travel) lists every sample position, route distance, and scientific property context. Water evidence in the western delta competes with the farther northern highlands and mineral evidence in the eastern volcanic field. Ambiguous veins and possible fluid alteration require interpretation. Ordinary basalt and impact glass can consume time and cargo without earning science. Classifications in author documentation are not controller input.

The optimistic lower bound for collecting and delivering all twelve samples is 1,094 seconds, already longer than the budget, before inspection, terrain obstacles, or discovery costs. Inspection alone adds 72 seconds. The clear survey's last delivery occurs at 1,068 seconds, leaving twelve seconds. Longer routes and extra waiting can therefore lose delivery credit even with battery remaining.

Preset definition version 1 is unchanged. Settings below are science, delivery, energy, exploration weights, then the desired return reserve in energy units. Weights are dimensionless. The reserve is a preference, not a movement constraint.

| Preset | Science | Delivery | Energy | Exploration | Reserve |
| --- | --- | --- | --- | --- | --- |
| Balanced | 3 | 2 | 2 | 2 | 10 |
| Conserve energy | 2 | 2 | 5 | 1 | 20 |
| Explore more | 2 | 1 | 1 | 5 | 10 |

## Measurements

Run with Bun 1.4.2, without loading credentials:

```sh
bun scripts/playtest-benchmarks.ts
bun scripts/playtest-benchmarks.ts --provider
bun test tests/benchmarks.test.ts
bun run test:browser browser/benchmarks.spec.ts
```

The first command executes the improved baseline and deterministic compass survey directly through the session. The second runs the same choices through the real local handler and TypeSafe SDK with an in-memory scripted provider. It never contacts Jev. It also measures the unsafe survey without recharge or a return reserve. Both commands print JSON results, including event times, mission application times, remaining battery, and final coordinates.

The matrix varies the starting preset using a recorded setup request; future benchmark interventions remain unchanged. All eighteen normal runs reach the 1,080-second timeout with no cargo. Timeout alone does not guarantee safe completion. The Conserve energy survey in Evidence survey and Changing priorities ends at 16 / 23.9, just away from base after beginning another exploration step. Other rows end at base. Their saved comparisons retain that difference.

The survey uses the existing compass policy from `playtest-expanded-world.ts`. It selects only supplied candidates and inspected samples, fills cargo, reserves a return route, and recharges. It does not optimize scientific relevance or implement the preset weights. Presets still affect session resource-boundary triggers, which can change its route. It is a feasibility script, not a proposed Jev route or a substitute baseline.

In this table, decisions equal confirmed provider attempts when using the scripted provider, with zero retries. Direct runs make zero provider calls. Coalesced counts are decisions containing more than one recorded trigger.

| Scenario | Starting preset | Choice policy | Science | Delivered / trips | Discovered / inspected | Energy | Decisions / attempts | Coalesced |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Evidence | balanced | baseline | 10 | 1 / 1 | 4 / 2 | 404.00 | 83 | 3 |
| Evidence | balanced | survey | 25 | 5 / 3 | 6 / 5 | 476.00 | 39 | 7 |
| Evidence | conserve-energy | baseline | 15 | 2 / 2 | 3 / 3 | 390.00 | 87 | 4 |
| Evidence | conserve-energy | survey | 25 | 5 / 3 | 6 / 5 | 468.20 | 40 | 7 |
| Evidence | explore-more | baseline | 0 | 0 / 0 | 4 / 0 | 416.00 | 79 | 1 |
| Evidence | explore-more | survey | 25 | 5 / 3 | 6 / 5 | 476.00 | 39 | 7 |
| Priorities | balanced | baseline | 15 | 2 / 2 | 3 / 3 | 402.00 | 83 | 5 |
| Priorities | balanced | survey | 25 | 5 / 3 | 6 / 5 | 472.00 | 40 | 8 |
| Priorities | conserve-energy | baseline | 15 | 2 / 2 | 3 / 3 | 390.00 | 87 | 4 |
| Priorities | conserve-energy | survey | 25 | 5 / 3 | 6 / 5 | 468.20 | 40 | 7 |
| Priorities | explore-more | baseline | 5 | 1 / 1 | 4 / 3 | 406.00 | 81 | 4 |
| Priorities | explore-more | survey | 25 | 5 / 3 | 6 / 5 | 472.00 | 40 | 8 |
| Storm | balanced | baseline | 10 | 1 / 1 | 3 / 2 | 415.60 | 84 | 6 |
| Storm | balanced | survey | 25 | 5 / 3 | 6 / 5 | 510.00 | 41 | 9 |
| Storm | conserve-energy | baseline | 10 | 1 / 1 | 3 / 2 | 415.60 | 84 | 6 |
| Storm | conserve-energy | survey | 25 | 5 / 3 | 6 / 5 | 510.00 | 41 | 9 |
| Storm | explore-more | baseline | 15 | 2 / 2 | 3 / 3 | 420.60 | 86 | 7 |
| Storm | explore-more | survey | 25 | 5 / 3 | 6 / 5 | 510.00 | 41 | 9 |

Baseline trade-offs remain visible. Explore more discovers 622 terrain cells in Evidence survey, versus Balanced's 592, but inspects and delivers nothing. Conserve energy uses 390 energy units and earns 15 science points there, compared with Balanced's 404 energy and 10 points. The same starting preset can perform differently under an intervention schedule. These are measured outcomes of this code, not an overall ranking of presets or evidence of Jev quality.

The default survey delivers A+B at 132 seconds, G+H at 740 seconds, and K at 1,068 seconds in Evidence survey. In Changing priorities, the last delivery moves to 1,060 seconds. In Storm response, deliveries occur at 132, 739.6, and 1,059.6 seconds. Some delivered samples earn zero under the chosen objective. Inspecting, collecting, and delivering are distinct outcomes.

The storm survey consumes 510 energy units, compared with 476 for the clear default survey. Without recharge or the return reserve, the survey strands after 340 seconds in Evidence survey and Changing priorities, and after 256 seconds in Storm response. All three failed runs retain 10 delivered points and zero battery. The priorities run ends before its 360-second request, which remains visibly unissued. Failures remain in tests and the report.

Matching the default survey to a fresh baseline demonstrates identical requested schedules across different trajectories. Changing priorities requests Conserve energy at 360 seconds; it applies at 363.2 seconds for the survey and 360 seconds for the baseline. Storm response introduces and detects the storm at 60 seconds for both, then applies Conserve energy at 62 seconds for the survey and 60 seconds for the baseline. The storm expires at 240 seconds in both. Differences in safe-boundary application are disclosed separately from requested schedules.

## Request demand and its limits

All normal scripted-provider runs fit the default 250-attempt allowance. Baseline choices require 79 through 87 attempts, and survey choices 39 through 41. They discover 549 through 622 terrain cells, with multiple cells traversed between decisions. In Storm response, the baseline's 60-second decision combines storm-effects-changed, storm-detected, and mission-changed into one provider request. The default survey has nine decisions with multiple triggers. Routine terrain discovery does not issue a request per cell.

The SDK responses supply fixed synthetic usage of 1,000 input and 40 output tokens to exercise accounting. This is test data, not a measurement of actual prompts, Jev usage, spending, or quality. It cannot establish that the $0.10 allowance is sufficient for live runs. Live usage may be larger or unavailable and must obey the existing cost and uncertainty guards.

Guard checks on the actual storm benchmark cover a 503 retry consuming the second and final allowed attempt, a response with missing usage stopping before retry, and a response crossing a configured cost threshold. Expedition time and the future storm stay frozen at each guard. These records also round-trip and replay without provider access. Existing tests retain deadline, cancellation, stale response, zero allowance, and late-accounting coverage.

## Versions and historical records

| Item | Recorded version |
| --- | --- |
| Benchmarks | Each definition v1, separate IDs above |
| World | `ochre-basin-v6` |
| Simulation | `grid-expedition-v1` |
| Cadence | `meaningful-boundaries-v1` |
| Baseline | `evidence-priorities-v1` |
| Presets; adherence definitions | 1; 1 |
| Intervention schedule | `expedition-time-v1` |
| Record format | 13 |
| SDK prompt | `rover-action-v3` |

Records store benchmark identity, edition, name, and description alongside the complete starting world, mission definition, schedule, simulation settings, and subsequent edits. They also preserve each response's actual model and pricing metadata when available. The scripted provider reports `jev-1.13.0`; that string is synthetic test provenance, not an authentic model execution.

The selected benchmark identifies the setup's origin. Manual changes remain possible, and comparisons check the actual objective, world, simulation, mission requests, and schedules as well as benchmark identity and version. A matching label cannot hide changed conditions. Resetting a directly selected benchmark restores its initial objective, preferences, and schedule. Reset exits a matched baseline to free exploration. Selection returns to fresh default inference limits.

Replay executes the saved world and choices without looking up today's benchmark definition or making inference requests. Versions 1 through 12 remain supported. The version 12 fixture was captured from commit `1c194a187fb0c97c8b05713305eb1b6eb6c78b15` before this change and contains a matched baseline history. The existing legacy fixtures preserve the older worlds and rules. Missing benchmark identity stays absent rather than being guessed from a world ID.

Browser coverage selects and inspects a benchmark, runs a full baseline, launches its matched baseline, and compares results with provider routes blocked. Narrow-screen coverage checks the storm schedule, pause, reset, follow/orbit controls, debugging, telemetry, and horizontal overflow. Screenshots support visual review of layout A. Authentic Jev capture and guided replay remain ticket 14.
