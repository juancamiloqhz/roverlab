# 08: Use fullscreen Expedition layout A

**What to build:** The live RoverLab world fills the browser viewport using the selected Expedition layout A, with persistent mission and Jev usage telemetry and accessible controls over the scene.

**Blocked by:** 03: Pause at usage limits or unknown cost.

**Status:** ready-for-agent

**Parent spec:** [Fullscreen Jev decision lab](../spec.md). Primary user stories: 1-11, 16, 18, 30, 32-35, 51, 56, 61, 63, 78, 80.

**Prototype reference:** The preserved branch `codex/fullscreen-prototype` contains the throwaway layout study. Commit `b23f154` introduced the variants; `fcd5d9a` records the user's selection of Expedition layout A. Use A as the visual reference and rebuild its behavior against real session data. Prototype decisions, usage, terrain, and comparisons are illustrative fixtures, not authentic evidence or production implementation.

- [x] Fill the available viewport with the world, using layout A's compact top telemetry, floating latest-decision card, compact timeline, and expandable detail panels. Do not ship the prototype variant switcher or substitute B or C as the primary layout.
- [x] Keep mission status, expedition time, battery, cargo, and delivered science visible, together with current controller/Jev status, provider attempts, and estimated inference cost. Preserve accounting uncertainty and unavailable values from the real session rather than substituting prototype numbers.
- [x] Expose available evidence, mission instructions, usage, saved records, replay, and comparison in accessible panels without losing access to the world and essential controls. Integrate features already implemented; later tickets add their own new behavior to this layout.
- [x] Show distinct choosing, executing, ordinary pause, usage pause, and failed states with explicit controller attribution. While a new choice is pending, retain the previous completed choice as labeled history rather than presenting it as the new answer.
- [x] Display the chosen action, recorded trigger, returned probability when available, latency, and estimated cost on the decision card. Explain code execution separately from controller choice and label probability so it is not mistaken for science value or correctness.
- [x] Preserve orbit and rover-follow cameras, sensor coverage, timestamped observation access, and a clearly labeled full-world debugging control. Camera and presentation changes do not mutate rover knowledge or controller input.
- [x] Offer optional browser fullscreen through an explicit control and handle exit or unsupported fullscreen gracefully. The normal viewport experience remains usable. Preserve pause, speed, reset, stop, and explicit failure/usage recovery controls.
- [x] Support desktop keyboard and pointer interaction and narrow-screen touch use. Collapse panels as needed while retaining essential telemetry, usage, and pause controls. Avoid destructive overlap, horizontal page overflow, color-only status distinctions, and inaccessible panel navigation.
- [x] Use the existing session boundary as the source of live state. Saving, import/export, replay, and comparison continue to work through the new interface, including supported legacy records and visible historical versus new usage.
- [x] Extend focused browser checks at desktop and the existing 390-pixel narrow viewport. Cover panel operation, status transitions, cameras, fullscreen fallback, touch/keyboard controls, usage visibility, and recovery. Use scripted providers and screenshots for review rather than pixel-perfect prototype assertions.
- [x] Run required repository checks. No additional provider requests may be introduced by rendering, camera movement, opening panels, or inspecting records.

Spatial candidate highlights, historical selection, and teaching pauses are ticket 09. Same-state baseline comparison is ticket 10. This ticket establishes the usable fullscreen experience with currently available real data.


## Comments

- Implemented ticket 08 only, using the selected layout A as the visual reference. The existing world fills the viewport beneath live mission telemetry, controller status, provider attempts, and estimated inference cost. The latest-decision card and compact timeline use recorded session data, retain the previous choice as history while choosing, and separate controller choice from code execution.
- Mission, evidence, usage/recovery, saved expeditions, replay, comparison, and results use expandable panels. Keyboard opening, Escape, focus restoration, panel scrolling, and 390-pixel touch controls preserve access to cameras and expedition controls. Browser fullscreen is optional and reports unsupported or rejected requests.
- Failure and usage guards open recovery automatically. Closing a panel does not acknowledge a guard or resume the expedition. Incomplete accounting and confirmed-attempt lower bounds remain explicit. Saving continues while the records panel is closed, and saved inspection retains separate historical usage.
- Live state still comes from the existing session boundary. No simulation, controller, accounting, record, or replay rules changed. Spatial candidate highlights, historical selection, teaching mode, and same-state baseline comparison remain in their later tickets.

## Standards

No Standards findings. The review found no documented-standard violations or actionable code smells. The change preserves Bun tooling, the public session boundary, renderer isolation, domain vocabulary, and scripted inference checks.

## Spec

No Spec findings. The review found no missing ticket requirement, scope creep, or incorrect implementation. Layout A uses real session data, preserves existing controls and records, labels pending history and uncertain accounting, and includes desktop and narrow-screen coverage.

Review totals: Standards 0 findings; Spec 0 findings.

## Verification

- `bun run typecheck` and `bun run build` passed. Existing dependency annotation and bundle-size warnings remain.
- Full `bun test`: 199 passed, 0 failed across 18 files, with 2,545 assertions.
- All 39 browser scenarios were verified. The complete run passed 35; the remaining checks passed focused reruns after correcting automatic-panel navigation and fixing browser clocks for exact-time assertions. The allowance/import/export/replay journey exceeded its original 30-second test budget and passed in 42.0 seconds with a 60-second budget. Production inference deadlines are unchanged.
- Four new fullscreen scenarios cover live desktop telemetry, keyboard panels, 390-pixel touch interaction, pending-choice history, authentic returned probability/cost, unchanged submission counts during camera/panel interaction, and fullscreen fallback/exit. Existing checks cover recovery, uncertain usage, observation isolation, persistence, import/export, supported legacy records, replay, and comparison.
- Screenshots were inspected at desktop and 390 pixels, including open panels and usage pauses. Browser verification uses the existing scripted backend/SDK provider; no paid calls or real keys were used.
- `git diff --check` passed. Implementation is committed on the original `main` branch.
