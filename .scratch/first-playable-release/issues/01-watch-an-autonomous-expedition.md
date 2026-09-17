# 01: Watch an autonomous expedition

**What to build:** Start a local 3D expedition and watch a baseline-controlled rover travel, wait, pause, reset, and finish.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] Run the React/TypeScript browser application locally using Bun and Vite, with a visible planetary surface, base, moving rover, and orbit camera, without an API key.
- [x] Pin a tested Bun version, commit its generated dependency lockfile, and provide Bun-based dependency installation and project scripts. Run Vite development/build through Bun explicitly. Use Bun's test runner for expedition scenarios, with a separate TypeScript typechecking step and the agreed browser check.
- [x] Use a framework-independent fixed-step expedition session driven by the same commands and events as the interface; rendering and camera updates do not advance expedition time.
- [x] A baseline controller chooses supplied exploration targets and bounded waits; grid navigation executes those actions autonomously without direct piloting.
- [x] Mission control can start, pause/resume, reset, stop, and select 1×, 2×, or 4× playback; show the current action and remaining expedition time.
- [x] Waiting and movement consume expedition time. A five-minute timeout or manual stop ends the expedition and displays the ending condition.
- [x] Reset restores the authored starting state. Identical actions and timed events produce the same simulated outcome at every playback speed.
- [x] Capture the starting conditions and ordered lifecycle/action events as the expedition runs so later recording can use the actual history.
- [x] Verify the start-to-finish journey through the public expedition boundary with controlled time, plus a browser smoke check for the scene and controls. Document the working local start and verification commands.

## Comments

### Implementation completed — 2026-09-16

Implemented only ticket 01. Bun 1.4.2 is pinned with its generated lockfile. The local React/Vite application shows an authored planetary area, base, animated rover, and orbit camera. A framework-independent expedition session runs deterministic 100 ms steps, baseline exploration and five-second waits, obstacle-avoiding grid navigation, lifecycle controls, playback speeds, timeout/manual-stop results, and ordered starting/lifecycle/action history. Reset restores the authored state and retains earlier events with expedition numbers.

Verification: frozen Bun install, TypeScript typechecking, Vite production build, all three Bun expedition scenarios (39 assertions), and the Chromium browser smoke check passed. Scenarios cover the complete five-minute journey, obstacle avoidance, pause/resume, stop/reset, ordered event capture, and identical results with irregular wall-time batches at all playback speeds. The browser check covers the rendered scene, autonomous motion, orbiting while paused, all playback settings, timeout, reset, and manual stop. See [README](../../../README.md#tooling) for commands. Playwright uses its Node runner through the Bun script; application execution, builds, and non-browser tests use Bun. The build reports a non-blocking Three.js bundle-size warning.

Code review used the pre-implementation commit `14c5943a46c4262a661e1947e1d8d2ac7212ae3f` as its fixed point. Standards review: no hard violations; one timing-value duplication recommendation was addressed by deriving UI timing from session state. Spec review: no actionable findings. Later-ticket features remain unimplemented.
