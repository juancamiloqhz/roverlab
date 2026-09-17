# 12: Compare and tune expeditions

**What to build:** Compare saved expeditions with matching conditions and tune the scenario so decisions create meaningful tradeoffs.

**Blocked by:** 10: Save and exchange expedition records

**Status:** ready-for-agent

- [ ] Provide a simple comparison of saved expeditions showing objective, starting conditions, instruction differences, controllers, science score, discoveries, inspections, energy use, ending condition, inference usage, and latency.
- [ ] Identify whether the starting conditions and fixed objective/rubric match so mission control can interpret comparisons accurately; expose environmental interventions rather than hiding them as equivalent conditions.
- [ ] Keep simulation metrics separate from inference latency, usage, and returned probabilities. Clearly identify mixed-controller expeditions.
- [ ] Playtest representative expeditions to tune distances, action durations, energy rates, and storm duration/strength while retaining the agreed five-minute starting budget, three sample sites, two cargo slots, and scoring rules.
- [ ] Demonstrate that collecting all samples requires good decisions and that returning, recharging, waiting, detouring, or accepting failure have observable costs. Document the chosen tuning and scenarios used to assess it.
- [ ] Use baseline and scripted-decision expeditions for repeatable checks; live TypeSafe evaluation is optional and must not be a deterministic pass/fail requirement or a claim that TypeSafe always wins.
- [ ] Verify matching/mismatching comparisons and results with controlled records, and exercise the comparison through the browser. Preserve existing simulation, timing, perception, and replay contracts when adjusting tuning.
