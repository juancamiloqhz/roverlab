# 14: Introduce the lab through an authentic guided replay

**What to build:** A new developer can understand Jev's role, a baseline alternative, action consequences, and cost through a short guided replay without configuring a key. Clear entry points also support keyless baseline expeditions and live Jev with the user's own backend key.

**Blocked by:** 10: Compare Jev and baseline choices at the same decision; 13: Offer tuned benchmark scenarios.

**Status:** ready-for-agent

**Parent spec:** [Fullscreen Jev decision lab](../spec.md). Primary user stories: 1, 33-35, 39, 45-50, 57-59, 64-75, 77-80.

- [x] Capture an authentic Jev expedition using the completed instrumentation, longer world, decision comparison, and benchmark behavior. Preserve the actual choices, probabilities, usage availability, resolved models, prompt and simulation versions, and recorded pricing basis. No authentic recording currently exists; capture is required work.
- [x] Use a configured server-side key and explicit per-expedition attempt and estimated-cost limits for live capture. Keep capture separate from deterministic tests and respect usage uncertainty pauses. Do not introduce an unattended paid batch runner or provider-funded public demo.
- [x] Retain capture failures, ties, losses, uncertainty, and controller transitions in the evaluation evidence. Explain which recording was selected for teaching; selection must not require Jev to beat the baseline. A failed or incomplete recording cannot be relabeled as successful completion.
- [x] Run the matched baseline for the captured conditions and retain its actual outcome comparison. Representative live observations remain observations about those runs; claims of consistent advantage require repeated matched evidence with unfavorable results disclosed.
- [x] Bundle a validated, credential-free expedition record with a short guided playback that introduces observations, a Jev decision, the same-state baseline alternative, code execution and consequences, and inference cost. Use the real record rather than prototype fixtures or fabricated model responses.
- [x] Clearly label the experience as a replay. Display original calls, tokens, latency, and estimated cost as historical, with zero new provider activity during playback. Missing historical usage remains unavailable rather than zero or a substituted illustrative estimate.
- [x] Drive the guide through recorded decision points and evidence using the selected fullscreen experience, historical inspection, and teaching controls. Keep scientific value, probabilities, baseline suggestions, and realized expedition outcomes distinct. The guide must not invent Jev's internal reasoning.
- [x] Make guided replay and ordinary baseline expeditions work without a configured key. Provide a separate live-Jev entry point with the existing local backend setup workflow and visible limits. Never expose a key through browser configuration, assets, logs, or exports.
- [x] Preserve local distribution, ordinary live controls, saved records, and validated import/export. The bundled source record stays unchanged during replay, comparison, or guide navigation, and supported legacy records remain usable.
- [x] Verify the authentic record through validation, import/export, and deterministic replay of its original outcomes. Tests consume the captured artifact without contacting a provider or loading live credentials; a substitute scripted fixture does not satisfy the authentic-record acceptance criterion.
- [x] Add focused desktop and narrow-screen browser checks for completing the guide, opening evidence and usage, viewing matched results, and entering a baseline expedition with provider routes blocked. Verify zero new inference during guide, inspection, comparison, and replay.
- [x] Run the repository's required checks and document capture provenance, applicable limits, setup, and the distinction between deterministic verification and live evaluation evidence.

The preserved layout A prototype is a visual reference only. Its apparent choices, probabilities, costs, and outcomes must never be used as the authentic guided replay or as performance evidence.


## Comments

- Implemented ticket 14 only in selected fullscreen layout A. The ready screen offers the authentic six-step guided replay, a keyless baseline expedition, and live Jev setup with visible limits. Evidence, historical usage, actual matched outcomes, original JSON export, and ordinary recorded replay remain accessible.
- Captured one authentic Jev Evidence survey expedition with the configured server-side key after verifying credential placement, current pricing, the five-second deadline, retry policy, and explicit 250-attempt/$0.10 limits. Ten choices applied; attempt 11 returned HTTP 400 without usage. Capture stopped at the uncertainty pause at 02:12 with zero delivered science. It remains labeled unfinished. No uncertainty was acknowledged, limits raised, controller switched, or unfavorable run discarded.
- The original record and independently executed matched baseline are bundled under `public/guided/`. The baseline reached its eighteen-minute budget at base with 10 science. Capture metadata retains hashes and identities; `docs/guided-replay.md` records provenance, selection rationale, known and unavailable usage, limits, and setup. This is single-run evidence, with no claim of consistent controller advantage.
- Guided playback uses recorded decisions and public replay teaching/inspection commands. It makes no inference calls, preserves source exports, and displays original usage as historical. Missing usage remains unavailable. No simulation, prompt, scoring, baseline, or record-version behavior changed.

## Standards

The review found one loading race: a live expedition could start while the guide's assets loaded. The live workspace is now inert during loading and pauses again before entering the guide. The reviewer confirmed resolution; a delayed-assets browser test covers the transition. No unresolved Standards findings.

## Spec

No Spec findings. The review verified the authentic artifact hashes, retained failure and uncertainty, matched baseline evidence, keyless guide, separate live setup, source preservation, and scope.

Review totals: Standards 0 unresolved findings; Spec 0 findings.


## Verification

- `env -u TYPESAFE_API_KEY bun --no-env-file test`: 268 passed, 0 failed across 24 files, with 4,194 assertions. The authentic artifacts reproduce their original snapshots, decisions, teaching pauses, source exports, and independently executed baseline outcomes.
- Final `bun run typecheck` and `bun run build` passed. Existing dependency annotation and bundle-size warnings remain.
- Full browser run: 60 passed, 1 failed. The existing intervention-schedule keyboard check intermittently failed to close its panel with Escape. Both intervention checks passed unchanged on the focused rerun.
- Final focused browser run: 6 passed, covering all four guide checks and both intervention checks. Across the full run and focused verification, all 62 distinct browser scenarios passed. Guide checks block local and external provider routes and assert zero calls across navigation, inspection, matched comparison, original JSON export, ordinary replay, and baseline entry. Missing-artifact handling and live setup limits are covered. The delayed-assets check confirms live controls are inert before guide entry.
- Desktop and 390-pixel screenshots were inspected. Panels scroll without page overflow, can be hidden for world inspection, and preserve guide controls, recorded telemetry, and camera access. Final guide changes passed typecheck and production build.
- `git diff --check` passed. Implementation and review fixes are committed on the original `main` branch. No live inference ran during deterministic verification or review.
