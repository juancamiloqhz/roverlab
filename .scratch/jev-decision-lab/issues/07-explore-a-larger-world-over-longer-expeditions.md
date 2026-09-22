# 07: Explore a larger world over longer expeditions

**What to build:** Mission control can run an expedition lasting 15 to 20 simulated minutes across one larger authored world, with enough scientific opportunities and viable return trips to make exploration consequential. Existing saved five-minute expeditions still replay correctly.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

**Parent spec:** [Fullscreen Jev decision lab](../spec.md). Primary user stories: 7, 10-20, 27, 41, 68-76, 79.

- [ ] Author one world with approximately four times the current map area, three identifiable research regions, and 10 to 12 sample sites. Retain one rover, its base, the existing action vocabulary, and dust storms as the existing hazard type.
- [ ] Give the regions competing scientific and travel opportunities, including clear and ambiguous sample properties. Author hidden classifications and scoring independently of controller output; a larger empty travel area does not satisfy this ticket.
- [ ] Configure a new expedition time budget within 15 to 20 simulated minutes and record its actual value. Preserve pause, reset, manual stop, and 1x, 2x, and 4x playback; speed affects viewing pace, not physical rules or provider deadlines.
- [ ] Tune the initial world layout and resource settings enough to demonstrate viable multiple trips to base, capacity trade-offs, and choices that cannot all be completed within the time budget. Record measured distances, resource parameters, and versions rather than relying on undocumented constants.
- [ ] Preserve scientific objective and delivery-only scoring semantics. Inspection reveals properties, collection consumes cargo space, and samples earn science only when delivered. Poor strategic decisions and stranded outcomes remain possible.
- [ ] Preserve limited perception, timestamped rover memory, and knowledge-based route calculations. Neither controller receives hidden values or undiscovered information. The labeled full-world debugging view must not improve controller knowledge.
- [ ] Render and navigate the larger world with the existing orbit and follow cameras, legible rover/base/sample locations, and working sensor coverage. Normal exploration and input remain usable as candidate and observation volumes grow.
- [ ] Version scenario and simulation settings explicitly. New records retain their world, duration, and resource settings through saving and validated import/export. Supported legacy records replay their original five-minute budget, layout, and rules, without fresh inference or source mutation.
- [ ] Exercise long expeditions and at least one successful multi-trip route through the existing session boundary with deterministic scripted choices. Include time exhaustion, battery failure, observation isolation, scoring, and different playback speeds; validate both new and supported legacy replay outcomes.
- [ ] Add focused browser coverage for the expanded world and longer timer, including camera access and pause/reset/stop controls. Run required repository checks without paid calls.

This world must be independently playable and verifiable. Ticket 13 later calibrates the improved baseline and benchmark schedules against it; that later tuning is not a reason to leave this slice without viable routes.
