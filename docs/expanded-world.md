# Expanded Ochre Basin

Ticket [07](../.scratch/jev-decision-lab/issues/07-explore-a-larger-world-over-longer-expeditions.md) authors `ochre-basin-v6`. It has 42 × 38 cells, exactly four times the earlier 21 × 19 area, and twelve samples in three regions. Base is at (16, 24). One rover explores for 1,080 simulated seconds, or eighteen minutes.

## Conditions and versions

| Parameter | Value |
| --- | --- |
| Scenario | `ochre-basin-v6` |
| Simulation rules | `grid-expedition-v1` |
| Record format | Version 8 |
| Decision cadence; baseline | `meaningful-boundaries-v1`; `evidence-priorities-v1` |
| Duration; fixed step | 1,080 seconds; 100 ms |
| Battery capacity and initial charge | 160 units |
| Cargo capacity | Two samples |
| Movement per cell | Plain: 4 seconds / 2 energy; rough: 8 seconds / 4 energy |
| Inspection; collection; bounded wait | 6 seconds; 4 seconds; 5 seconds |
| Recharge | 5 units per second, only at base |
| Sensing | 3 cells normally; 1.5 inside the storm |
| Storm | Center (28, 24), radius 4.5, 45 seconds, movement energy ×3 |
| Delivery rubric | Unrelated: 0; suggestive: 5; strong evidence: 10 |

The larger battery supports return journeys from every sample in clear weather. It does not change per-cell costs, recharge rate, the objective rubric, or action validation. A controller can still strand the rover. Speed changes wall time used for viewing, while the simulation steps and five-second provider deadline retain their previous meaning. Pending decisions and manual pauses freeze modeled evolution under ADR 0001.

Scenario duration and battery capacity are recorded in the scenario and as actual starting conditions. Scenarios without these fields retain the earlier 300-second / 100-unit defaults. All new records identify their simulation rules. Replay verifies every recorded setting against supported rules before executing history. Unsupported simulation versions and settings are rejected.

Versions 1 through 7 retain their original layouts, five-minute duration, battery, mission, cadence, accounting, and recorded choices. The version 7 fixture was captured from the original `5df7b455` session before this change; it includes inspection, delivery, and recharge. Existing fixtures cover versions 1 through 6, including an original timeout. Import, replay, and inspection preserve the source and perform no inference. The previous world remains an explicit regression fixture, not another playable world in the UI.

## Research and travel

Western delta covers x=0 through 24, z=18 through 37. It mixes sedimentary evidence with ambiguous veins and a distant southern sample. Northern highlands covers x=0 through 24, z=0 through 17. It has rough approaches, strong evidence for both objectives at H, mineral evidence at I, ambiguous J, and unproductive impact glass at K. Eastern volcanic field covers x=25 through 41, z=0 through 37. It offers mineral evidence around the storm center, ambiguous C, ordinary basalt at D, and distant mineral-bearing L.

Region names and terrain colors appear only for sensed or remembered cells. They supply no sample classification. The labeled debugging view can show all regions and sample locations, but it reads a detached projection and cannot alter rover knowledge. Inspection reveals properties, collection occupies cargo, and delivery applies the authored classification for the fixed objective. Classifications never enter either controller's input.

The following measurements use a separate fully observed session solely to obtain route estimates from base. Scored playtests retain three-cell sensing. Time and energy are one-way, clear-weather shortest-time routes with the authored obstacles and rough terrain. Return routes can differ after further discovery.

| Sample | Region | Position | Route cells | Seconds | Energy | Water / minerals classification |
| --- | --- | --- | --- | --- | --- | --- |
| A | Delta | (20, 24) | 4 | 16 | 8 | Strong / unrelated |
| E | Delta | (4, 28) | 16 | 72 | 36 | Strong / unrelated |
| F | Delta | (7, 34) | 19 | 80 | 40 | Suggestive / unrelated |
| G | Delta | (9, 19) | 12 | 48 | 24 | Suggestive / suggestive |
| H | Highlands | (5, 4) | 31 | 128 | 64 | Strong / strong |
| I | Highlands | (14, 3) | 23 | 96 | 48 | Unrelated / strong |
| J | Highlands | (22, 5) | 25 | 104 | 52 | Suggestive / suggestive |
| K | Highlands | (11, 10) | 19 | 80 | 40 | Unrelated / unrelated |
| B | Volcanic field | (28, 24) | 12 | 56 | 28 | Unrelated / strong |
| C | Volcanic field | (30, 16) | 22 | 92 | 46 | Suggestive / suggestive |
| D | Volcanic field | (38, 30) | 28 | 116 | 58 | Unrelated / unrelated |
| L | Volcanic field | (35, 9) | 34 | 144 | 72 | Suggestive / strong |

The classifications above are author/debugging information. Sample labels carry no scientific answer. Clear properties include rounded grains deposited by flowing water and rare mineral intergrowths. Ambiguous properties include possible fluid alteration, uncommon traces, and competing wind-deposition explanations.

Even an ideal tour cannot deliver all twelve samples in eighteen minutes. With two cargo slots, each closed trip requires at least one base-to-sample leg per delivered sample. The sum of their Manhattan distances is 245 cells. Ignoring obstacles, rough terrain, discovery, and inspection gives a lower bound of 980 seconds moving and 48 seconds collecting. Moving consumes at least 490 energy, so the initial 160 units require at least 66 seconds of recharging. This already totals 1,094 seconds. Inspecting every sample adds another 72 seconds. Actual routes and decisions increase that cost.

## Deterministic playtests

Reproduce with Bun 1.4.2:

```sh
bun scripts/playtest-expanded-world.ts
bun test tests/expanded-world.test.ts
bun run test:browser browser/expanded-world.spec.ts
```

The survey chooses only offered candidates and observed samples. It travels east, then west and north, returns with full cargo or at a resource margin, and recharges. Compass preferences depend on delivered sample count, not hidden sample coordinates. This is a feasibility script, not a new baseline or a Jev quality evaluation.

All measured runs below use Investigate past water. Energy is cumulative consumption, independent of recharge. A+B fill both slots on the first trip. G+H fill them again on the second. K occupies a slot but earns no science, making wasted collection observable.

| Controller / conditions | Deliveries at expedition seconds | Score | Discovered / inspected | Energy / final battery | Decisions | Ending |
| --- | --- | --- | --- | --- | --- | --- |
| Survey, clear | A+B at 132; G+H at 740; K at 1,068 | 25 | 6 / 5 | 476 / 74 | 39 | Timeout at 1,080s |
| Survey, storm introduced at 90s | A+B at 132; G+H at 740.8; K at 1,068.8 | 25 | 6 / 5 | 480 / 70 | 42 | Timeout at 1,080s |
| Survey without recharge or return reserve | A+B at 132 | 10 | 2 / 2 | 160 / 0 | 22 | Stranded at 340s |
| Existing baseline, clear | A at 42 | 10 | 4 / 2 | 404 / 160 | 83 | Timeout at 1,080s |

The baseline remains playable but leaves most science behind. Its rules and presets are unchanged by this ticket; benchmark calibration remains ticket 13. The survey demonstrates three viable deliveries while preserving unfavorable outcomes. The storm run shows the existing hazard can affect the longer expedition; the earlier isolated crossing/waiting/detour tests retain their original five-minute scenarios.

The real backend and SDK also execute the successful survey against scripted provider responses, with 39 confirmed attempts, no retries, and knowledge growing beyond the entire earlier map's 399 cells. This fits the default 250-attempt allowance. These are scripted responses, not paid or authentic Jev evidence. Live scientific quality remains unevaluated.

The measured clear survey takes about 1.5 seconds of local computation to simulate eighteen minutes; the baseline takes about three seconds on the implementation machine. Their JSON records are about 8.6 MB and 21.4 MB, below the existing 32 MB import limit. These timings describe this machine, not a performance guarantee. Sensor projection scans the current footprint instead of the entire map on each step. Browser checks cover the normal world, debugging, orbit/follow, coverage, pause/reset/stop, desktop and narrow screens, and the longer timer. The camera fits recorded dimensions and viewport aspect while preserving follow and orbit restoration.
