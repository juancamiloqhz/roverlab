# 03: Inspect, collect, and deliver scientific samples

**What to build:** Choose a scientific objective and watch the rover inspect, collect, and deliver samples for objective-specific scores.

**Blocked by:** 02: Discover the area through limited perception

**Status:** ready-for-agent

- [ ] Offer Investigate past water and Find unusual minerals before an expedition; lock the selected objective and rubric for its duration, and start a new expedition to change it.
- [ ] Author sample properties and objective-specific classifications that award 0 for unrelated, 5 for suggestive, and 10 for strong evidence.
- [ ] Inspection travels to a discovered sample and reveals its properties after consuming expedition time. Hidden properties remain absent from earlier observations and decisions.
- [ ] Collection travels to a sample and picks it up only when physical conditions and the two-slot cargo limit permit. Inspection and collection remain distinct actions.
- [ ] The baseline controller can choose inspection, collection, and return-to-base candidates alongside exploration and waiting.
- [ ] Returning to base unloads automatically. Calculate science score from the fixed rubric independently of controller choice and credit each delivered sample once.
- [ ] Show cargo, science score, discovery count, and inspection count. Cargo still aboard at timeout or manual stop earns no delivery credit.
- [ ] Exercise a complete discovery-to-delivery expedition, both objectives, all score classifications, full cargo, unavailable samples, and ending with undelivered cargo through the agreed behavioral boundary.
