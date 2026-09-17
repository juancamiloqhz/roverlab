# 03: Inspect, collect, and deliver scientific samples

**What to build:** Choose a scientific objective and watch the rover inspect, collect, and deliver samples for objective-specific scores.

**Blocked by:** 02: Discover the area through limited perception

**Status:** ready-for-agent

- [x] Offer Investigate past water and Find unusual minerals before an expedition; lock the selected objective and rubric for its duration, and start a new expedition to change it.
- [x] Author sample properties and objective-specific classifications that award 0 for unrelated, 5 for suggestive, and 10 for strong evidence.
- [x] Inspection travels to a discovered sample and reveals its properties after consuming expedition time. Hidden properties remain absent from earlier observations and decisions.
- [x] Collection travels to a sample and picks it up only when physical conditions and the two-slot cargo limit permit. Inspection and collection remain distinct actions.
- [x] The baseline controller can choose inspection, collection, and return-to-base candidates alongside exploration and waiting.
- [x] Returning to base unloads automatically. Calculate science score from the fixed rubric independently of controller choice and credit each delivered sample once.
- [x] Show cargo, science score, discovery count, and inspection count. Cargo still aboard at timeout or manual stop earns no delivery credit.
- [x] Exercise a complete discovery-to-delivery expedition, both objectives, all score classifications, full cargo, unavailable samples, and ending with undelivered cargo through the agreed behavioral boundary.

## Comments

- Implemented objective selection and locking at the expedition boundary. Reset creates a fresh expedition, preserves the last selection, and unlocks it. The fixed rubric gives unrelated/suggestive/strong-evidence deliveries 0/5/10 points independently of controller choice.
- Inspection travels through known terrain and spends six seconds revealing properties. Collection is a separate four-second interaction. Candidates exclude unavailable or unreachable samples and collection with full cargo; execution rechecks the sample, location, availability, and capacity. Returning unloads cargo automatically and credits each sample once.
- The baseline pursues nearby samples, returns with full cargo or when no further sample is reachable, then resumes exploration. Both objectives use the same baseline strategy with different delivery scores. Interaction and return time can leave sites undiscovered or cargo undelivered at timeout.
- Mission control shows objective, rubric, cargo, science score, discoveries, inspections, deliveries, and inspection details. Collected samples disappear from the scene and retain their history. End results identify uncredited onboard cargo. Records retain objective selections and timestamped inspection, collection, and delivery events separately from controller inputs.
- The agreed public-session scenarios cover the complete loop, both objectives, all three score classifications, another trip after unloading, blocked and unavailable samples, full capacity, inspection timing and pause, reset, hidden-property isolation, single delivery credit, and cargo at manual stop/timeout. Browser checks cover objective selection/locking and visible discovery-to-delivery behavior.
- Validation passed on Bun 1.4.2: typechecking, production build, all 14 Bun scenarios, and all 3 Playwright checks using system Chromium. The 11 affected science/perception scenarios, focused science browser check, typecheck, and build passed again after review refactoring. Vite retains its existing large-chunk warning. Spec review found no issues; Standards review's two maintainability findings were resolved and rechecked, leaving no open findings.
