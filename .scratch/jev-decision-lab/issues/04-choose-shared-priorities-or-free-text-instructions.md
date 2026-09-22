# 04: Choose shared priorities or free-text instructions

**What to build:** Mission control can choose documented mission-priority presets for a comparable experiment or use free-text instructions to explore Jev's language interpretation. The active mode and changes are visible and reproducible.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

**Parent spec:** [Fullscreen Jev decision lab](../spec.md). Primary user stories: 19-26, 43, 69-76.

- [x] Add mutually exclusive preset-priority and free-text modes to mission setup. Preset mode offers Balanced, Conserve energy, and Explore more; free text replaces preset behavioral preferences rather than adding another competing instruction source.
- [x] Define and document versioned structured settings for each preset. Balanced weighs scientific opportunity against delivery and resource needs; Conserve energy emphasizes energy preservation and travel cost; Explore more emphasizes acquiring knowledge. Use measurable settings rather than labels alone.
- [x] Supply the same objective, preset settings, and rover knowledge to both controllers through the existing controller boundary. Make the active settings inspectable in the decision evidence and validated Jev request. Do not expose hidden classifications or scores.
- [x] Define the observable measures that will describe preset adherence, including their units and limitations, so later comparison can report behavior without inventing an overall AI score. Record the definitions' version with the preset.
- [x] Keep the selected scientific objective and delivery-scoring rubric fixed throughout an expedition. Priority or instruction edits must not change physical simulation rules or directly pilot the rover.
- [x] Allow mission control to change the active preset or free-text instructions. Record the requested change at its expedition time and make its application at a safe action boundary unambiguous. Cancel or reject choices made obsolete by the change, preserving the existing inference pause and deadline behavior.
- [x] Show the active mode and history in the interface. Disclose that the baseline cannot interpret arbitrary free text, and do not label such an experiment a matched-priority benchmark.
- [x] Save mode, effective preferences, definitions, versions, and change history in expedition records. Preserve supported older free-text records under their original meaning; import/export and replay retain history without new inference or source mutation.
- [x] Test setup, exclusivity, shared controller input, fixed objectives, safe-boundary updates, stale decisions, and legacy replay through the existing session boundary. Exercise the real backend and SDK with scripted transport when checking Jev input; do not assert a particular live model choice.
- [x] Add focused browser checks for selecting modes, editing active preferences, and inspecting their history, then run the repository's required checks.

The improved baseline's interpretation of the shared preferences is ticket 05. Trigger coalescing is ticket 06, and externally reproducible intervention schedules are ticket 11. This ticket supplies their mission configuration and recorded changes.


## Comments

- Implemented ticket 04 only. Mission control can switch between free text and Balanced, Conserve energy, or Explore more. Presets carry version 1 structured weights, an energy reserve, and version 1 adherence definitions with units and limitations. See [mission priorities](../../../docs/mission-priorities.md). Free text remains the existing default, and the controller receives only the active preference source.
- Both controllers receive the same effective preferences, objective, knowledge, resources, and candidates. The backend validates definitions and compatibility fields before provider dispatch. The versioned `rover-action-v2` prompt explains the exclusive modes. The baseline's improved interpretation remains ticket 05; its current limitations are disclosed.
- Each change records its exact request time and separate safe-boundary application time. Superseded and unapplied requests remain visible. Inference cancellation, one request in flight, frozen expedition time, and the existing deadline behavior are preserved. Reset creates a fresh history from the requested preferences.
- Version 5 records retain mission definitions, revisions, requested/effective preferences, and history. Saved inspection, comparison, import/export, and replay preserve them without new inference. Versions 1 through 4 keep their original free-text meaning. The version 4 fixture was captured from `c214d58574a78b86ac142b1ac6a185afa72e9c22` with the real session, backend, and SDK using scripted transport.

### Standards review

No findings. The staged changes follow the documented repository standards. No material baseline code smells identified. The reviewer also checked the reset guard, its regression test, the perception expectation, and the legacy comparison fallback. No remaining Standards findings.

### Spec review

One replay defect was found and resolved. A cancelled request from an earlier expedition could delay application of a preset selected after reset, producing an event order that replay could not reproduce. Mission application now checks only an in-flight request belonging to the current expedition. The failing-then-passing session regression checks application timing and record import/export/replay. The reviewer rechecked the fix and found no missing requirements, scope creep, or outstanding Spec findings.

Review totals: Standards 0 findings; Spec 1 resolved, 0 outstanding. Both reviews used starting commit `c214d58574a78b86ac142b1ac6a185afa72e9c22` as their fixed point.

### Final verification

Bun 1.4.2 typechecking, the production build, and all 150 Bun tests pass. All 31 Chromium browser cases passed across focused runs, including the new mode/history and narrow-screen checks. Existing assertions for the exact controller input, record version, and prompt version were updated to the new contracts and rechecked. The narrow-screen mission panel screenshot was inspected, and the browser check confirms no horizontal overflow.

All provider transport was scripted; verification used no live key or paid requests. Existing dependency-annotation, bundle-size, and Node browser-runner warnings remain.
