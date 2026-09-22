# Decision cadence

Ticket 06 uses `meaningful-boundaries-v1`. Jev chooses one supplied action and target. Code builds candidates and routes, computes costs, executes actions, and awards delivery credit. A threshold asks the controller to reconsider; it does not force a return or prevent an unsafe choice.

## Triggers and safe boundaries

| Trigger | When it contributes to a decision |
| --- | --- |
| `start` | Starting an expedition, including its initial observations and configured mission. |
| `action-completed` | Completing exploration, inspection, collection, return, recharge, or bounded waiting. |
| `sample-discovered` | First sensing a sample. Its properties remain unknown until inspection. |
| `sample-inspected` | Finishing an inspection that reveals properties. It accompanies action completion. |
| `instructions-changed`, `mission-changed` | Applying requested free text or a preset at the next safe boundary. Multiple edits retain both trigger kinds and use the latest effective preferences. |
| `storm-detected` | First sensing a dust storm, including its disclosed extent, expiry, and effects. |
| `storm-effects-changed` | Entering or leaving a storm changes the sensor range or movement multiplier. |
| `storm-expired` | A detected storm reaches its known expiration time, even out of sensor range. |
| `battery-reserve` | Battery reaches or falls below the cheapest known offered return-route energy plus the effective preset reserve. Balanced and Explore more reserve 10 energy units; Conserve energy reserves 20. Free text uses the Balanced threshold. |
| `return-time` | With cargo aboard, remaining expedition time reaches or falls below the fastest known offered return-route duration plus 15 seconds. |
| `cargo-full` | Cargo reaches its two-sample capacity. |
| `retry`, `controller-changed` | Mission control explicitly retries or continues with baseline after a failure or usage pause. |

Travel can stop for reconsideration at a grid waypoint, never partway through an edge. Inspection, collection, and bounded waiting already underway finish first. Recharge is interruptible while stationary. Resource thresholds are checked at those boundaries and when mission preferences become effective. Each threshold contributes only on entry into its condition; it rearms after leaving that condition. There is no return-route threshold at base. Full recharge already causes action completion. Zero battery away from base ends the expedition under the existing physics.

Changes accumulate in first-observed order, with each trigger kind present once. A completed action and changes accumulated during that action produce one context. The event history retains individual changes and their times, including superseded mission edits. A replacement for a cancelled pending request retains its original triggers and adds subsequent changes. Independently issued commands at an already safe boundary can invalidate a request that has just begun; replacements wait for cancellation settlement and usage guards.

Routine terrain discovery and refreshed observation timestamps update observations, memory, and discovery history without independently requesting a choice. Rendering and camera movement never request decisions. Hidden storm introduction or expiry does not disclose a hazard or create a hazard trigger. A later decision receives all knowledge available at that boundary.

Pending inference freezes expedition time, movement, battery consumption, and storm evolution under ADR 0001. The scheduler discards unused simulated time when a batch reaches an asynchronous choice and resets its wall-time anchor on settlement. Manual pause remains a pause after settlement. One decision stays in flight; cancellation, obsolete-result rejection, the five-second total deadline, one automatic retry, and attempt/cost/uncertainty guards still apply. Failures require explicit recovery.

## Recorded evidence

Version 7 exports store the cadence in starting conditions and put `decisionBoundary.version` and `decisionBoundary.triggers` in the exact input supplied to both controllers. Requested, applied, discarded, and failed decisions retain that input. The older `reason` field is the first trigger for new records. It remains the original single reason for historical records. The timeline shows all recorded triggers and identifies the live choosing, executing, paused, usage-paused, and failed phases separately.

The provider context change uses prompt version `rover-action-v3`. Existing candidate ownership, bounded choice validation, probabilities, accounting, and credentials handling are unchanged.

Versions 1 through 6 replay their original per-observation cadence, single reasons, and simulation behavior. Their records acquire no new triggers. `tests/fixtures/legacy-cadence-v6.json` was captured from commit `0d0081e` before this change. Replay executes recorded choices without calling or recomputing a controller, and rejects incompatible history.

## Verification

`bun test tests/cadence.test.ts` exercises the session through the real decision backend and SDK with a scripted provider. A three-cell route updates memory with one provider request instead of the previous four. Other scenarios cover sample discovery, coalesced inspection and storm changes, both reserve thresholds, full cargo, delivery time, pending changes, manual pause, detached inputs, export/import, and version 6 replay. These are deterministic verification scenarios, not measured live Jev performance.

The focused Chromium check is `bun run test:browser browser/cadence.spec.ts`. It checks choosing versus execution, visible combined triggers, frozen time, saved inspection, and replay with provider routes blocked.
