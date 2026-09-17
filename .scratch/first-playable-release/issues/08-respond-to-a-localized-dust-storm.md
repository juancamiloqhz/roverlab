# 08: Respond to a localized dust storm

**What to build:** Trigger a storm and observe the rover reconsider waiting, crossing, or taking a different route.

**Blocked by:** 05: Inspect decisions and update mission instructions

**Status:** ready-for-agent

- [ ] Provide a mission-control action that introduces a temporary localized dust storm of fixed configured duration, with visible environmental feedback subject to the normal discovery boundary.
- [ ] Reduce sensor range and increase movement energy consumption while the rover is inside the storm region. Its progression follows expedition time.
- [ ] Before detection, keep storm extent and duration out of rover observations, memory updates, candidates, and route estimates. Once detected, reveal the affected region and remaining duration.
- [ ] Detecting the storm triggers reconsideration at the existing safe action boundary. Available exploration, return, and wait choices expose the known tradeoffs without adding new action kinds.
- [ ] Waiting consumes expedition time, crossing costs extra energy, and available detours add route distance; do not force one strategy to be correct.
- [ ] Freeze storm progression during manual pause and pending decisions, while retaining responsive UI interaction. Expiration updates observations and memory according to what the rover knows.
- [ ] Capture storm introduction, detection, and related effects/events for later records, without sending hidden world state to the controller.
- [ ] Demonstrate the hazard with the baseline controller and verify detection, disclosure, movement-energy and sensor effects, expiration, waypoint reconsideration, and decision-time freezing using scripted decisions at the existing session boundary.
