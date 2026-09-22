# Baseline scientific and resource rules

The measurements here use the first-release world. The baseline rules remain unchanged in ticket 07; its [expanded-world playtest](expanded-world.md#deterministic-playtests) records the current default scenario outcome.

Ticket 05 introduces `evidence-priorities-v1`. The baseline selects only complete candidates supplied by the session. It reads the effective mission, objective, observed properties, known route estimates, remaining time, battery, cargo, and detected storms. It never reads the scenario catalog, sample classifications, delivered scores, undiscovered properties, or terrain outside controller knowledge. Routing, execution, scoring, and action validity remain simulation responsibilities.

Preset mode uses the exact [version 1 settings](mission-priorities.md) supplied to Jev. Free-text mode uses Balanced defaults and ignores the instructions' meaning. The interface discloses this limitation. A free-text expedition is not a matched-priority benchmark.

## Interpreting observed evidence

The baseline uses a small English phrase heuristic. Inspection must reveal properties before collection can qualify. Unknown properties remain unknown, even when the scenario author assigned the sample a high score.

| Objective | Supported evidence, level 2 | Suggestive evidence, level 1 |
| --- | --- | --- |
| Investigate past water | flowing water, rounded grains, hydrated mineral or minerals | layered sediment, fluid alteration, clay |
| Find unusual minerals | rare mineral, unusual mineral | uncommon mineral, crystalline inclusions |

Matching ignores case. A property can contain these phrases within a longer description. Periods and semicolons split clauses. Clauses containing the words `no`, `not`, `without`, `absent`, `absence`, `lack`, or `lacks` contribute no positive evidence. `possible`, `possibly`, `may`, `trace`, `traces`, `suggest`, and `suggests` cap a clause's level at 1. The strongest recognized clause establishes the level, so repeated phrases cannot inflate it. The record retains the matching original property strings.

An inspected sample with no recognized evidence is marked `no-match` and is not collected. That means the code did not recognize evidence, not that it established an unrelated scientific classification. The heuristic can miss synonyms, misread complex negation, or misinterpret a description. It is not general language understanding. Levels 1 and 2 are heuristic ranks, not the rubric's 5 and 10 science points. Only the simulator's delivery scoring establishes credit.

## Planning and ranking

For each inspect, collect, or explore candidate, the baseline records a planning estimate. It assumes the rover retraces the offered outbound journey and then follows the cheapest-energy currently offered return route. Ties for that return use duration, position, and identity. At base, a return leg costs zero. Without a known return route or a known base at the current position, further opportunities do not qualify.

- Planned energy is twice outbound energy, plus the current return-route energy, plus the preset's requested reserve.
- Planned duration is twice outbound travel time, plus the current return-route duration, plus a ten-second interaction allowance.
- An opportunity qualifies only when planned energy fits the battery and planned duration is strictly below remaining expedition time. Collection also requires recognized inspected evidence.

These are conservative controller estimates, not pathfinding or physical constraints. They can reject a trip that a better planner could complete. Reversing a journey, changed terrain knowledge, and future storms can invalidate the estimate. Other controllers can still select every offered action, including actions this baseline rejects.

Eligible opportunities receive this dimensionless utility:

`benefit - energyWeight × outboundEnergy / 10 - outboundTravelMs / 60000`

| Opportunity | Benefit |
| --- | --- |
| Inspect unknown properties | `0.5 × scienceWeight + explorationWeight` |
| Collect inspected evidence | `evidenceLevel × scienceWeight + deliveryWeight / cargoCapacity` |
| Explore a frontier | `1.5 × explorationWeight` |

The fixed coefficients are part of this baseline version. Inspection's 0.5 is the value of investigating an unknown opportunity, not an inferred sample property. Utilities rank actions; they are not probabilities, expected science scores, or comparisons of Jev quality. Highest utility wins even when all eligible utilities are negative. Exact ties use shortest travel time, then east, then north, then stable candidate identity. IDs and labels never provide scientific value.

## Rule order

1. Recharge at base when at least 10% of battery capacity is missing. A final recharge may finish only partially before timeout.
2. Return if the cheapest offered return route leaves no more than the requested energy reserve.
3. Return with cargo if remaining time is at most that return duration plus 15 seconds.
4. Deliver full cargo.
5. Retain the existing one-interval wait after a completed frontier survey.
6. Rank eligible opportunities. A return with cargo has utility `deliveryWeight × cargoCount / cargoCapacity` minus its weighted route cost. Deliver if that utility is at least the best opportunity's. Also deliver when no eligible science opportunity remains and delivery weight is at least exploration weight. This lets Explore more continue surveying with spare cargo capacity.
7. Choose the best eligible opportunity, or return for recharge when none qualifies away from base. Otherwise wait.

Before executing a selected exposed route, wait if a detected storm expires within ten seconds and waiting plus the conservative journey and interaction allowance fits the remaining time. Route estimates already include known storm costs and expiry. Crossing and offered detour candidates compete by the same weights and eligibility rules. Undetected storms cannot affect selection. The rover can still make an unsuccessful trip.

## Inspecting and replaying decisions

The decision timeline displays the baseline version, selected code rule, effective preference source, return candidate, every opportunity's matched properties, planning estimates, utility, and any exclusion. The original input supplies the battery, mission revision, cargo, remaining time, observations, and route estimates behind the explanation. No Jev reasoning transcript is generated.

Version 6 records store this evidence in applied baseline decisions and their corresponding events. Imports validate the version, shape, candidate references, observed property references, eligibility consistency, rule applicability to the action and input, and history agreement. Editing matching history copies cannot relabel a collection as a recharge or return. Jev and scripted decisions do not acquire baseline attribution. Explicit baseline continuation records the existing controller transition; failure never triggers automatic takeover.

Replay executes saved choices and copies saved rule evidence. It never calls a controller or recalculates choices with the current strategy. Versions 1 through 5 remain supported; missing historical baseline versions and explanations stay unavailable. `tests/fixtures/legacy-baseline-v5.json` was captured from the ticket 04 session at commit `ce564809a4e3aed7c583a916b0c8ecb8950a3c04`, before changing the controller. It contains a Conserve energy preset and the old baseline collecting a mineral specimen under the past-water objective.

## Deterministic checks and limits

Run `bun test tests/baseline.test.ts tests/energy.test.ts tests/storm.test.ts tests/replay.test.ts` and `bun run test:browser browser/baseline.spec.ts`. Tests drive the session API. They cover unknown properties, changed evidence and objectives, negation, relabeling, preset tradeoffs, return reserves, time pressure, multiple deliveries, recharge, storm detours and waiting, explicit continuation, validated records, and legacy replay. Physical failure scenarios use an explicitly greedy script when they need a trip this baseline now avoids. No paid inference is used.

On the unchanged Ochre Basin layout, Balanced defaults deliver Sample A at 42 seconds for past water and Sample B at 146 seconds for unusual minerals. Each earns 10 points and ends at base with no cargo. With ticket 06's decision cadence, past water uses 112 energy units and unusual minerals uses 108 over the complete five-minute run. They discover and inspect one and two samples respectively. These measured runs establish behavior in this small scenario, not optimality or an advantage over Jev. Larger-world tuning and matched comparisons remain separate tickets.
