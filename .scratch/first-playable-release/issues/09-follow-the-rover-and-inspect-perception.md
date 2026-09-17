# 09: Follow the rover and inspect perception

**What to build:** Switch camera perspectives, display current sensor coverage, and inspect a clearly labeled full-world view.

**Blocked by:** 02: Discover the area through limited perception

**Status:** ready-for-agent

- [ ] Add a rover-follow camera alongside the orbit camera, with usable switching during movement and pauses.
- [ ] Display a sensor-coverage overlay derived from the current simulation state; it reflects later range changes without independently modeling perception.
- [ ] Provide an explicitly labeled full-world debugging view that reveals hidden terrain and objects without changing rover observations, memory, candidates, or outcomes.
- [ ] Provide convincing visible wheel and suspension movement while preserving the simplified physical model; do not introduce traction, slip, or tipping simulation.
- [ ] Keep camera and overlay interaction responsive independently of expedition advancement and pending controller decisions.
- [ ] Verify controller inputs and outcomes remain unchanged when cameras, sensor overlays, or full-world view are toggled, and check camera/overlay behavior in the browser.
