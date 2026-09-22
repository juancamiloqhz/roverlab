# 01: Show actual Jev usage and estimated cost

**What to build:** Mission control can inspect the actual provider activity behind a Jev choice, see its token-derived estimated cost, and retain that evidence when saving or replaying the expedition. The current interface can demonstrate this behavior before the fullscreen layout lands.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

**Parent spec:** [Fullscreen Jev decision lab](../spec.md). Primary user stories: 5, 51, 52, 54-57, 69-75, 77.

- [x] Distinguish controller decisions, local submissions, confirmed provider attempts, and retries in the session's public data and visible usage breakdown. Count an attempt when the backend initiates outbound provider access. A confirmed rejection before dispatch, including missing credentials or invalid input, contributes zero provider attempts.
- [x] Assign stable expedition, decision, and attempt identities and carry them through the validated browser/backend exchange and saved history. Keep execution and accounting data associated with their originating decision rather than deriving provider counts from the browser's local request counter.
- [x] Preserve successful SDK response metadata, including the resolved model, input/output token usage, and safe provider request identity when available. Record the prompt version associated with the decision; a requested floating model alias must not masquerade as the resolved model.
- [x] Record decision latency, cumulative inference wait, and available attempt timing as wall-time measurements. Do not charge inference wait to simulated expedition time or sum overlapping measurements as additional elapsed time.
- [x] Calculate per-decision and expedition estimates from token usage and an explicit model-specific pricing basis. Record the rates, currency, capture time, and pricing provenance used. Verify the applicable official pricing during implementation; do not derive dollars from request counts.
- [x] Display the token and rate breakdown with enough precision to distinguish small nonzero costs. Label monetary values as estimated inference cost. Missing tokens, unknown prices, and unavailable model metadata remain visibly incomplete rather than becoming zero or a guessed value.
- [x] Include the new evidence in local saving and validated export/import. Reopening and replaying a record preserves its original pricing basis and makes no inference requests. Supported legacy records retain the historical meaning of their counters, with missing cost and usage marked unavailable.
- [x] Keep provider credentials and raw provider error bodies out of browser state, logs, and exported evidence. Preserve the existing one-decision-at-a-time execution, five-second deadline, pause behavior, and bounded action validation.
- [x] Exercise the real session, controller, backend, and TypeSafe SDK against a scripted provider. Verify exact outbound counts for success and pre-dispatch rejection, metadata propagation, independent wall time, known estimates, unknown pricing, and saved-record round trips. Add a focused browser check for the visible breakdown; automated tests make no paid calls.
- [x] Run the repository's required checks for this slice. Preserve supported legacy replay and the source record during inspection.

Failed, cancelled, and late-response reconciliation is ticket 02. Configurable limits and uncertainty pauses are ticket 03. This ticket establishes their accounting identities and visible data without expanding into those behaviors.


## Comments

- Implemented ticket 01 in the existing interface. Public session usage distinguishes controller decisions, Jev decisions, local submissions, confirmed outbound provider attempts, provider retries, and unconfirmed submissions. The original `inferenceAttempts` counter and 100-submission guard retain their local meaning.
- The backend instruments the SDK's outbound transport and returns validated evidence tied to expedition, decision, and attempt identities. It retains successful resolved-model, token, request-ID, prompt-version, and wall-time metadata. Confirmed pre-dispatch rejection contributes zero provider attempts. SDK logging remains disabled, and credentials and raw provider errors stay outside exported evidence.
- Token-derived estimates record the rates, model, USD currency, capture time, verification date, and official source. The [TypeSafe model reference](https://docs.typesafe.ai/models), verified September 22, 2026, lists `jev-1.13.0` at $0.042 per million input tokens and free output. Missing metadata or prices leave totals incomplete with a separately labeled known subtotal. Replay uses historical rates without repricing.
- Version 2 records validate evidence identities and totals against the event history. Version 1 records remain inspectable and replayable with their original counters and unavailable new metadata. The legacy fixture was generated from starting commit `9713ae8` using its real session, backend, and SDK against a scripted provider.
- Live telemetry, each Jev decision, results, saved inspection, replay, and comparison expose the breakdown. Inference wait remains separate from expedition time; attempt durations are not added to decision latency. Failed/cancelled/late reconciliation and configurable limits remain tickets 02 and 03.


### Standards review

No findings. No documented-standard violations or material baseline smells found. The changes preserve Bun tooling, simulation/rendering separation, server-only credentials, frozen expedition time during inference, and faithful record replay. Shared accounting schemas and summaries keep live usage and imported-record validation consistent.

### Spec review

No findings. The implementation covers confirmed provider dispatch, pre-dispatch rejection, stable identities, successful SDK metadata, independent wall-time measurements, recorded model pricing, visible cost breakdowns, and validated version 2 saving/replay while preserving legacy counter meaning. The tests exercise the real session/controller/backend/SDK path with scripted provider responses. No missing ticket requirements, incorrect implemented behavior, or scope creep were identified. Reconciliation and configurable usage guards remain tickets 02 and 03.

Review totals: Standards 0 findings; Spec 0 findings. Both agents reviewed the staged implementation against starting commit `9713ae89b49007171e7342e8563f56a53434ca37` before commit. No outstanding issue remains on either axis.

### Final verification

`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium bun run check` passed under Bun 1.4.2: typechecking, production build, all 110 Bun tests, and all 24 Playwright browser checks. Focused usage, record, replay, and TypeSafe scenarios passed during implementation. Desktop and narrow-screen usage screenshots were inspected. Existing dependency-annotation, bundle-size, and Node browser-runner warnings remain. All provider access used scripted responses; no paid calls or live credentials were used.
