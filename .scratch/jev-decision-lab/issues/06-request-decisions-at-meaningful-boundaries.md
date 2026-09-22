# 06: Request decisions at meaningful boundaries

**What to build:** Mission control can see why the rover requested a decision, and routine travel across the map proceeds without a separate Jev request for every render or newly visible cell.

**Blocked by:** 04: Choose shared priorities or free-text instructions.

**Status:** ready-for-agent

**Parent spec:** [Fullscreen Jev decision lab](../spec.md). Primary user stories: 1, 17, 23, 28-30, 35, 70, 74-77, 79.

- [ ] Request reconsideration at meaningful boundaries: expedition start, completed actions, newly available scientific evidence, changed priorities or instructions, detected or changed hazards, and resource thresholds that affect a choice.
- [ ] Define and document the relevant resource thresholds and safe action boundaries. Coalesce changes that reach one boundary into one context and decision; preserve all contributing triggers in the record.
- [ ] Ordinary travel, rendering, and discovery of another routine terrain cell do not independently create an inference request. Preserve useful observations and memory while deferring reconsideration appropriately; reducing requests must not suppress scientific evidence or consequential hazard changes.
- [ ] Show the recorded trigger or triggers with each decision in the existing timeline and decision evidence. The record must describe the state actually supplied to the controller, not reconstruct a reason from later rover state.
- [ ] Keep Jev responsible for selecting one supplied action and target. Code continues to own candidate construction, navigation, arithmetic, action progress, and scientific scoring.
- [ ] Preserve one decision in flight and ADR 0001: pending inference freezes expedition time, movement, resources, and storm evolution while camera and interface interaction remain responsive. Paused wall time must not become catch-up simulation time after settlement.
- [ ] Preserve bounded validation, cancellation, obsolete-response rejection, the five-second total deadline, and at most one automatic retry. Coalescing must respect any usage guards already present and must not silently choose the baseline after failure.
- [ ] Persist the triggers and any changed simulation or prompt provenance through local saving, validated import/export, and inference-free replay. Supported historical decisions retain their original trigger meaning and simulation behavior.
- [ ] Through the session boundary and a scripted provider, demonstrate that a routine multi-cell route does not create repeated requests, each consequential change can cause reconsideration, and simultaneous changes produce one request with the complete context. Check request counts, not just a helper's return value.
- [ ] Verify updates during pending inference, action completion, storm changes, resource threshold crossings, and paused time with controlled clocks. Add focused browser coverage for visible triggers and choosing versus execution, then run required repository checks without paid calls.

The larger authored world is ticket 07. Spatial inspection and teaching mode are ticket 09. This ticket can demonstrate the new decision cadence on the existing world.
