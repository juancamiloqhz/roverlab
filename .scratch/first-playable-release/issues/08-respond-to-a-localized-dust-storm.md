# 08: Respond to a localized dust storm

**What to build:** Trigger a storm and observe the rover reconsider waiting, crossing, or taking a different route.

**Blocked by:** 05: Inspect decisions and update mission instructions

**Status:** ready-for-agent

- [x] Provide a mission-control action that introduces a temporary localized dust storm of fixed configured duration, with visible environmental feedback subject to the normal discovery boundary.
- [x] Reduce sensor range and increase movement energy consumption while the rover is inside the storm region. Its progression follows expedition time.
- [x] Before detection, keep storm extent and duration out of rover observations, memory updates, candidates, and route estimates. Once detected, reveal the affected region and remaining duration.
- [x] Detecting the storm triggers reconsideration at the existing safe action boundary. Available exploration, return, and wait choices expose the known tradeoffs without adding new action kinds.
- [x] Waiting consumes expedition time, crossing costs extra energy, and available detours add route distance; do not force one strategy to be correct.
- [x] Freeze storm progression during manual pause and pending decisions, while retaining responsive UI interaction. Expiration updates observations and memory according to what the rover knows.
- [x] Capture storm introduction, detection, and related effects/events for later records, without sending hidden world state to the controller.
- [x] Demonstrate the hazard with the baseline controller and verify detection, disclosure, movement-energy and sensor effects, expiration, waypoint reconsideration, and decision-time freezing using scripted decisions at the existing session boundary.

## Comments

- Implemented the mission-control storm command, discovery-limited scene feedback, countdown, and timeline details. The authored storm lasts 45 expedition seconds around (15, 13), with a 4.5-cell radius, 1.5-cell sensor range, and triple movement energy. One introduction is available per expedition; reset restores it.
- Kept private storm truth separate from observations and memory. Detection discloses extent and remaining duration, requests reconsideration at a safe boundary, and discards obsolete pending decisions. Undetected introduction and expiration do not change controller knowledge. Remembered expiry is inferred from the disclosed deadline without refreshing last-seen time.
- Added distinct crossing and detour candidates using the existing action kinds and known map. Estimates and execution account for region boundaries, rough terrain, expiration during travel, and battery depletion. The baseline can cross, select an energy-saving detour, or wait for a near expiry. Storm progression and scene animation follow expedition time, including manual and decision pauses.
- Added session scenarios for hidden-state isolation, disclosure, waypoint reconsideration, crossing/detour/return/wait tradeoffs, sensor effects, remembered expiry, stale decisions, reset, stranding, and equivalent outcomes across playback speeds and response delays. The real TypeSafe SDK is exercised with scripted external responses for storm observations and detour selections; no credentials or paid service calls are used. Browser checks cover hidden introduction, visible detection, paused orbiting/countdown, timeline details, expiry, reset, and storm controls during pending TypeSafe decisions.

- Final verification under Bun 1.4.2 passed: typecheck, production build, all 74 Bun scenarios, and all 10 Playwright browser checks using installed Chromium. Existing dependency annotation and large-chunk build warnings remain. The storm screenshot was visually inspected.
- Standards review against `04411bc`: no actionable findings. Bun tooling, domain vocabulary, local issue conventions, simulator-owned navigation/accounting, snapshot rendering, and the decision-time freeze are preserved. Shared route and movement-cost helpers avoid duplicated behavior; no material baseline smell was identified.
- Spec review against `04411bc`: no actionable findings. No missing requirements, material scope creep, or incorrect behavior was identified within ticket 08. Hidden-state boundaries, safe reconsideration, movement/detour costs, frozen storm time, stale decisions, recording, and visual disclosure were reviewed separately from Standards.
- Review totals: Standards 0 findings; Spec 0 findings. No outstanding review issues.
