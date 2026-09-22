# 04: Choose shared priorities or free-text instructions

**What to build:** Mission control can choose documented mission-priority presets for a comparable experiment or use free-text instructions to explore Jev's language interpretation. The active mode and changes are visible and reproducible.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

**Parent spec:** [Fullscreen Jev decision lab](../spec.md). Primary user stories: 19-26, 43, 69-76.

- [ ] Add mutually exclusive preset-priority and free-text modes to mission setup. Preset mode offers Balanced, Conserve energy, and Explore more; free text replaces preset behavioral preferences rather than adding another competing instruction source.
- [ ] Define and document versioned structured settings for each preset. Balanced weighs scientific opportunity against delivery and resource needs; Conserve energy emphasizes energy preservation and travel cost; Explore more emphasizes acquiring knowledge. Use measurable settings rather than labels alone.
- [ ] Supply the same objective, preset settings, and rover knowledge to both controllers through the existing controller boundary. Make the active settings inspectable in the decision evidence and validated Jev request. Do not expose hidden classifications or scores.
- [ ] Define the observable measures that will describe preset adherence, including their units and limitations, so later comparison can report behavior without inventing an overall AI score. Record the definitions' version with the preset.
- [ ] Keep the selected scientific objective and delivery-scoring rubric fixed throughout an expedition. Priority or instruction edits must not change physical simulation rules or directly pilot the rover.
- [ ] Allow mission control to change the active preset or free-text instructions. Record the requested change at its expedition time and make its application at a safe action boundary unambiguous. Cancel or reject choices made obsolete by the change, preserving the existing inference pause and deadline behavior.
- [ ] Show the active mode and history in the interface. Disclose that the baseline cannot interpret arbitrary free text, and do not label such an experiment a matched-priority benchmark.
- [ ] Save mode, effective preferences, definitions, versions, and change history in expedition records. Preserve supported older free-text records under their original meaning; import/export and replay retain history without new inference or source mutation.
- [ ] Test setup, exclusivity, shared controller input, fixed objectives, safe-boundary updates, stale decisions, and legacy replay through the existing session boundary. Exercise the real backend and SDK with scripted transport when checking Jev input; do not assert a particular live model choice.
- [ ] Add focused browser checks for selecting modes, editing active preferences, and inspecting their history, then run the repository's required checks.

The improved baseline's interpretation of the shared preferences is ticket 05. Trigger coalescing is ticket 06, and externally reproducible intervention schedules are ticket 11. This ticket supplies their mission configuration and recorded changes.
