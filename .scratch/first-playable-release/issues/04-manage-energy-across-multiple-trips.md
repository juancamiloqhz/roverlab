# 04: Manage energy across multiple trips

**What to build:** Recharge at base, make further deliveries, and observe successful expeditions or a stranded rover.

**Blocked by:** 03: Inspect, collect, and deliver scientific samples

**Status:** ready-for-agent

- [ ] Consume movement energy according to route distance and terrain, enforce battery bounds, and show battery and accumulated energy use.
- [ ] Offer recharge only at base as a separate action from automatic unloading; it replenishes battery while consuming expedition time.
- [ ] The baseline controller can complete more than one trip, returning cargo, choosing whether to recharge, and resuming exploration within the same expedition.
- [ ] Exhausting battery away from base ends the expedition with a stranded-rover result. Enforce physical constraints without forcing a strategically safe return.
- [ ] Results show science score, discoveries, inspections, energy use, ending condition, and baseline controller attribution; preserve the corresponding resource and action events.
- [ ] All six action kinds are available under their appropriate preconditions, with status visible while each executes.
- [ ] Verify multiple trips, recharge timing and bounds, depletion away from base, timeout during an interaction, pause/reset, and delivery-only scoring through complete expedition scenarios.
