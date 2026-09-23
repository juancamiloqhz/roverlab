# 11: Record and reproduce intervention schedules

**What to build:** Mission control can run a predefined intervention schedule and retain manual mission changes or dust storms so another expedition can receive the same external events at the same simulated times and locations.

**Blocked by:** 04: Choose shared priorities or free-text instructions.

**Status:** ready-for-agent

**Parent spec:** [Fullscreen Jev decision lab](../spec.md). Primary user stories: 17, 23, 42-44, 69-76.

- [x] Represent interventions by expedition time and event data. Mission changes carry their mode, settings or instructions, and versions; storms carry their world location and effects. Preserve the existing storm behavior and scientific objective semantics.
- [x] Execute scheduled events at their specified expedition times regardless of rover location, decision count, observation timing, or trajectory. A storm at minute six occupies the same world region for either controller even if only one rover detects it.
- [x] Capture manual storms and mission changes in the same reproducible schedule at their actual expedition times. Retain the requested time and distinguish any safe-boundary application of a mission change so later runs can reproduce the external request under the same application policy.
- [x] Define deterministic ordering for simultaneous interventions and action boundaries. Every event applies once at its scheduled time rather than being shifted to the next controller decision or duplicated by replay.
- [x] Scheduled evolution respects expedition pauses, including pending inference, inspection, and usage pauses when present. Faster playback advances the same simulation schedule; waiting in wall time does not age storms or trigger future events.
- [x] Preserve partial perception: a scheduled storm exists at its world location, but a controller learns about it only through the existing observation rules. Scheduling cannot disclose hidden terrain or bypass safe mission changes and stale-choice rejection.
- [x] Let mission control run and inspect at least one predefined schedule in the current interface, and inspect the captured schedule of a manually changed expedition. A general schedule editor is not required for this slice.
- [x] Include schedule definitions, actual event history, ordering/version provenance, and mission changes in local records and validated export/import. Supported older event histories retain their meaning; replay uses recorded events without inference or source mutation.
- [x] Through the session boundary, run different scripted trajectories under one schedule and verify identical event times, locations, and payloads despite different observations. Cover simultaneous events, paused time, speed changes, mid-action mission changes, and manual-to-scheduled reproduction.
- [x] Add focused browser checks for running the example schedule and viewing manual event history. Preserve supported replay and run required repository checks using deterministic inputs and no paid calls.

The UI command to launch a fresh matched baseline expedition is ticket 12. The curated larger-world benchmark choices are ticket 13. This ticket proves scheduling independently on a currently supported world.


## Comments

- Implemented ticket 11 through the existing expedition/session boundary and selected layout A. The Mission panel offers the example schedule and shows future requests, captured manual requests, storm data, mission revisions, and separate request/application times. Saved records and replay show the same history.
- Schedules use the existing 100 ms simulation clock and version `expedition-time-v1`. Capture preserves each request's setup or after-step placement; predefined requests default to before-choice placement. Simultaneous requests follow phase and list order. Individual captured manual commands retain their safe-boundary effects when reproduced.
- Version 11 records retain initial definitions, schedule selections, actual requests, request origins and placement, mission history, and final captured schedules. Validation checks their relationships and payloads. Replay makes no inference requests and preserves source exports. Supported versions 1 through 10 keep their original rules; the version 10 fixture was captured from `70fb87b6e8b9f8281d9881efb5b2d19b09db3b61` before implementation.
- Partial perception, fixed scientific objectives, single-storm behavior, stale-choice rejection, and all existing expedition pauses remain in force. The example runs on the existing Ochre Basin world. Fresh matched baseline launch and tuned benchmark choices remain tickets 12 and 13.
- See [intervention schedules](../../../docs/intervention-schedules.md) for ordering, record fields, reset behavior, and the reproduction API.

## Standards

The final review found no documented-standard violations or actionable heuristic smells. One minor duplicated validation condition from the initial review was removed. The follow-up review confirmed that phase ordering is centralized and the public session boundary is preserved.

## Spec

The initial review found that a captured manual request could move from after an action's start to before that action when reproduced. Requests now preserve that placement and execute individually under the manual application policy. Regression tests cover the original wait-boundary case and successive requests at a waypoint. The follow-up review also verified 20 mission/storm combinations across setup, time zero, mid-action, action completion, and timeout. No remaining findings or scope creep were reported.

Review totals: Standards 0 remaining findings; Spec 0 remaining findings.

## Verification

- Typechecking and the production build pass. The build retains the existing dependency annotation and bundle-size warnings.
- The final full Bun suite passes: 242 tests and 2,848 assertions across 21 files. Thirteen intervention tests cover different trajectories, identical external payloads, perception, simultaneous events, paused time, playback speed, safe boundaries, manual reproduction, malformed records, and legacy replay.
- The real backend and SDK use scripted provider transport for the usage-pause case. No paid inference was used.
- The full browser run passed 51 of 53 scenarios. The two failures were an already-corrected format-version assertion loaded by the earlier run and the sensor-expiry timing check. All nine scenarios in the intervention, observation, and usage-limit suites passed on the final rerun, including the unchanged sensor-expiry test. Every browser scenario has a passing result.
- Desktop and 390 by 844 screenshots were visually reviewed. The history remains readable, panels scroll, and camera and playback controls remain reachable. Keyboard schedule selection, Escape, persistence, and inference-free replay pass.
- `git diff --check` passes.
