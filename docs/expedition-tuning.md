# Expedition comparison and tuning

Ticket [12](../.scratch/first-playable-release/issues/12-compare-and-tune-expeditions.md) was assessed with Bun 1.4.2, the baseline controller, and scripted choices through the public expedition session. No live TypeSafe calls were used. These experiments measure simulation tradeoffs, not live model quality or a guarantee that TypeSafe beats the baseline.

## Reproduce the playtests

```sh
bun scripts/playtest-tuning.ts
bun scripts/playtest-tuning.ts --sweep
bun test tests/tuning.test.ts
bun run test:browser browser/comparison.spec.ts browser/records.spec.ts
```

The script prints one JSON result per expedition. The survey script delivers its first discovered sample, recharges, surveys east, then heads north while carrying the next sample. It selects only supplied candidates using rover memory; it has no hidden positions, properties, or routes. This intentionally directed survey tests feasibility, not a generally optimal strategy. The current baseline uses ticket 05's evidence and resource rules; it still does not interpret free-text mission instructions.

The sweep compares Sample C at z=4, 5, and 6, storm durations of 30, 45, and 60 seconds, and movement multipliers of 2, 3, and 4. Action durations and energy rates were evaluated through completed trips and controlled routes and retained. Tests exercise outcomes at the session boundary; browser tests exercise saved/imported comparisons.

## Chosen configuration

| Parameter | Chosen value |
| --- | --- |
| Scenario | `ochre-basin-v5`, 21 × 19 cells |
| Base; samples A, B, C | (3, 13); (7, 13), (15, 13), **(17, 5)** |
| Expedition budget; cargo | 300 expedition seconds; two samples |
| Movement per cell | Plain: 4 seconds / 2 energy; rough: 8 seconds / 4 energy |
| Inspection; collection; bounded wait | 6 seconds; 4 seconds; 5 seconds |
| Battery; recharge | 100 units; 5 units per second at base |
| Sensing | 3 cells normally; 1.5 cells within the storm |
| Storm | Center (15, 13), radius 4.5 cells, 45 seconds, movement energy ×3 |
| Delivery scoring | Unrelated 0; suggestive 5; strong evidence 10 |

The only changed parameter is Sample C's position, one cell south of its previous (17, 4) site. This removes eight seconds and four energy units from the clear-weather survey. Sample C remains distant and lies on the existing rough terrain. The three sites, two cargo slots, scoring classifications, five-minute budget, and all simulation rules remain unchanged.

The earlier layout permits a clear-weather three-sample delivery at 261.2 seconds but the tested storm-waiting strategy finishes with B and C still aboard. Moving C to (17, 5) makes that same storm response just viable: delivery at 298.2 seconds with 2.8 battery units on arrival. Moving it another cell to z=6 permits delivery at 286.2 seconds and reduces the pressure further; z=5 preserves a narrow margin.

With C at z=5, the waiting strategy delivers at 283.2 seconds under a 30-second storm, 298.2 under the chosen 45-second storm, and misses delivery under a 60-second storm. The unchecked crossing strategy strands at 220.2, 185.2, and 150.2 seconds for energy multipliers 2, 3, and 4 respectively. The retained ×3 / 45-second combination makes the hazard consequential while leaving an attainable response.

## Representative outcomes

The table below preserves the first-release measurements. Its baseline row predates `evidence-priorities-v1`. Running the script now uses the ticket 05 baseline, whose [current measured outcomes](baseline-strategy.md#deterministic-checks-and-limits) distinguish the two objectives and reserve a return trip. The scripted survey measurements remain unchanged.

These runs use the chosen layout. A storm, where listed, is introduced at expedition time 90 seconds. Scores are shown as past water / unusual minerals. Energy is accumulated consumption, including after any recharge; it is independent of final battery.

| Strategy | Delivered; last delivery | Score | Discovered / inspected | Energy used | Ending; uncredited cargo |
| --- | --- | --- | --- | --- | --- |
| Baseline, clear | A; 42s | 10 / 0 | 3 / 1 | 134.2 | Timeout at 300s; none |
| Scripted survey, clear | A, then B+C; 253.2s | 15 / 15 | 3 / 3 | 110 | Timeout at 300s; none |
| Survey without recharge | A; 42s | 10 / 0 | 3 / 3 | 100 | Stranded at 230s; B+C |
| Survey with 50s initial waiting | A; 92s | 10 / 0 | 3 / 3 | 108.4 | Timeout at 300s; B+C |
| Survey crossing the storm | A; 42s | 10 / 0 | 2 / 2 | 116 | Stranded at 185.2s; B |
| Survey waiting on costly storm routes | A, then B+C; 298.2s | 15 / 15 | 3 / 3 | 113.2 | Timeout at 300s; none |

The first return alone consumes 16 seconds and eight energy units. The following recharge consumes 3.2 seconds. Skipping it saves time but strands this survey with two samples aboard. A clear survey's second trip consumes 94 units before reaching base; recharge and route choice matter despite its 46.8-second time margin. Delaying departure by 50 seconds shows how waiting can lose delivery credit without causing battery depletion. Waiting for the storm instead spends time to conserve enough energy to deliver, with only 1.8 seconds left.

An attempted detour toward Sample B still crosses: the destination is inside the storm, so no route can avoid the region entirely. A requested strategy is not proof that a detour was offered or executed.

## Isolated storm-route tradeoff

The script also uses a fully observed 15 × 13 plain grid with base (0, 6), sample (14, 6), and the chosen storm centered at (7, 6), introduced at time zero. This separate fixture isolates the route decision, with a destination outside the hazard. Its broad sensor range is confined to this controlled scenario; the authored expedition retains limited perception.

| Scripted response | Delivery time | Total travel energy | Cost relative to crossing |
| --- | --- | --- | --- |
| Cross immediately | 122s | 91 | Fastest, highest energy |
| Wait on a route affected by the storm | 157s | 56 | 35s later, saves 35 energy |
| Take the offered detour | 162s | 76 | 40s later, saves 15 energy |

Waiting starts travel before the storm expires when the supplied route estimate predicts arrival after expiry. The five-second waits, route estimates, and safe reconsideration boundaries are exercised without changing their rules. All three choices deliver the same sample for ten past-water points. The result does not imply that waiting always beats detouring: geometry, known routes, introduction time, and remaining budget differ across expeditions.

## Comparison and compatibility

Select two entries in **Saved expeditions**, then **Compare selected expeditions**. Comparison pauses an active live expedition and reads the records without replay, inference, or mutation. The tables distinguish:

- The complete recorded scenario and simulation settings, including hidden sample properties/classifications, terrain, sensing, energy, timing, and capacity. Matching is an exact comparison of the recorded values, independent of object-key order; identifiers and array ordering are retained.
- The fixed objective actually used, including pre-start selections, and the delivery rubric.
- Storm introduction times, configurations, and expiration times. Interventions count even if the rover never detected them. Detection time is displayed as an outcome, not a condition that must match.
- Initial instructions and every timestamped instruction edit, plus ordered controller transitions and an explicit mixed-controller label. These are comparison variables and do not disqualify otherwise matching conditions.
- Simulation outcomes separately from inference attempts and wall-clock latency. Actual probabilities remain in each expedition's decision timeline, accessible through **Inspect expedition**.

Matching conditions help interpret differences; they do not establish that a controller or instruction caused a better result. An early manual stop, for example, remains visible in ending condition and elapsed expedition time.

The original measurements used version 1 records. Current exports use version 6 and retain baseline rule evidence. Replay supports versions 1 through 6 and always uses the saved scenario, so earlier `ochre-basin-v4` histories retain their original Sample C position. Session checks replay both layouts at 1×, 2×, and 4× and compare every event, decision, and final result. Existing simulation, perception, storm, inference, and replay checks remain applicable.
