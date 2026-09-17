# 05: Inspect decisions and update mission instructions

**What to build:** Inspect baseline decision inputs and candidates, edit instructions, and see the rover reconsider safely.

**Blocked by:** 04: Manage energy across multiple trips

**Status:** ready-for-agent

- [ ] Provide mission instructions before and during an expedition without changing the scientific objective or rubric; include the current instructions in controller context and record edits.
- [ ] Show a decision timeline containing the observations and timestamped memory used, resource state, available complete action-and-target candidates, selected action, and responsible controller.
- [ ] Label baseline decisions truthfully and do not invent model probabilities or reasoning text for them.
- [ ] Request decisions at action completion or meaningful changes. New observations and changed instructions trigger reconsideration at the next safe travel waypoint; short interactions may finish first. Routine movement does not cause repeated decisions.
- [ ] Coordinate at most one active decision and keep actions stable between reconsideration boundaries. Validate returned candidate identity and current preconditions before execution.
- [ ] Associate pending results with the expedition and mission-instruction versions; reset, stop, changed instructions, and relevant state changes prevent obsolete actions from applying. Render updates do not invalidate valid decisions.
- [ ] While any decision is pending, pause expedition time and all modeled evolution while keeping interface and camera interaction responsive, honoring the accepted architecture decision.
- [ ] Use scripted delayed controller responses only in verification to cover freeze/resume, safe interruption, changed instructions, stale results, and reset. Verify the baseline timeline and instruction controls in the browser.
