# 09: Follow the rover and inspect perception

**What to build:** Switch camera perspectives, display current sensor coverage, and inspect a clearly labeled full-world view.

**Blocked by:** 02: Discover the area through limited perception

**Status:** ready-for-agent

- [x] Add a rover-follow camera alongside the orbit camera, with usable switching during movement and pauses.
- [x] Display a sensor-coverage overlay derived from the current simulation state; it reflects later range changes without independently modeling perception.
- [x] Provide an explicitly labeled full-world debugging view that reveals hidden terrain and objects without changing rover observations, memory, candidates, or outcomes.
- [x] Provide convincing visible wheel and suspension movement while preserving the simplified physical model; do not introduce traction, slip, or tipping simulation.
- [x] Keep camera and overlay interaction responsive independently of expedition advancement and pending controller decisions.
- [x] Verify controller inputs and outcomes remain unchanged when cameras, sensor overlays, or full-world view are toggled, and check camera/overlay behavior in the browser.

## Comments

- Added orbit/follow camera switching with a saved orbit perspective and rover-centered drag/zoom in follow mode. View settings stay in the scene and remain responsive during movement, pauses, pending decisions, and reset.
- Added a toggleable sensor disc and radius label driven directly by the snapshot's rover position and current sensor range, including storm reductions and restoration.
- Added the separate, detached `getFullWorldView()` session read method. The labeled debug scene shows terrain, obstacles, available sample sites, and active storms while preserving rover knowledge, controller candidates, and results. Collected samples and expired storms disappear; reset restores their starting state. Hidden sample properties and scoring classifications remain excluded from the debug projection.
- Added visible rotating wheel treads/spokes, articulated suspension arms, and chassis motion driven by simulated distance. Stationary and frozen expeditions retain their pose; movement rules and physics are unchanged.
- Verification covers full-world read isolation through a complete expedition and browser control toggles compared against an untouched reference session, plus follow tracking, orbit restoration, pause/reset, sensor-range changes, and pending-decision responsiveness.

- Final verification under Bun 1.4.2 passed: `bun run check` with installed Chromium, including typecheck, production build, all 75 Bun scenarios, and all 13 Playwright browser checks. The focused sensor browser scenario passed again after allowing one final render frame before its screenshot. Orbit, follow, full-world, wheel/suspension, and reduced/restored sensor screenshots were visually inspected. Existing dependency annotation, bundle-size, and Node runner warnings remain.

### Standards review

Reviewed the staged ticket changes against starting commit `c0cc0af4c1a1880742e61aa7e73d95fa482052ec`.

No actionable Standards findings: 0 documented-standard violations and 0 material baseline smells. The changes preserve the documented presentation/simulation boundary, keep full-world data detached from rover knowledge and controller inputs, use domain vocabulary consistently, and retain Bun for non-browser tests. Camera and articulation state remain in the scene layer; tests exercise public session and real-browser boundaries.

### Spec review

No actionable Spec findings for ticket 09. Follow tracking and orbit restoration remain independent of expedition advancement. Coverage uses the snapshot's position and sensor range directly; debug visibility stays in presentation state. The full-world read method returns detached data without changing knowledge or controller inputs. Wheel and suspension articulation depends on simulated distance and adds no physical simulation. Scenarios cover outcome isolation, switching, pauses, pending decisions, reset, and sensor changes. No missing requirements, incorrect implementations, or scope creep identified.

Review totals: Standards 0 findings; Spec 0 findings. No outstanding review issues.
