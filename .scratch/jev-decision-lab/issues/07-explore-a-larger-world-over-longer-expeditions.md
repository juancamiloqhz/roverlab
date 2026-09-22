# 07: Explore a larger world over longer expeditions

**What to build:** Mission control can run an expedition lasting 15 to 20 simulated minutes across one larger authored world, with enough scientific opportunities and viable return trips to make exploration consequential. Existing saved five-minute expeditions still replay correctly.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

**Parent spec:** [Fullscreen Jev decision lab](../spec.md). Primary user stories: 7, 10-20, 27, 41, 68-76, 79.

- [x] Author one world with approximately four times the current map area, three identifiable research regions, and 10 to 12 sample sites. Retain one rover, its base, the existing action vocabulary, and dust storms as the existing hazard type.
- [x] Give the regions competing scientific and travel opportunities, including clear and ambiguous sample properties. Author hidden classifications and scoring independently of controller output; a larger empty travel area does not satisfy this ticket.
- [x] Configure a new expedition time budget within 15 to 20 simulated minutes and record its actual value. Preserve pause, reset, manual stop, and 1x, 2x, and 4x playback; speed affects viewing pace, not physical rules or provider deadlines.
- [x] Tune the initial world layout and resource settings enough to demonstrate viable multiple trips to base, capacity trade-offs, and choices that cannot all be completed within the time budget. Record measured distances, resource parameters, and versions rather than relying on undocumented constants.
- [x] Preserve scientific objective and delivery-only scoring semantics. Inspection reveals properties, collection consumes cargo space, and samples earn science only when delivered. Poor strategic decisions and stranded outcomes remain possible.
- [x] Preserve limited perception, timestamped rover memory, and knowledge-based route calculations. Neither controller receives hidden values or undiscovered information. The labeled full-world debugging view must not improve controller knowledge.
- [x] Render and navigate the larger world with the existing orbit and follow cameras, legible rover/base/sample locations, and working sensor coverage. Normal exploration and input remain usable as candidate and observation volumes grow.
- [x] Version scenario and simulation settings explicitly. New records retain their world, duration, and resource settings through saving and validated import/export. Supported legacy records replay their original five-minute budget, layout, and rules, without fresh inference or source mutation.
- [x] Exercise long expeditions and at least one successful multi-trip route through the existing session boundary with deterministic scripted choices. Include time exhaustion, battery failure, observation isolation, scoring, and different playback speeds; validate both new and supported legacy replay outcomes.
- [x] Add focused browser coverage for the expanded world and longer timer, including camera access and pause/reset/stop controls. Run required repository checks without paid calls.

This world must be independently playable and verifiable. Ticket 13 later calibrates the improved baseline and benchmark schedules against it; that later tuning is not a reason to leave this slice without viable routes.


## Comments

- Implemented ticket 07 only. The default `ochre-basin-v6` world has 42 × 38 cells, three observed research regions, twelve samples, an eighteen-minute budget, and 160 battery units. The two cargo slots, action costs, fixed objective, delivery-only rubric, limited perception, and dust-storm rules remain intact. See [expanded-world measurements](../../../docs/expanded-world.md) for authored properties, distances, resource parameters, and versions.
- A deterministic survey delivers A+B at 132 seconds, G+H at 740 seconds, and K at 1,068 seconds, earning 25 points. It leaves seven samples undelivered. Skipping recharge and the return reserve strands the rover at 340 seconds. Even an ideal tour collecting every sample without inspection needs at least 1,094 seconds, beyond the 1,080-second budget.
- Version 8 records identify `grid-expedition-v1` and retain actual duration, capacity, complete scenario, and region observations. The legacy version 7 fixture was captured from the original `5df7b455` session before implementation. Versions 1 through 7 replay their original five-minute settings and choices at every supported viewing speed without source mutation or inference.
- Cameras fit recorded world dimensions and viewport aspect, while follow mode, orbit restoration, sensor coverage, and detached full-world debugging remain available. Region names enter controller input only through sensed terrain. The sensor scan now visits the current footprint instead of the entire map each step.
- The existing baseline and presets are unchanged. Its measured past-water run delivers one sample. Later benchmark calibration remains ticket 13; this ticket's scripted multi-trip route establishes feasibility independently.

## Standards

No Standards findings.

The diff follows the documented Bun tooling, public session testing seam, domain vocabulary, knowledge/debug separation, and paused-time rules. Historical scenarios remain explicit fixtures, and new tests exercise public behavior. No actionable code smells were identified.

## Spec

No Spec-axis findings. The review found no missing ticket requirement, scope creep, or incorrect implementation.

The world, regions, sample count, duration, versioned settings, and documented multi-trip outcomes satisfy ticket 07. The session checks cover delivery, cargo limits, stranding, observation isolation, playback speeds, and legacy versions 1 through 7 without source mutation or inference. Camera sizing follows recorded dimensions and viewport aspect. Region information enters controller input only through observed terrain; the debugging projection remains detached.

Additional public-session playtests checked both objectives under all three baseline presets. All six default runs remained below the existing 32 MB import limit; the unusual-minerals runs also round-tripped unchanged through validated export/import.

Review totals: Standards 0 findings; Spec 0 findings.

## Verification

- `bun run typecheck` and `bun run build` passed. Existing dependency annotation and bundle-size warnings remain.
- Full `bun test`: 199 passed, 0 failed across 18 files.
- The complete browser run exercised all 35 scenarios. Thirty-three passed; two scenarios comparing or replaying complete eighteen-minute histories exceeded their previous 30-second test timeout. Their test budgets are now 60 and 90 seconds. Both passed the focused rerun, taking 33.1 and 43.1 seconds. Production inference deadlines are unchanged.
- The actual backend and SDK completed the long survey against scripted provider responses with 39 confirmed attempts and knowledge exceeding 399 terrain cells. No paid calls or real keys were used. Replay added no inference calls.
- `git diff --check` passed. Work is committed on the original `main` branch.
