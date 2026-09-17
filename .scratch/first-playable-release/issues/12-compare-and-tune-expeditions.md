# 12: Compare and tune expeditions

**What to build:** Compare saved expeditions with matching conditions and tune the scenario so decisions create meaningful tradeoffs.

**Blocked by:** 10: Save and exchange expedition records

**Status:** ready-for-agent

- [x] Provide a simple comparison of saved expeditions showing objective, starting conditions, instruction differences, controllers, science score, discoveries, inspections, energy use, ending condition, inference usage, and latency.
- [x] Identify whether the starting conditions and fixed objective/rubric match so mission control can interpret comparisons accurately; expose environmental interventions rather than hiding them as equivalent conditions.
- [x] Keep simulation metrics separate from inference latency, usage, and returned probabilities. Clearly identify mixed-controller expeditions.
- [x] Playtest representative expeditions to tune distances, action durations, energy rates, and storm duration/strength while retaining the agreed five-minute starting budget, three sample sites, two cargo slots, and scoring rules.
- [x] Demonstrate that collecting all samples requires good decisions and that returning, recharging, waiting, detouring, or accepting failure have observable costs. Document the chosen tuning and scenarios used to assess it.
- [x] Use baseline and scripted-decision expeditions for repeatable checks; live TypeSafe evaluation is optional and must not be a deterministic pass/fail requirement or a claim that TypeSafe always wins.
- [x] Verify matching/mismatching comparisons and results with controlled records, and exercise the comparison through the browser. Preserve existing simulation, timing, perception, and replay contracts when adjusting tuning.

## Comments

- Added selection of two saved or imported expeditions and a read-only comparison. Full recorded scenarios, simulation settings, effective objectives/rubrics, and storm interventions receive separate match indicators. Instruction histories and controllers remain comparison variables; mixed-controller histories are explicit. Simulation results and inference metrics use separate tables, with links to the original decision timelines for probabilities.
- Comparison pauses live simulation, performs no inference, and leaves exported records unchanged. Browser checks cover matching conditions with different instructions/controllers, changed sample properties under the same scenario identity, pre-start objective changes, changed settings, unseen storms and their timing, mixed histories, selection limits, and a narrow viewport.
- Tuned the authored scenario to `ochre-basin-v5` by moving Sample C from (17, 4) to (17, 5). A deliberate survey delivers all samples at 253.2 seconds; responding to a storm at 90 seconds by waiting on affected routes delivers at 298.2 seconds. Recharge omission and unchecked storm crossings still strand the rover, and excessive waiting loses delivery credit.
- [The tuning report](../../../docs/expedition-tuning.md) records the chosen parameters, baseline and scripted results for both objectives, isolated crossing/wait/detour costs, parameter sweeps, and limitations. Reproduce with `bun scripts/playtest-tuning.ts --sweep`.
- The five-minute budget, three sites, two cargo slots, 0/5/10 delivery rules, simulation timings, energy rates, and record format remain unchanged. Session checks replay earlier and tuned layouts at all playback speeds. Scope remains ticket 12; no live TypeSafe evaluation or paid calls were used.

### Standards review

No findings. Reviewed all 12 staged files against starting commit `fd351ecb22de51feccde7e46e6bcaf12aeb03d02`. No documented-standard breaches or material code smells identified. Bun tooling, domain terminology, module boundaries, recorded-condition isolation, and public-session/browser testing follow repository guidance.

### Spec review

No findings. The change fulfills ticket 12 without scope creep. Comparison checks complete recorded conditions, the effective objective/rubric, and storm interventions while treating instructions/controllers as comparison variables. Mixed controllers are explicit; simulation outcomes and inference metrics remain separate. The tuning report and repeatable scenarios demonstrate delivery feasibility and the costs of returning, recharging, waiting, crossing, detouring, and failure. The layout adjustment preserves the required budget, sample count, cargo capacity, scoring, and replay contracts.

Review totals: Standards 0 findings; Spec 0 findings. No outstanding issues on either axis.

### Final verification

`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/local/bin/chromium bun run check` passed under Bun 1.4.2: typechecking, production build, all 98 Bun scenarios, and all 21 Playwright browser checks. Focused comparison/record browser checks and tuning scenarios passed during implementation. The repeatable tuning sweep completed; desktop and narrow-screen comparison screenshots were visually inspected. Existing dependency-annotation, bundle-size, and Node browser-runner warnings remain. Verification used scripted inference only, with no live credentials or paid calls.
