# 12: Run and compare matched baseline expeditions

**What to build:** From a saved Jev expedition, mission control can launch a fresh baseline expedition under the same starting conditions and external schedule, then compare actual outcomes with their differences and limitations disclosed.

**Blocked by:** 03: Pause at usage limits or unknown cost; 05: Make the baseline use scientific evidence and priorities; 11: Record and reproduce intervention schedules.

**Status:** ready-for-agent

**Parent spec:** [Fullscreen Jev decision lab](../spec.md). Primary user stories: 22, 26, 42-50, 55-58, 63, 69-78.

- [x] Provide a visible action to start a new baseline expedition using a source record's supported world, mission, initial resources, simulation settings, and intervention schedule. Use baseline decisions at its own boundaries; do not replay Jev's action sequence as the baseline run.
- [x] Deliver scheduled interventions at identical expedition times and world locations while allowing routes, observations, and outcomes to diverge. Preserve each expedition's own history and the identity of the source used for matching.
- [x] Make baseline execution and subsequent comparison keyless with no provider requests. Keep the source record unchanged, and save the generated baseline expedition as a separate record with its actual baseline and simulation provenance.
- [x] Show whether scenario, simulation settings, objective, rubric, mission-priority history, and intervention schedule match. Identify differing versions, incomplete legacy data, free-text interpretation limits, manual changes, and controller mixtures instead of asserting equivalence.
- [x] Retain the existing ability to compare unmatched saved expeditions with the differences disclosed. If original conditions cannot be executed by a supported simulation version, explain that limitation instead of silently substituting current settings or contacting Jev.
- [x] Compare delivered science and safe completion first. Present measurable preset adherence using recorded definitions, energy, simulated time, delivered and undelivered cargo, provider attempts, wall-time latency, tokens, and estimated cost as separate measures.
- [x] Preserve unavailable or uncertain usage as such. Show each run's recorded prices, resolved model information, prompt/baseline versions, and within-run changes where relevant. Baseline inference usage is zero; missing historical Jev usage is not zero.
- [x] Retain failures, manual stops, stranded outcomes, ties, losses, and mixed-controller histories with clear completion status. An unexecuted same-state alternative must not be counted as a realized outcome or evidence of improvement.
- [x] Describe results as observations about the compared runs. Do not claim consistent superiority from one pair, combine trade-offs into an unexplained AI score, or add an automatic paid benchmark runner.
- [x] Test through the session boundary that baseline choices execute independently, schedules remain matched across different paths, source records stay unchanged, and no provider access occurs. Include mismatch detection, free-text limitations, uncertainty, failure, and supported legacy conditions.
- [x] Add focused browser checks for launching the baseline run and reading outcomes, conditions, attribution, and usage. Round-trip both records through saving, export/import, and inference-free replay, then run required repository checks.

Curated long-world scenarios and measured calibration are ticket 13. This ticket must already deliver an honest matched comparison using currently supported conditions.


## Comments

- Added a fresh baseline launch from saved expeditions in layout A. It runs through the existing session, uses the source's supported physical settings and captured schedule, makes independent decisions without provider access, and saves separately with source identity and actual provenance.
- Comparison now leads with delivered science and completion, discloses matching and differing conditions, separates requested missions from application times, and retains controller mixtures, failures, manual stops, free-text limitations, uncertainty, and recorded model/pricing changes. Preset adherence uses recorded definitions without combining measures into a score.
- Version 12 adds matching provenance. Supported older conditions retain their duration and cadence. Legacy schedule reconstruction remains explicitly incomplete, including when a generated record is matched again. Unsupported execution leaves the source available for inspection and export.
- Session and focused browser checks cover independent execution, schedule timing, source immutability, saving, export/import, keyless replay, failures, losses, unsupported settings, uncertain prices, and desktop/narrow layouts. Verification and the two-axis review are recorded below.
- Scope remains ticket 12. Tuned benchmark scenarios and guided replay are unchanged.


## Standards

No remaining Standards findings. Review identified a reset regression and a duplicated comparison calculation. Reset now exits the keyless matched session, restores normal live setup and Jev selection, clears the prior matching association, and retains saved records and accounting. The UI uses the tested comparison result for objective and rubric checks. Re-review confirmed both fixes.

## Spec

No remaining Spec findings. Review identified the same reset regression against the parent spec's live-Jev workflow. The fix and its browser regression check preserve that workflow. Re-review found no further missing requirements, incorrect behavior, or scope creep.

Review totals: Standards 0 remaining findings; Spec 0 remaining findings. Neither axis has an outstanding issue.

## Verification

- `bun run typecheck` and `bun run build` passed after the review fixes. The existing dependency annotation and bundle-size warnings remain.
- Final full `bun test`: 251 passed, 0 failed across 22 files, with 2,967 assertions. The nine matched-expedition scenarios also passed focused runs.
- All 56 browser scenarios were verified with installed Chromium and the scripted backend. The full run passed 54 and failed two existing keyboard/schedule and sensor-view scenarios. Both passed isolated reruns against the final code. The three new matched-expedition scenarios passed again, including the reset regression check. No timeout or production behavior was weakened to pass these checks.
- Desktop and 390-pixel comparison screenshots were inspected. Checks cover keyless launch, separate durable records, unchanged source export, JSON import/export, replay, incomplete legacy data, unsupported conditions, real SDK model metadata, unknown pricing, and restored Jev selection after Reset. No paid provider calls were made.
- `git diff --check` passed. Changes are committed on the original `main` branch.
