# 12: Run and compare matched baseline expeditions

**What to build:** From a saved Jev expedition, mission control can launch a fresh baseline expedition under the same starting conditions and external schedule, then compare actual outcomes with their differences and limitations disclosed.

**Blocked by:** 03: Pause at usage limits or unknown cost; 05: Make the baseline use scientific evidence and priorities; 11: Record and reproduce intervention schedules.

**Status:** ready-for-agent

**Parent spec:** [Fullscreen Jev decision lab](../spec.md). Primary user stories: 22, 26, 42-50, 55-58, 63, 69-78.

- [ ] Provide a visible action to start a new baseline expedition using a source record's supported world, mission, initial resources, simulation settings, and intervention schedule. Use baseline decisions at its own boundaries; do not replay Jev's action sequence as the baseline run.
- [ ] Deliver scheduled interventions at identical expedition times and world locations while allowing routes, observations, and outcomes to diverge. Preserve each expedition's own history and the identity of the source used for matching.
- [ ] Make baseline execution and subsequent comparison keyless with no provider requests. Keep the source record unchanged, and save the generated baseline expedition as a separate record with its actual baseline and simulation provenance.
- [ ] Show whether scenario, simulation settings, objective, rubric, mission-priority history, and intervention schedule match. Identify differing versions, incomplete legacy data, free-text interpretation limits, manual changes, and controller mixtures instead of asserting equivalence.
- [ ] Retain the existing ability to compare unmatched saved expeditions with the differences disclosed. If original conditions cannot be executed by a supported simulation version, explain that limitation instead of silently substituting current settings or contacting Jev.
- [ ] Compare delivered science and safe completion first. Present measurable preset adherence using recorded definitions, energy, simulated time, delivered and undelivered cargo, provider attempts, wall-time latency, tokens, and estimated cost as separate measures.
- [ ] Preserve unavailable or uncertain usage as such. Show each run's recorded prices, resolved model information, prompt/baseline versions, and within-run changes where relevant. Baseline inference usage is zero; missing historical Jev usage is not zero.
- [ ] Retain failures, manual stops, stranded outcomes, ties, losses, and mixed-controller histories with clear completion status. An unexecuted same-state alternative must not be counted as a realized outcome or evidence of improvement.
- [ ] Describe results as observations about the compared runs. Do not claim consistent superiority from one pair, combine trade-offs into an unexplained AI score, or add an automatic paid benchmark runner.
- [ ] Test through the session boundary that baseline choices execute independently, schedules remain matched across different paths, source records stay unchanged, and no provider access occurs. Include mismatch detection, free-text limitations, uncertainty, failure, and supported legacy conditions.
- [ ] Add focused browser checks for launching the baseline run and reading outcomes, conditions, attribution, and usage. Round-trip both records through saving, export/import, and inference-free replay, then run required repository checks.

Curated long-world scenarios and measured calibration are ticket 13. This ticket must already deliver an honest matched comparison using currently supported conditions.
