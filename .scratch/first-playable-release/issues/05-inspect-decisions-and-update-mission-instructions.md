# 05: Inspect decisions and update mission instructions

**What to build:** Inspect baseline decision inputs and candidates, edit instructions, and see the rover reconsider safely.

**Blocked by:** 04: Manage energy across multiple trips

**Status:** ready-for-agent

- [x] Provide mission instructions before and during an expedition without changing the scientific objective or rubric; include the current instructions in controller context and record edits.
- [x] Show a decision timeline containing the observations and timestamped memory used, resource state, available complete action-and-target candidates, selected action, and responsible controller.
- [x] Label baseline decisions truthfully and do not invent model probabilities or reasoning text for them.
- [x] Request decisions at action completion or meaningful changes. New observations and changed instructions trigger reconsideration at the next safe travel waypoint; short interactions may finish first. Routine movement does not cause repeated decisions.
- [x] Coordinate at most one active decision and keep actions stable between reconsideration boundaries. Validate returned candidate identity and current preconditions before execution.
- [x] Associate pending results with the expedition and mission-instruction versions; reset, stop, changed instructions, and relevant state changes prevent obsolete actions from applying. Render updates do not invalidate valid decisions.
- [x] While any decision is pending, pause expedition time and all modeled evolution while keeping interface and camera interaction responsive, honoring the accepted architecture decision.
- [x] Use scripted delayed controller responses only in verification to cover freeze/resume, safe interruption, changed instructions, stale results, and reset. Verify the baseline timeline and instruction controls in the browser.


## Comments

- Implemented editable, versioned mission instructions before and during an expedition, with recorded edits and retained text on reset. The scientific objective and scoring rubric remain fixed. Baseline context includes instructions, but the UI explains that the baseline continues using its fixed rules rather than interpreting free-form preferences.
- Added a chronological, expandable decision timeline containing the original instructions/version, trigger, responsible controller, complete candidates and identities, selected action, route estimates, resources, sensor range, observations, and timestamped rover memory. No baseline probabilities or reasoning text are invented. Timeline history is read separately from frequently refreshed telemetry.
- Added one-request decision coordination, simulator-owned candidate validation against current preconditions, safe waypoint interruption for discoveries/instruction changes, and completion of short interactions before reconsideration. Timestamp refreshes alone do not request decisions. Reset, stop, and instruction edits discard obsolete requests; replacements wait for the outstanding request to settle.
- Pending requests freeze expedition time and all modeled evolution. The UI clock resumes from settlement rather than counting pending wall time; manual pause remains effective. Scripted delayed controllers are supplied only by verification, including a browser harness that exercises the real UI/session. Live TypeSafe handling and inference recovery remain tickets 06–07.
- Discovery-triggered reconsideration makes the authored baseline pursue Sample A at first discovery. Existing authored-scenario timings were updated while retaining resource, scoring, perception, and deterministic-playback checks.
- Validation passed on Bun 1.4.2: typechecking, production build, all 31 Bun scenarios, and all six Playwright checks with system Chromium. Verification includes delayed freeze/resume, safe interruption, short interactions, obsolete results after edits/reset/stop, invalid identities, isolated controller inputs, manual pause, matching science/resources across delays and speeds, historical timeline data, and responsive camera/mission controls. The existing Vite large-chunk warning remains.
- Code review completed against the starting commit with separate Standards and Spec reviewers: no documented-standard violations, actionable smells, missing requirements, incorrect behavior, or scope creep found.
