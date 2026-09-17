# 04: Manage energy across multiple trips

**What to build:** Recharge at base, make further deliveries, and observe successful expeditions or a stranded rover.

**Blocked by:** 03: Inspect, collect, and deliver scientific samples

**Status:** ready-for-agent

- [x] Consume movement energy according to route distance and terrain, enforce battery bounds, and show battery and accumulated energy use.
- [x] Offer recharge only at base as a separate action from automatic unloading; it replenishes battery while consuming expedition time.
- [x] The baseline controller can complete more than one trip, returning cargo, choosing whether to recharge, and resuming exploration within the same expedition.
- [x] Exhausting battery away from base ends the expedition with a stranded-rover result. Enforce physical constraints without forcing a strategically safe return.
- [x] Results show science score, discoveries, inspections, energy use, ending condition, and baseline controller attribution; preserve the corresponding resource and action events.
- [x] All six action kinds are available under their appropriate preconditions, with status visible while each executes.
- [x] Verify multiple trips, recharge timing and bounds, depletion away from base, timeout during an interaction, pause/reset, and delivery-only scoring through complete expedition scenarios.

## Comments

- Implemented a 100-unit battery with continuous distance-based movement costs: two units per plain cell and four per rough cell. Known-map route estimates include energy; controller inputs include battery and capacity. Resource events retain battery and cumulative movement energy independently of recharge.
- Recharge is a separate, base-only action that restores five units per simulated second up to capacity. The baseline recharges at 90% or below and can skip small top-ups. Its energy-return rule uses the known route cost plus a ten-unit reserve; the simulation still offers unaffordable routes with positive battery, preserving strategic failure.
- Depletion stops movement and ends the expedition as a stranded rover away from base, with onboard cargo uncredited. Arrival at base with exactly zero battery allows unloading and recharge. Pauses freeze resources; reset restores initial resources; timeout cancels unfinished interactions and retains only energy actually recharged.
- Mission control shows battery, cumulative energy, every action's status, and results with energy use, ending condition, science/discovery/inspection totals, uncredited cargo, and baseline attribution.
- Public-session scenarios cover multiple deliveries around recharge, exact terrain costs, recharge bounds and timing, risky routes and stranding with cargo, empty-battery arrival, pause/reset, timeout during inspection and recharge, delivery-only scoring, all six action kinds, and consistent playback outcomes. The browser scenario covers energy telemetry, separate unloading/recharge, paused resources, resuming exploration, results, and reset.
- Validation passed on Bun 1.4.2: typechecking, production build, all 20 Bun scenarios, and all four Playwright checks using system Chromium. The existing Vite large-chunk warning remains.
- Spec review found no issues. Standards review found no documented violations and suggested naming the repeated energy-rounding rule; that cleanup is implemented. After review, typechecking, the production build, all nine affected energy/expedition scenarios, and the focused energy browser check passed again.
