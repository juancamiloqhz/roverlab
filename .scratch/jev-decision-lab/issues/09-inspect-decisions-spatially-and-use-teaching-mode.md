# 09: Inspect decisions spatially and use teaching mode

**What to build:** Mission control can connect each recorded choice to its location in the world, inspect the exact evidence available at that time, and advance an expedition one completed decision at a time.

**Blocked by:** 06: Request decisions at meaningful boundaries; 08: Use fullscreen Expedition layout A.

**Status:** ready-for-agent

**Parent spec:** [Fullscreen Jev decision lab](../spec.md). Primary user stories: 1, 6, 10, 17, 29-38, 69-76, 78.

- [ ] Highlight offered spatial targets and the selected action's target in the world, linked to the decision card and timeline. Identify selected and candidate targets through more than color. Waiting and recharging have an explicit rover or base indication.
- [ ] Let mission control select the latest or a historical decision and inspect its recorded trigger, mission, observations and timestamps, resources, available actions, complete returned probability distribution, selected action, and available usage evidence.
- [ ] Show the selected decision's expedition time and original knowledge. Historical map highlights and evidence must not silently substitute current observations, current candidates, or the rover's later resource state.
- [ ] Selecting a decision for inspection pauses live simulated time and modeled evolution. Camera and panel interaction remain responsive, and inspection makes no new provider requests. Returning to live play preserves the session's state and any unresolved usage or failure guard.
- [ ] Add teaching mode that pauses after each completed controller choice and before its action advances. Explicit continuation executes the still-valid selected action; ordinary viewing continues automatically after a valid choice.
- [ ] Handle a pending decision settling while the user is inspecting history without unexpectedly resuming simulation. Mission edits, reset, stop, or other invalidation must not allow a held obsolete choice to execute when inspection ends.
- [ ] Distinguish choosing, code execution, manual inspection, teaching pause, usage pause, and failure. An old choice is labeled historical while a new decision is pending. A valid low-probability choice alone does not require approval outside teaching mode.
- [ ] Explain what code will execute after a choice using recorded evidence and calculated consequences. Do not invent Jev's reasoning, label probabilities as scientific value, or imply that an unexecuted action has already produced an outcome.
- [ ] Preserve the new pause/history behavior and evidence through local records, import/export, and replay without inference. Supported legacy decisions remain inspectable with missing fields visibly unavailable; inspecting them does not alter source exports.
- [ ] Test through the session boundary that inspection and teaching freeze time, movement, energy, and storm evolution; continuation resumes once; stale held actions cannot run; and playback speed or wall time does not consume the pause.
- [ ] Extend focused browser checks for map/card/timeline correspondence, historical state, non-spatial actions, keyboard and touch selection, teaching continuation, responsive cameras, and guard visibility. Run required repository checks using deterministic or scripted providers without paid calls.

The same-state baseline alternative is added in ticket 10. This ticket must make the controller's own decisions understandable without requiring that comparison first.
