# 11: Replay recorded expeditions

**What to build:** Watch a saved expedition unfold from its original state without making new AI requests.

**Blocked by:** 10: Save and exchange expedition records

**Status:** ready-for-agent

- [x] Start replay from a saved or imported expedition record, clearly distinguishing replay from a new live expedition.
- [x] Reconstruct its original starting conditions and objective/rubric, and apply recorded decisions, actions, instruction changes, controller transitions, and environmental events at their recorded expedition-time boundaries.
- [x] Bypass live controller selection and the inference service during replay; credentials are not required and no inference attempts are made.
- [x] Support viewing the recorded timeline and results while using playback speed and pause controls. Viewing or stopping replay does not mutate the saved record.
- [x] Reproduce the recorded final science score, discoveries, inspections, energy use, ending condition, and controller history.
- [x] Reject records that cannot be replayed under the supported record contract with a clear explanation; do not silently run a fresh AI expedition.
- [x] Verify baseline, TypeSafe, and mixed-controller records including storms and instruction changes, and compare final results at different playback speeds. Add a browser save/import-to-replay journey.

## Comments

- Added `createReplay(record)` at the public expedition session boundary. It validates the saved contract/settings, executes the recorded choices and commands through the existing simulator, and verifies events, decisions, and final results before playback starts. Replay never invokes a live controller or submits inference; original attempt/latency values remain historical metrics.
- The saved-record view now offers labeled replay with the original 3D scenario, current telemetry/instructions, a growing decision timeline, and recorded final results. Pause, resume, stop, restart, and 1×/2×/4× controls affect viewing only; replay does not mutate or republish the saved expedition.
- Added session scenarios for baseline, TypeSafe, and mixed histories, storms, instruction changes, recovery, cancelled decisions, rapid stop/reset, all ending conditions, alternate recorded scenarios, playback independence, and rejection before playback. Browser journeys exercise saved/imported replay, unchanged export, pause/camera/timeline controls, rejection feedback, and blocked-backend TypeSafe/mixed replay.
- Scope remains ticket 11. Comparison and numerical tuning remain ticket 12.

### Standards review

Reviewed all nine staged files against starting commit `096d9de9dc9ab655b23e52d21280da30ef8eb87f`. No documented-standard violations or material smell-baseline findings. Replay reuses the simulator's public execution boundary, keeps rendering separate, bypasses live controller calls, and preserves detached record reads. Tooling and domain vocabulary follow repository instructions.

### Spec review

No actionable Spec findings. Ticket 11's starting conditions, event ordering, inference bypass, playback controls, record isolation, final results, and rejection behavior are implemented. No ticket 12 scope creep was found. The independent review also exercised 40 additional scenario variations covering cancellation, storms, instructions, pauses/resumes, failure/retry, controller continuation, speed changes, and stops; all records validated and replayed successfully.

Review totals: Standards 0 findings; Spec 0 findings. No outstanding issues on either axis.

### Final verification

`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium bun run check` passed under Bun 1.4.2: typechecking, production build, all 90 Bun scenarios, and all 18 Playwright browser checks. Focused replay/record scenarios and saved/imported and blocked-backend browser replay checks also passed. The paused replay screenshot was visually inspected, including scene, camera controls, telemetry, timeline, and recorded final results. Existing dependency annotation, bundle-size, and Node browser-runner warnings remain. Verification used scripted inference only, with no live credentials or paid calls.
