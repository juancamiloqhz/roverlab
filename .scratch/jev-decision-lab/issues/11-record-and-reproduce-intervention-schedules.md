# 11: Record and reproduce intervention schedules

**What to build:** Mission control can run a predefined intervention schedule and retain manual mission changes or dust storms so another expedition can receive the same external events at the same simulated times and locations.

**Blocked by:** 04: Choose shared priorities or free-text instructions.

**Status:** ready-for-agent

**Parent spec:** [Fullscreen Jev decision lab](../spec.md). Primary user stories: 17, 23, 42-44, 69-76.

- [ ] Represent interventions by expedition time and event data. Mission changes carry their mode, settings or instructions, and versions; storms carry their world location and effects. Preserve the existing storm behavior and scientific objective semantics.
- [ ] Execute scheduled events at their specified expedition times regardless of rover location, decision count, observation timing, or trajectory. A storm at minute six occupies the same world region for either controller even if only one rover detects it.
- [ ] Capture manual storms and mission changes in the same reproducible schedule at their actual expedition times. Retain the requested time and distinguish any safe-boundary application of a mission change so later runs can reproduce the external request under the same application policy.
- [ ] Define deterministic ordering for simultaneous interventions and action boundaries. Every event applies once at its scheduled time rather than being shifted to the next controller decision or duplicated by replay.
- [ ] Scheduled evolution respects expedition pauses, including pending inference, inspection, and usage pauses when present. Faster playback advances the same simulation schedule; waiting in wall time does not age storms or trigger future events.
- [ ] Preserve partial perception: a scheduled storm exists at its world location, but a controller learns about it only through the existing observation rules. Scheduling cannot disclose hidden terrain or bypass safe mission changes and stale-choice rejection.
- [ ] Let mission control run and inspect at least one predefined schedule in the current interface, and inspect the captured schedule of a manually changed expedition. A general schedule editor is not required for this slice.
- [ ] Include schedule definitions, actual event history, ordering/version provenance, and mission changes in local records and validated export/import. Supported older event histories retain their meaning; replay uses recorded events without inference or source mutation.
- [ ] Through the session boundary, run different scripted trajectories under one schedule and verify identical event times, locations, and payloads despite different observations. Cover simultaneous events, paused time, speed changes, mid-action mission changes, and manual-to-scheduled reproduction.
- [ ] Add focused browser checks for running the example schedule and viewing manual event history. Preserve supported replay and run required repository checks using deterministic inputs and no paid calls.

The UI command to launch a fresh matched baseline expedition is ticket 12. The curated larger-world benchmark choices are ticket 13. This ticket proves scheduling independently on a currently supported world.
