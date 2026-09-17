# 02: Discover the area through limited perception

**What to build:** Explore the designed three-site area as terrain and samples become visible within sensor range.

**Blocked by:** 01: Watch an autonomous expedition

**Status:** ready-for-agent

- [x] Author one repeatable area with a base and three sample sites: accessible, distant, and tempting near the planned hazard location; terrain and obstacles affect navigation.
- [x] Reveal terrain and objects in the main scene only as the rover discovers them; sensors accurately observe within their current range.
- [x] Retain timestamped observations in rover memory and distinguish current observations from remembered information without assuming remembered conditions are still current.
- [x] Construct concrete exploration targets and route estimates from the known map. Undiscovered samples, hidden terrain, and sample properties do not leak into controller inputs or candidate availability.
- [x] The baseline controller explores the area using its supplied observations and candidates; blocked routes and newly detected obstacles cannot result in physically invalid movement.
- [x] Record discoveries and observation times, and expose discovery progress to mission control.
- [x] Verify the exact information presented to the controller, memory retention, route blocking, and reset through expedition scenarios; check visible discovery in the browser.

## Comments

- Implemented through the public expedition-session boundary. Three-cell sensors reveal terrain and objects during movement; memory retains last-seen timestamps. Frontier candidates and travel-time estimates use only known traversable terrain. Unknown cells cannot be routed through.
- The authored area has accessible Sample A, Sample B beside the planned storm center at (15, 13), and distant Sample C. Plain/rough terrain takes four/eight seconds per entered cell. The baseline discovers all three sites within the five-minute expedition.
- The main scene and mission control show only rover knowledge, distinguish remembered observations, and reset to initial perception. Records separate full starting conditions from exact controller inputs and timestamped discoveries.
- Focused Bun scenarios cover exact controller information, hidden-world independence, memory retention, sensor boundaries, blocked routes, terrain costs, playback invariance, and reset. The browser scenario checks discovery, remembered sample labels/times, and reset. Inspection, collection, energy, storms, sensor overlays, and full-world view remain in their own tickets.
- Validation: `bun run check` passed using Bun 1.4.2 and system Chromium: typechecking, production build, 8 Bun scenarios, and 2 Playwright checks. The production build retains Vite's large-chunk warning. Independent Standards and Spec reviews found no issues.
