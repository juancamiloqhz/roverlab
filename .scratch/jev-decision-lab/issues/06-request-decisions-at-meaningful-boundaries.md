# 06: Request decisions at meaningful boundaries

**What to build:** Mission control can see why the rover requested a decision, and routine travel across the map proceeds without a separate Jev request for every render or newly visible cell.

**Blocked by:** 04: Choose shared priorities or free-text instructions.

**Status:** ready-for-agent

**Parent spec:** [Fullscreen Jev decision lab](../spec.md). Primary user stories: 1, 17, 23, 28-30, 35, 70, 74-77, 79.

- [x] Request reconsideration at meaningful boundaries: expedition start, completed actions, newly available scientific evidence, changed priorities or instructions, detected or changed hazards, and resource thresholds that affect a choice.
- [x] Define and document the relevant resource thresholds and safe action boundaries. Coalesce changes that reach one boundary into one context and decision; preserve all contributing triggers in the record.
- [x] Ordinary travel, rendering, and discovery of another routine terrain cell do not independently create an inference request. Preserve useful observations and memory while deferring reconsideration appropriately; reducing requests must not suppress scientific evidence or consequential hazard changes.
- [x] Show the recorded trigger or triggers with each decision in the existing timeline and decision evidence. The record must describe the state actually supplied to the controller, not reconstruct a reason from later rover state.
- [x] Keep Jev responsible for selecting one supplied action and target. Code continues to own candidate construction, navigation, arithmetic, action progress, and scientific scoring.
- [x] Preserve one decision in flight and ADR 0001: pending inference freezes expedition time, movement, resources, and storm evolution while camera and interface interaction remain responsive. Paused wall time must not become catch-up simulation time after settlement.
- [x] Preserve bounded validation, cancellation, obsolete-response rejection, the five-second total deadline, and at most one automatic retry. Coalescing must respect any usage guards already present and must not silently choose the baseline after failure.
- [x] Persist the triggers and any changed simulation or prompt provenance through local saving, validated import/export, and inference-free replay. Supported historical decisions retain their original trigger meaning and simulation behavior.
- [x] Through the session boundary and a scripted provider, demonstrate that a routine multi-cell route does not create repeated requests, each consequential change can cause reconsideration, and simultaneous changes produce one request with the complete context. Check request counts, not just a helper's return value.
- [x] Verify updates during pending inference, action completion, storm changes, resource threshold crossings, and paused time with controlled clocks. Add focused browser coverage for visible triggers and choosing versus execution, then run required repository checks without paid calls.

The larger authored world is ticket 07. Spatial inspection and teaching mode are ticket 09. This ticket can demonstrate the new decision cadence on the existing world.


## Comments

- Implemented ticket 06 only. `meaningful-boundaries-v1` coalesces scientific, mission, hazard, resource, and completion triggers at safe boundaries. Routine terrain discovery still updates observations and memory without independently requesting a choice. See [decision cadence](../../../docs/decision-cadence.md) for thresholds and interruption rules.
- Version 7 records retain every contributing trigger kind in the exact controller input. The timeline shows those triggers in live, saved, and replayed decisions; the action panel distinguishes choosing, executing, paused, failed, and usage-paused states. The changed provider context records prompt version `rover-action-v3`.
- Historical versions 1 through 6 keep their original cadence and reasons during replay without inference. The version 6 fixture was captured from the original `0d0081e` session before implementation. Pending requests retain cancellation, usage guards, frozen simulated time, stale-result rejection, and explicit recovery.
- The scripted-provider route test makes one request across three cells, compared with four before this change. Resource warnings request reconsideration without forcing a safe action. Measured playtests now include failed deliveries by the old directed survey because it no longer replans on every newly seen cell. Those outcomes are documented in [expedition tuning](../../../docs/expedition-tuning.md); the world was not retuned.

### Standards review

No documented-standard violations or actionable smell findings. The change follows Bun tooling, domain vocabulary, local record conventions, and ADR 0001. Shared schemas define the trigger vocabulary, and compatibility branches preserve historical behavior.

### Spec review

No missing requirements, scope creep, or incorrect behavior found. Review checked 80 deterministic combinations of mission edits, storms, simulation progress, validated export/import, and replay against final snapshots. A pending-storm trigger-ordering issue found during review was fixed with a failing regression followed by passing cadence, storm, and replay checks. The reviewer confirmed the fix.

Final review totals: Standards 0 remaining findings; Spec 0 remaining findings.

### Verification

- `bun run typecheck` and `bun run build` passed. Existing dependency annotation and bundle-size warnings remain.
- Final `bun test`: 183 passed, 0 failed across 17 files.
- The complete browser run exercised all 33 scenarios. Thirty-one passed; the science timing and storm objective setup depended on the earlier cadence. Both were updated and passed a focused rerun alongside the new cadence check, 3 passed and 0 failed.
- Browser checks used installed Chromium, controlled clocks, and the real backend/SDK with scripted provider transport. No paid inference was used.
- `git diff --check` passed.
