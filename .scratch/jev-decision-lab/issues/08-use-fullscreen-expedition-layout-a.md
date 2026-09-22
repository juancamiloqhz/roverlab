# 08: Use fullscreen Expedition layout A

**What to build:** The live RoverLab world fills the browser viewport using the selected Expedition layout A, with persistent mission and Jev usage telemetry and accessible controls over the scene.

**Blocked by:** 03: Pause at usage limits or unknown cost.

**Status:** ready-for-agent

**Parent spec:** [Fullscreen Jev decision lab](../spec.md). Primary user stories: 1-11, 16, 18, 30, 32-35, 51, 56, 61, 63, 78, 80.

**Prototype reference:** The preserved branch `codex/fullscreen-prototype` contains the throwaway layout study. Commit `b23f154` introduced the variants; `fcd5d9a` records the user's selection of Expedition layout A. Use A as the visual reference and rebuild its behavior against real session data. Prototype decisions, usage, terrain, and comparisons are illustrative fixtures, not authentic evidence or production implementation.

- [ ] Fill the available viewport with the world, using layout A's compact top telemetry, floating latest-decision card, compact timeline, and expandable detail panels. Do not ship the prototype variant switcher or substitute B or C as the primary layout.
- [ ] Keep mission status, expedition time, battery, cargo, and delivered science visible, together with current controller/Jev status, provider attempts, and estimated inference cost. Preserve accounting uncertainty and unavailable values from the real session rather than substituting prototype numbers.
- [ ] Expose available evidence, mission instructions, usage, saved records, replay, and comparison in accessible panels without losing access to the world and essential controls. Integrate features already implemented; later tickets add their own new behavior to this layout.
- [ ] Show distinct choosing, executing, ordinary pause, usage pause, and failed states with explicit controller attribution. While a new choice is pending, retain the previous completed choice as labeled history rather than presenting it as the new answer.
- [ ] Display the chosen action, recorded trigger, returned probability when available, latency, and estimated cost on the decision card. Explain code execution separately from controller choice and label probability so it is not mistaken for science value or correctness.
- [ ] Preserve orbit and rover-follow cameras, sensor coverage, timestamped observation access, and a clearly labeled full-world debugging control. Camera and presentation changes do not mutate rover knowledge or controller input.
- [ ] Offer optional browser fullscreen through an explicit control and handle exit or unsupported fullscreen gracefully. The normal viewport experience remains usable. Preserve pause, speed, reset, stop, and explicit failure/usage recovery controls.
- [ ] Support desktop keyboard and pointer interaction and narrow-screen touch use. Collapse panels as needed while retaining essential telemetry, usage, and pause controls. Avoid destructive overlap, horizontal page overflow, color-only status distinctions, and inaccessible panel navigation.
- [ ] Use the existing session boundary as the source of live state. Saving, import/export, replay, and comparison continue to work through the new interface, including supported legacy records and visible historical versus new usage.
- [ ] Extend focused browser checks at desktop and the existing 390-pixel narrow viewport. Cover panel operation, status transitions, cameras, fullscreen fallback, touch/keyboard controls, usage visibility, and recovery. Use scripted providers and screenshots for review rather than pixel-perfect prototype assertions.
- [ ] Run required repository checks. No additional provider requests may be introduced by rendering, camera movement, opening panels, or inspecting records.

Spatial candidate highlights, historical selection, and teaching pauses are ticket 09. Same-state baseline comparison is ticket 10. This ticket establishes the usable fullscreen experience with currently available real data.
