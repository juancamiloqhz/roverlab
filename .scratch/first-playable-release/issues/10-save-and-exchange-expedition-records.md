# 10: Save and exchange expedition records

**What to build:** Reopen completed expeditions from browser storage and export or import their full histories as JSON.

**Blocked by:** 07: Recover explicitly from inference failures; 08: Respond to a localized dust storm

**Status:** ready-for-agent

- [x] Save completed expeditions locally in the browser and provide a list from which mission control can reopen results and the decision timeline.
- [x] Preserve the starting scenario, scientific objective and rubric, instruction changes, environmental events, decisions, executed actions, controller history, and results needed to reproduce the actual expedition.
- [x] Retain baseline-only, TypeSafe-only, and explicitly mixed-controller histories, including inference usage and latency, without fabricating probabilities.
- [x] Export a selected expedition as JSON and import a valid record through the interface; reopening an imported record displays its saved observations, timeline, and results.
- [x] Validate the record contract before accepting imported data; reject invalid records with an understandable message instead of partially executing or trusting them as live commands.
- [x] Exclude credentials from saved/exported records and logs. Opening saved records does not call TypeSafe or advance a live expedition.
- [x] Round-trip expeditions containing instruction changes, storm events, failure/recovery, and controller transitions through storage and export/import, preserving the recorded data.
- [x] Check browser persistence across reload, record selection, export/import, invalid import feedback, and absence of a key requirement when inspecting records.

## Comments

- Added detached, versioned completed-expedition records at the public session boundary. Each record preserves its starting scenario/settings, per-expedition events, complete decisions, and final results/observations/memory. Completion waits for cancelled inference to settle, retaining its attempts and latency across reset.
- Completed expeditions save automatically to browser-local IndexedDB. Mission control can select a saved run, inspect its results and timeline, export JSON, or import validated JSON through the interface. Opening a record pauses an active live expedition without advancing it and performs no inference.
- The strict version 1 contract rejects unsupported versions, unknown fields, malformed histories, invalid selections/probabilities, and inconsistent results. JSON imports are bounded to 32 MB. Duplicate imports are idempotent; conflicting identities preserve the existing record. Storage failures leave current-page completed records available for export with visible feedback.
- Added session scenarios for baseline, TypeSafe, and mixed histories, instructions/storms, failure/recovery, credential exclusion, and cancellation/reset races. Browser scenarios cover reload, selection, export/import, invalid feedback, and inspection with backend access blocked.
- Scope remains ticket 10: no replay execution, comparison, tuning, hosting, or external storage.

### Standards review

Reviewed the staged ticket changes against starting commit `ddd87df01e3d1b18985d8b62747926846dd7c922`, including the follow-up corrections. No actionable Standards findings: no documented-standard violations or material smell-baseline findings. Completion records remain detached from live state; persistence and inspection stay outside simulation execution and inference. Tooling, domain vocabulary, and behavioral test boundaries follow repository instructions.

### Spec review

Three findings were resolved before committing:

- Imported partial or inconsistent histories could pass shape validation. Validation now reconciles recorded decision requests, inference attempts, outcomes, executed action lifecycles, mission edits, and controller transitions with the saved timeline and results, without executing simulation commands.
- Accepted instruction text could exceed the record contract's existing 20,000-character limit. The shared limit now guards the session before mutation; the interface preserves oversized drafts, explains the limit, and prevents applying them.
- An empty imported controller history could expose a technical exception. The lookup is guarded and malformed input receives the defined understandable validation message.

The final Spec review reported no outstanding findings. Review totals: Standards 0 findings; Spec 3 resolved findings (highest severity P2), 0 outstanding. Replay, comparison, and tuning remain outside this ticket.

### Final verification

`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium bun run check` passed under Bun 1.4.2: typechecking, production build, all 83 Bun scenarios, and all 17 Playwright browser checks. Focused record scenarios and camera-follow regression checks also passed. The saved-record results, timeline, observations, and import/conflict feedback screenshot was visually inspected. Existing dependency annotation, bundle-size, and Node browser-runner warnings remain. Verification used scripted inference only, with no live credentials or paid service calls.
