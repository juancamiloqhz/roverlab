# 09: Inspect decisions spatially and use teaching mode

**What to build:** Mission control can connect each recorded choice to its location in the world, inspect the exact evidence available at that time, and advance an expedition one completed decision at a time.

**Blocked by:** 06: Request decisions at meaningful boundaries; 08: Use fullscreen Expedition layout A.

**Status:** ready-for-agent

**Parent spec:** [Fullscreen Jev decision lab](../spec.md). Primary user stories: 1, 6, 10, 17, 29-38, 69-76, 78.

- [x] Highlight offered spatial targets and the selected action's target in the world, linked to the decision card and timeline. Identify selected and candidate targets through more than color. Waiting and recharging have an explicit rover or base indication.
- [x] Let mission control select the latest or a historical decision and inspect its recorded trigger, mission, observations and timestamps, resources, available actions, complete returned probability distribution, selected action, and available usage evidence.
- [x] Show the selected decision's expedition time and original knowledge. Historical map highlights and evidence must not silently substitute current observations, current candidates, or the rover's later resource state.
- [x] Selecting a decision for inspection pauses live simulated time and modeled evolution. Camera and panel interaction remain responsive, and inspection makes no new provider requests. Returning to live play preserves the session's state and any unresolved usage or failure guard.
- [x] Add teaching mode that pauses after each completed controller choice and before its action advances. Explicit continuation executes the still-valid selected action; ordinary viewing continues automatically after a valid choice.
- [x] Handle a pending decision settling while the user is inspecting history without unexpectedly resuming simulation. Mission edits, reset, stop, or other invalidation must not allow a held obsolete choice to execute when inspection ends.
- [x] Distinguish choosing, code execution, manual inspection, teaching pause, usage pause, and failure. An old choice is labeled historical while a new decision is pending. A valid low-probability choice alone does not require approval outside teaching mode.
- [x] Explain what code will execute after a choice using recorded evidence and calculated consequences. Do not invent Jev's reasoning, label probabilities as scientific value, or imply that an unexecuted action has already produced an outcome.
- [x] Preserve the new pause/history behavior and evidence through local records, import/export, and replay without inference. Supported legacy decisions remain inspectable with missing fields visibly unavailable; inspecting them does not alter source exports.
- [x] Test through the session boundary that inspection and teaching freeze time, movement, energy, and storm evolution; continuation resumes once; stale held actions cannot run; and playback speed or wall time does not consume the pause.
- [x] Extend focused browser checks for map/card/timeline correspondence, historical state, non-spatial actions, keyboard and touch selection, teaching continuation, responsive cameras, and guard visibility. Run required repository checks using deterministic or scripted providers without paid calls.

The same-state baseline alternative is added in ticket 10. This ticket must make the controller's own decisions understandable without requiring that comparison first.

## Comments

- Implemented ticket 09 only within Expedition layout A. Numbered offered targets and a labeled diamond for the selected target link the map, card, timeline, and complete candidate distribution. Waiting identifies the recorded rover position; recharge identifies base.
- Decision selection pauses through the session API. Historical maps use recorded observations, memory, position, and sensor range; the inspector retains original mission, resources, timestamps, usage, and route estimates. Full-world debugging is disabled for historical maps. Return to live view leaves time paused for explicit continuation.
- Teaching holds accepted choices before action execution. Continuation revalidates the original candidate and starts it once. Pending settlement, mission edits, known storm changes, stop, reset, usage guards, and failure recovery preserve the pause and stale-choice rules.
- Version 9 records retain teaching changes, inspection selection, held choices, continuation, and invalidation. Replay viewing controls are independent of recorded pauses. Versions 1 through 8 remain supported, including a version 8 fixture generated using simulator commit `b1cb5bb9c21e5caec1182862365bd94dea348ddb`. Inspection and replay preserve source exports and issue no inference requests.

## Standards

The review found and resolved one partial-timestep regression: inspection now preserves the accumulated fraction of a simulation step in live play and replay. A public-session regression test covers 50 ms before inspection plus 50 ms after continuation, with no paused wall time consumed. No outstanding Standards findings.

## Spec

The review confirmed ticket 09 scope and no ticket 10 comparison work. Two additional replay regressions were fixed: recorded inspection state cannot replace viewer selection, and teaching can be configured after completed playback before restart. Public-session tests cover both. No outstanding Spec findings.

Review totals: Standards 0 outstanding findings; Spec 0 outstanding findings.

## Verification

- Typecheck and production build pass. The full Bun suite passes: 221 tests, 2,667 assertions.
- All 45 browser scenarios are verified with installed Chromium. The initial full run passed 37; eight passed on a focused rerun after updating previous inspection expectations and extending the two record-exchange test budgets. The six new ticket 09 scenarios passed in the full run.
- Browser coverage includes map/card/timeline selection, original historical evidence, teaching continuation, pending responses, usage guards, saved replay, legacy records, keyboard selection, and touch controls at 390 × 844. Desktop and narrow-screen screenshots were visually reviewed.
- Tests use deterministic controllers or the real TypeSafe SDK with a scripted local provider. No paid provider calls were made.
- `git diff --check` passes. Ticket 10's same-state baseline comparison remains outside this implementation.
