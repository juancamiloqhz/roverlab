# 10: Save and exchange expedition records

**What to build:** Reopen completed expeditions from browser storage and export or import their full histories as JSON.

**Blocked by:** 07: Recover explicitly from inference failures; 08: Respond to a localized dust storm

**Status:** ready-for-agent

- [ ] Save completed expeditions locally in the browser and provide a list from which mission control can reopen results and the decision timeline.
- [ ] Preserve the starting scenario, scientific objective and rubric, instruction changes, environmental events, decisions, executed actions, controller history, and results needed to reproduce the actual expedition.
- [ ] Retain baseline-only, TypeSafe-only, and explicitly mixed-controller histories, including inference usage and latency, without fabricating probabilities.
- [ ] Export a selected expedition as JSON and import a valid record through the interface; reopening an imported record displays its saved observations, timeline, and results.
- [ ] Validate the record contract before accepting imported data; reject invalid records with an understandable message instead of partially executing or trusting them as live commands.
- [ ] Exclude credentials from saved/exported records and logs. Opening saved records does not call TypeSafe or advance a live expedition.
- [ ] Round-trip expeditions containing instruction changes, storm events, failure/recovery, and controller transitions through storage and export/import, preserving the recorded data.
- [ ] Check browser persistence across reload, record selection, export/import, invalid import feedback, and absence of a key requirement when inspecting records.
