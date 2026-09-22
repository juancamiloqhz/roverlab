# 13: Offer tuned benchmark scenarios

**What to build:** Mission control can select documented benchmark scenarios on the larger world that expose scientific, resource, priority, and storm trade-offs within the longer expedition and request limits.

**Blocked by:** 06: Request decisions at meaningful boundaries; 07: Explore a larger world over longer expeditions; 12: Run and compare matched baseline expeditions.

**Status:** ready-for-agent

**Parent spec:** [Fullscreen Jev decision lab](../spec.md). Primary user stories: 12-15, 21, 22, 28, 40-50, 59, 70, 75-79.

- [ ] Offer a small documented set of selectable benchmark scenarios on the single authored world, covering scientific evidence interpretation, changed mission priorities, and dust-storm response. Each specifies starting conditions, a fixed objective and rubric, preset settings, and an intervention schedule.
- [ ] Let mission control inspect the selected scenario's conditions, run it, and use the matched-baseline comparison flow. Scenario configuration must not disclose hidden classifications or sample scores to controllers.
- [ ] Calibrate travel distances, sample placement, resources, preset parameters, and schedules within the agreed bounds: approximately four times the original area, three regions, 10 to 12 sites, and a 15-to-20-minute simulated budget.
- [ ] Demonstrate viable multiple deliveries, competing opportunities, useful exploration and inspection, avoidable failures, and time pressure. Include clear and ambiguous evidence. Do not make every action equally successful or prescribe a Jev-winning route.
- [ ] Use the improved baseline and deterministic scripted expeditions to measure full-run outcomes for the scenarios and all three presets. Include adverse conditions and compare the same external schedule across different trajectories.
- [ ] Measure decisions and provider-attempt demand using controlled provider behavior, including the effect of coalesced triggers. Normal scenarios must fit the default 250-attempt allowance without per-cell request spam; failure and retry cases must still stop at configured guards.
- [ ] Document the actual calibrated parameters, scenario/simulation/baseline/preset versions, measured outcomes, and known trade-offs. Identify scripted-provider measurements as test evidence rather than authentic Jev quality or spending. Do not invent live token usage to claim the dollar allowance is sufficient.
- [ ] Preserve previous supported records when tuning settings or authored data. Newly captured records retain the exact selected scenario and versions, and replay their original outcomes without inference. Comparison discloses changed conditions rather than pooling them silently.
- [ ] Exercise complete long runs and adverse scenarios through the session boundary with deterministic clocks and inputs. Verify multiple trips, scoring, event timing, completion states, request guards, and record round trips at the public boundary.
- [ ] Add focused browser coverage for choosing, inspecting, running, and comparing a benchmark, plus a usability check of the larger world under the fullscreen layout when available. Run the repository's required checks without paid inference.

Authentic Jev capture and its guided presentation are ticket 14. This ticket publishes playable and measured benchmark scenarios without claiming that deterministic test results establish Jev's effectiveness.
