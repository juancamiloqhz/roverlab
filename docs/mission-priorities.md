# Mission priorities

Mission control selects either preset priorities or a free-text experiment. New expeditions retain the existing free-text default with empty instructions. Switching to a preset clears the instructions supplied to the controller. Switching back supplies only the written instructions. An inactive editor draft is not controller input.

The scientific objective and delivery rubric remain fixed after start. Preferences never alter action validity, movement costs, perception, cargo capacity, scoring, or expedition duration. Both controllers receive the same effective mission revision through the existing controller input, together with the same objective and rover knowledge. No hidden classifications, scores, or undiscovered properties enter that input.

## Preset definitions, version 1

The canonical definitions are in `shared/mission.ts`. Every preset carries its ID, label, definition version, structured settings, and adherence definitions. The backend and record importer reject altered or unknown definitions. Future tuning must introduce another supported definition version and preserve the old one for replay.

| Setting | Unit and meaning | Balanced | Conserve energy | Explore more |
| --- | --- | --- | --- | --- |
| `scienceWeight` | Dimensionless relative emphasis on observed evidence relevant to the objective | 3 | 2 | 2 |
| `deliveryWeight` | Dimensionless relative emphasis on delivering onboard cargo | 2 | 2 | 1 |
| `energyWeight` | Dimensionless relative emphasis on battery preservation and lower known route costs | 2 | 5 | 1 |
| `explorationWeight` | Dimensionless relative emphasis on acquiring new knowledge | 2 | 1 | 5 |
| `returnReserveEnergy` | Desired energy units remaining above the cheapest currently offered return-route estimate | 10 | 20 | 10 |

These weights express relative preferences, not probabilities, science points, or an action score. The reserve is a desired margin, not a hard constraint or guarantee that the rover can return. Routes and hazards are estimates from available knowledge.

Balanced gives observed scientific opportunity the greatest emphasis while retaining delivery, energy, and exploration preferences. Conserve energy increases the energy emphasis and requested return margin. Explore more increases the emphasis on acquiring knowledge while retaining the same scientific objective and simulation rules.

Ticket 04 supplies these settings and a Jev prompt that explains them. The current baseline receives them but still uses its existing fixed strategy. Ticket 05 owns the improved baseline interpretation. The interface discloses this limitation. Free-text mode also discloses that the baseline cannot interpret arbitrary instructions; such runs are not presented as matched-priority benchmarks.

## Observable adherence definitions, version 1

These definitions travel with each preset in requests and records. Later comparisons can report them separately, without an overall AI score. Ticket 04 records their definitions; calculating comparison reports belongs to later tickets.

| Measure | Unit | Definition | Limitations |
| --- | --- | --- | --- |
| Energy used | Energy units | Accumulated movement energy during the expedition | Low consumption can mean inactivity or early termination. |
| Return margin | Energy units at each decision | Battery minus the cheapest offered return-route energy estimate, compared with `returnReserveEnergy` | Unavailable without a known return route. Assumes immediate departure and known hazards. It is not a safety guarantee. |
| Knowledge rate | New terrain cells per simulated minute | Distinct terrain cells first observed after start divided by elapsed expedition minutes | Unavailable at zero time. Depends on sensors and terrain. It does not measure scientific value. |
| Delivery fraction | Fraction from 0 to 1 | Delivered sample count divided by delivered plus onboard sample count | Unavailable before collection. Ignores sample relevance and uncollected opportunities. |
| Delivered science | Science points | Score credited at base under the fixed objective and rubric | Depends on the objective and opportunities; undelivered cargo earns no credit. It is an outcome, not model confidence. |

## Requested and effective preferences

Each accepted edit increments the mission revision. The history records the request's exact expedition time immediately. It records application separately when the session reaches a safe boundary. Travel finishes the current grid edge; inspection, collection, and waiting finish their bounded interaction. Stationary travel and recharge can be interrupted. A pending decision is cancelled, then its settlement is retained before another decision starts. Inference keeps expedition time frozen and retains its existing five-second deadline.

Multiple edits before application remain in the history. Only the latest revision applies; earlier pending revisions are labeled superseded. Stopping before a boundary preserves an unapplied request. A reset retains the requested preferences as revision zero of a fresh history. Edits after expedition end are ignored.

Decision evidence shows the exact effective revision supplied to that decision. The mission panel distinguishes requested and effective revisions. Saved inspection, comparison, and replay display the same history, definition versions, and application times.

## Records and compatibility

Version 5 records add initial mission preferences, mission changes and application events, effective decision preferences, and requested/effective history in the final snapshot. The legacy `instructions` field is empty in preset mode. `instructionsVersion` remains the compatibility revision counter and advances for either kind of edit. In free-text mode it agrees with the mission instructions. These duplicated compatibility fields are checked during import and backend validation.

Versions 1 through 4 remain free-text records with their original simulation, prompt, usage, and event semantics. Replay does not add preset defaults, call a provider, or modify the source. `tests/fixtures/legacy-mission-v4.json` was captured from commit `c214d58574a78b86ac142b1ac6a185afa72e9c22` using its session, backend, and real SDK against scripted transport. It includes an instruction edit during a bounded wait. Versions 1 through 3 retain their existing captured fixtures.

The live prompt is `rover-action-v2`. Historical records retain their original prompt versions. Session and browser checks use scripted providers and never load a live key or spend credits.
