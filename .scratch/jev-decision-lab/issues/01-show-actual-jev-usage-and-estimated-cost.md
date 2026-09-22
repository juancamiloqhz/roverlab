# 01: Show actual Jev usage and estimated cost

**What to build:** Mission control can inspect the actual provider activity behind a Jev choice, see its token-derived estimated cost, and retain that evidence when saving or replaying the expedition. The current interface can demonstrate this behavior before the fullscreen layout lands.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

**Parent spec:** [Fullscreen Jev decision lab](../spec.md). Primary user stories: 5, 51, 52, 54-57, 69-75, 77.

- [ ] Distinguish controller decisions, local submissions, confirmed provider attempts, and retries in the session's public data and visible usage breakdown. Count an attempt when the backend initiates outbound provider access. A confirmed rejection before dispatch, including missing credentials or invalid input, contributes zero provider attempts.
- [ ] Assign stable expedition, decision, and attempt identities and carry them through the validated browser/backend exchange and saved history. Keep execution and accounting data associated with their originating decision rather than deriving provider counts from the browser's local request counter.
- [ ] Preserve successful SDK response metadata, including the resolved model, input/output token usage, and safe provider request identity when available. Record the prompt version associated with the decision; a requested floating model alias must not masquerade as the resolved model.
- [ ] Record decision latency, cumulative inference wait, and available attempt timing as wall-time measurements. Do not charge inference wait to simulated expedition time or sum overlapping measurements as additional elapsed time.
- [ ] Calculate per-decision and expedition estimates from token usage and an explicit model-specific pricing basis. Record the rates, currency, capture time, and pricing provenance used. Verify the applicable official pricing during implementation; do not derive dollars from request counts.
- [ ] Display the token and rate breakdown with enough precision to distinguish small nonzero costs. Label monetary values as estimated inference cost. Missing tokens, unknown prices, and unavailable model metadata remain visibly incomplete rather than becoming zero or a guessed value.
- [ ] Include the new evidence in local saving and validated export/import. Reopening and replaying a record preserves its original pricing basis and makes no inference requests. Supported legacy records retain the historical meaning of their counters, with missing cost and usage marked unavailable.
- [ ] Keep provider credentials and raw provider error bodies out of browser state, logs, and exported evidence. Preserve the existing one-decision-at-a-time execution, five-second deadline, pause behavior, and bounded action validation.
- [ ] Exercise the real session, controller, backend, and TypeSafe SDK against a scripted provider. Verify exact outbound counts for success and pre-dispatch rejection, metadata propagation, independent wall time, known estimates, unknown pricing, and saved-record round trips. Add a focused browser check for the visible breakdown; automated tests make no paid calls.
- [ ] Run the repository's required checks for this slice. Preserve supported legacy replay and the source record during inspection.

Failed, cancelled, and late-response reconciliation is ticket 02. Configurable limits and uncertainty pauses are ticket 03. This ticket establishes their accounting identities and visible data without expanding into those behaviors.
