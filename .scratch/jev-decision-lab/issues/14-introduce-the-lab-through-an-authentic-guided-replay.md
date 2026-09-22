# 14: Introduce the lab through an authentic guided replay

**What to build:** A new developer can understand Jev's role, a baseline alternative, action consequences, and cost through a short guided replay without configuring a key. Clear entry points also support keyless baseline expeditions and live Jev with the user's own backend key.

**Blocked by:** 10: Compare Jev and baseline choices at the same decision; 13: Offer tuned benchmark scenarios.

**Status:** ready-for-agent

**Parent spec:** [Fullscreen Jev decision lab](../spec.md). Primary user stories: 1, 33-35, 39, 45-50, 57-59, 64-75, 77-80.

- [ ] Capture an authentic Jev expedition using the completed instrumentation, longer world, decision comparison, and benchmark behavior. Preserve the actual choices, probabilities, usage availability, resolved models, prompt and simulation versions, and recorded pricing basis. No authentic recording currently exists; capture is required work.
- [ ] Use a configured server-side key and explicit per-expedition attempt and estimated-cost limits for live capture. Keep capture separate from deterministic tests and respect usage uncertainty pauses. Do not introduce an unattended paid batch runner or provider-funded public demo.
- [ ] Retain capture failures, ties, losses, uncertainty, and controller transitions in the evaluation evidence. Explain which recording was selected for teaching; selection must not require Jev to beat the baseline. A failed or incomplete recording cannot be relabeled as successful completion.
- [ ] Run the matched baseline for the captured conditions and retain its actual outcome comparison. Representative live observations remain observations about those runs; claims of consistent advantage require repeated matched evidence with unfavorable results disclosed.
- [ ] Bundle a validated, credential-free expedition record with a short guided playback that introduces observations, a Jev decision, the same-state baseline alternative, code execution and consequences, and inference cost. Use the real record rather than prototype fixtures or fabricated model responses.
- [ ] Clearly label the experience as a replay. Display original calls, tokens, latency, and estimated cost as historical, with zero new provider activity during playback. Missing historical usage remains unavailable rather than zero or a substituted illustrative estimate.
- [ ] Drive the guide through recorded decision points and evidence using the selected fullscreen experience, historical inspection, and teaching controls. Keep scientific value, probabilities, baseline suggestions, and realized expedition outcomes distinct. The guide must not invent Jev's internal reasoning.
- [ ] Make guided replay and ordinary baseline expeditions work without a configured key. Provide a separate live-Jev entry point with the existing local backend setup workflow and visible limits. Never expose a key through browser configuration, assets, logs, or exports.
- [ ] Preserve local distribution, ordinary live controls, saved records, and validated import/export. The bundled source record stays unchanged during replay, comparison, or guide navigation, and supported legacy records remain usable.
- [ ] Verify the authentic record through validation, import/export, and deterministic replay of its original outcomes. Tests consume the captured artifact without contacting a provider or loading live credentials; a substitute scripted fixture does not satisfy the authentic-record acceptance criterion.
- [ ] Add focused desktop and narrow-screen browser checks for completing the guide, opening evidence and usage, viewing matched results, and entering a baseline expedition with provider routes blocked. Verify zero new inference during guide, inspection, comparison, and replay.
- [ ] Run the repository's required checks and document capture provenance, applicable limits, setup, and the distinction between deterministic verification and live evaluation evidence.

The preserved layout A prototype is a visual reference only. Its apparent choices, probabilities, costs, and outcomes must never be used as the authentic guided replay or as performance evidence.
