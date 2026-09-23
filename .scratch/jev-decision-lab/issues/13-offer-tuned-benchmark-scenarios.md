# 13: Offer tuned benchmark scenarios

**What to build:** Mission control can select documented benchmark scenarios on the larger world that expose scientific, resource, priority, and storm trade-offs within the longer expedition and request limits.

**Blocked by:** 06: Request decisions at meaningful boundaries; 07: Explore a larger world over longer expeditions; 12: Run and compare matched baseline expeditions.

**Status:** ready-for-agent

**Parent spec:** [Fullscreen Jev decision lab](../spec.md). Primary user stories: 12-15, 21, 22, 28, 40-50, 59, 70, 75-79.

- [x] Offer a small documented set of selectable benchmark scenarios on the single authored world, covering scientific evidence interpretation, changed mission priorities, and dust-storm response. Each specifies starting conditions, a fixed objective and rubric, preset settings, and an intervention schedule.
- [x] Let mission control inspect the selected scenario's conditions, run it, and use the matched-baseline comparison flow. Scenario configuration must not disclose hidden classifications or sample scores to controllers.
- [x] Calibrate travel distances, sample placement, resources, preset parameters, and schedules within the agreed bounds: approximately four times the original area, three regions, 10 to 12 sites, and a 15-to-20-minute simulated budget.
- [x] Demonstrate viable multiple deliveries, competing opportunities, useful exploration and inspection, avoidable failures, and time pressure. Include clear and ambiguous evidence. Do not make every action equally successful or prescribe a Jev-winning route.
- [x] Use the improved baseline and deterministic scripted expeditions to measure full-run outcomes for the scenarios and all three presets. Include adverse conditions and compare the same external schedule across different trajectories.
- [x] Measure decisions and provider-attempt demand using controlled provider behavior, including the effect of coalesced triggers. Normal scenarios must fit the default 250-attempt allowance without per-cell request spam; failure and retry cases must still stop at configured guards.
- [x] Document the actual calibrated parameters, scenario/simulation/baseline/preset versions, measured outcomes, and known trade-offs. Identify scripted-provider measurements as test evidence rather than authentic Jev quality or spending. Do not invent live token usage to claim the dollar allowance is sufficient.
- [x] Preserve previous supported records when tuning settings or authored data. Newly captured records retain the exact selected scenario and versions, and replay their original outcomes without inference. Comparison discloses changed conditions rather than pooling them silently.
- [x] Exercise complete long runs and adverse scenarios through the session boundary with deterministic clocks and inputs. Verify multiple trips, scoring, event timing, completion states, request guards, and record round trips at the public boundary.
- [x] Add focused browser coverage for choosing, inspecting, running, and comparing a benchmark, plus a usability check of the larger world under the fullscreen layout when available. Run the repository's required checks without paid inference.

Authentic Jev capture and its guided presentation are ticket 14. This ticket publishes playable and measured benchmark scenarios without claiming that deterministic test results establish Jev's effectiveness.


## Comments

Implemented on the current `main` branch. Evidence survey, Changing priorities, and Storm response are selectable in layout A's Mission panel. Each installs its objective, versioned preset, and expedition-time schedule through the session boundary. Mission control can inspect the conditions, run either controller, and launch a fresh matched baseline from its saved record.

The calibration retains `ochre-basin-v6`, the eighteen-minute budget, simulation rates, and all three version 1 presets. [Measured calibration](../../../docs/benchmark-scenarios.md) documents eighteen normal scenario/preset/strategy runs and three adverse runs, with real SDK measurements against a scripted provider. Normal runs need 39–87 attempts. Synthetic usage does not establish live Jev quality or dollar-budget sufficiency. Authentic capture and guided replay remain ticket 14.

Version 13 records retain the benchmark identity and description alongside exact conditions and histories. Comparisons disclose different benchmark editions and actual conditions. Replay uses the saved data without inference. A version 12 fixture captured before this implementation joins the existing legacy coverage. Reset restores a benchmark's initial objective, preferences, and schedule.

The focused session checks pass, covering full expeditions, multiple deliveries, scoring, safe-boundary schedule application across different paths, coalesced triggers, usage guards, source preservation, and record round trips. Full-suite and code-review results follow below.


## Standards

No documented-standard violations or actionable baseline smells found. The change follows Bun tooling and public-session test conventions, uses the glossary's terminology, keeps benchmark labels outside controller input, and preserves frozen expedition time during inference and usage pauses.

## Spec

No remaining Spec findings. Independent review confirmed ticket 13's selection, conditions, calibrated schedules, matched-baseline flow, measurements, and versioned replay. Follow-up review identified an ambiguous Reset explanation. The final UI and documentation distinguish restoring a directly selected benchmark from exiting a matched baseline to free exploration. Re-review confirmed the correction. Authentic capture and guided replay remain ticket 14.

Review totals: Standards 0 findings; Spec 0 remaining findings, with one wording issue corrected. Neither axis has an outstanding issue.

## Verification

- `bun run typecheck` and `bun run build` passed, including after the wording correction. Existing dependency annotation and bundle-size warnings remain.
- Full `bun test`: 266 passed, 0 failed across 23 files, with 4,179 assertions. The 15 benchmark session scenarios also passed their focused run.
- Full browser suite with installed Chromium: 57 passed and one existing keyboard/Escape schedule check failed. That check had also failed intermittently in ticket 12. The final focused run of `browser/benchmarks.spec.ts` and `browser/interventions.spec.ts` passed all four checks, including the same unmodified keyboard assertion. No timeout, assertion, or production keyboard behavior was weakened.
- Desktop and 390-pixel benchmark screenshots were inspected, along with the full-world desktop view. Layout A controls, telemetry, scrolling, camera modes, pause, selection, inspection, complete runs, and matched comparison were verified. Both benchmark browser checks passed again after the wording correction.
- `bun scripts/playtest-benchmarks.ts` and its `--provider` variant completed all eighteen normal matrix runs and three adverse runs. The latter uses the real backend and SDK with a scripted transport. No paid inference was used.
- `git diff --check` passed. Work is committed on the original `main` branch.
