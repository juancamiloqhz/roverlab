# 02: Discover the area through limited perception

**What to build:** Explore the designed three-site area as terrain and samples become visible within sensor range.

**Blocked by:** 01: Watch an autonomous expedition

**Status:** ready-for-agent

- [ ] Author one repeatable area with a base and three sample sites: accessible, distant, and tempting near the planned hazard location; terrain and obstacles affect navigation.
- [ ] Reveal terrain and objects in the main scene only as the rover discovers them; sensors accurately observe within their current range.
- [ ] Retain timestamped observations in rover memory and distinguish current observations from remembered information without assuming remembered conditions are still current.
- [ ] Construct concrete exploration targets and route estimates from the known map. Undiscovered samples, hidden terrain, and sample properties do not leak into controller inputs or candidate availability.
- [ ] The baseline controller explores the area using its supplied observations and candidates; blocked routes and newly detected obstacles cannot result in physically invalid movement.
- [ ] Record discoveries and observation times, and expose discovery progress to mission control.
- [ ] Verify the exact information presented to the controller, memory retention, route blocking, and reset through expedition scenarios; check visible discovery in the browser.
