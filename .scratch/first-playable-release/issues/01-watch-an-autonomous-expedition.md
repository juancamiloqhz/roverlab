# 01: Watch an autonomous expedition

**What to build:** Start a local 3D expedition and watch a baseline-controlled rover travel, wait, pause, reset, and finish.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Run the React/TypeScript browser application locally using Bun and Vite, with a visible planetary surface, base, moving rover, and orbit camera, without an API key.
- [ ] Pin a tested Bun version, commit its generated dependency lockfile, and provide Bun-based dependency installation and project scripts. Run Vite development/build through Bun explicitly. Use Bun's test runner for expedition scenarios, with a separate TypeScript typechecking step and the agreed browser check.
- [ ] Use a framework-independent fixed-step expedition session driven by the same commands and events as the interface; rendering and camera updates do not advance expedition time.
- [ ] A baseline controller chooses supplied exploration targets and bounded waits; grid navigation executes those actions autonomously without direct piloting.
- [ ] Mission control can start, pause/resume, reset, stop, and select 1×, 2×, or 4× playback; show the current action and remaining expedition time.
- [ ] Waiting and movement consume expedition time. A five-minute timeout or manual stop ends the expedition and displays the ending condition.
- [ ] Reset restores the authored starting state. Identical actions and timed events produce the same simulated outcome at every playback speed.
- [ ] Capture the starting conditions and ordered lifecycle/action events as the expedition runs so later recording can use the actual history.
- [ ] Verify the start-to-finish journey through the public expedition boundary with controlled time, plus a browser smoke check for the scene and controls. Document the working local start and verification commands.
