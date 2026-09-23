# 10: Compare Jev and baseline choices at the same decision

**What to build:** Alongside a Jev decision, mission control can see what the improved baseline would choose from exactly the same knowledge and action candidates, including where their choices agree or differ.

**Blocked by:** 05: Make the baseline use scientific evidence and priorities; 09: Inspect decisions spatially and use teaching mode.

**Status:** ready-for-agent

**Parent spec:** [Fullscreen Jev decision lab](../spec.md). Primary user stories: 1, 31, 33-36, 39-41, 49, 50, 69-76, 78.

- [x] At each Jev decision, evaluate the baseline against a detached copy of the exact controller input and candidate set supplied for that decision. Include the same mission, knowledge, resources, and available routes without adding hidden information.
- [x] Record the alternative action, the selecting baseline rule, and baseline version with the decision. The comparison must not mutate the live session or input, execute a second rover, advance time, consume resources, or issue an additional Jev request.
- [x] Display agreement or disagreement alongside the selected Jev action in the card or inspector. Base the comparison on the complete recorded action and target, including route distinctions that affect execution, rather than a matching action label alone.
- [x] Link both choices to their recorded targets in the map view. Handle non-spatial actions explicitly and provide readable labels on desktop and narrow screens without depending on color alone.
- [x] Keep pending, failed, and obsolete Jev results distinct from an applied choice. An available baseline alternative does not imply that Jev chose it, that it executed, or that the controller changed.
- [x] Show the baseline rule explanation as code behavior and Jev's probabilities as model output. Label a differing action as a decision comparison, not proof of a better expedition outcome. Preserve the free-text limitation disclosure where relevant.
- [x] Persist alternatives and their provenance through local saving, validated export/import, and inference-free replay. Historical inspection uses the saved alternative, not a recomputation with today's baseline. Legacy records without an alternative show it as unavailable and remain unchanged.
- [x] Verify agreement, disagreement, distinct routes, missing Jev results, and non-spatial actions through the session boundary. Assert input immutability, unchanged live outcomes, and no extra provider dispatch or duplicate choice execution.
- [x] Add focused browser checks for linked choices, history selection, provenance, and the distinction between suggested actions and realized outcomes. Preserve legacy replay and run the repository's required checks without paid inference.

Complete matched-expedition outcomes are ticket 12. This ticket delivers a comparison at one decision and must not predict the result of a route that was never executed.


## Comments

- Implemented ticket 10 in the selected Expedition layout A. Each live Jev decision records a detached baseline alternative before dispatch, including the complete action and `evidence-priorities-v1` rule evidence. Jev remains the only executing controller unless mission control explicitly changes it.
- The card and inspector compare complete actions, including route differences. Numbered map labels distinguish Jev's selection and the baseline suggestion. The inspector preserves the free-text limitation and separates model probabilities, code rules, and realized outcomes.
- Version 10 records validate alternative candidates, rules, provenance, and history consistency. Local saving, import/export, and replay preserve saved alternatives. Versions 1 through 9 keep missing alternatives unavailable. A version 9 fixture was captured before implementation from `f869343ab51d8a2a629dcaa6330a613c6c852a24` using a scripted choice.
- Session checks cover agreement, disagreement, distinct routes to the same target, waiting, recharge, pending and missing Jev results, detached inputs, unchanged physical outcomes, single execution, and no extra provider dispatch. Browser checks cover linked targets, history, saved provenance, route distinctions, pending and failed results, touch controls, and legacy replay.
- Full matched-expedition outcomes remain ticket 12. No paid inference or authentic-record capture is included.

## Standards

No documented-standard breaches or actionable heuristic smells found. The review checked the public session boundary, detached inputs, frozen pending time, saved-alternative replay, domain terminology, and repository instructions. Shared validation and evidence rendering avoid duplicating baseline rules.

## Spec

No actionable findings. The review confirmed ticket 10's exact-input evaluation, complete route comparison, saved provenance, status distinctions, legacy preservation, free-text disclosure, and layout A integration. No ticket 12 scope creep was found.

Review totals: Standards 0 findings; Spec 0 findings.

## Verification

- Typechecking and the production build pass. The build retains the existing dependency annotation and bundle-size warnings.
- The full Bun suite passes: 229 tests, 2,741 assertions across 20 files.
- Deterministic session checks and the real backend/SDK use scripted provider transport. No paid inference was used.
- Desktop and 390 by 844 touch-layout screenshots were visually reviewed. The comparison inspector remains readable and camera and transport controls remain reachable.
- All 51 browser scenarios pass in the full run using installed Chromium, including six new ticket 10 scenarios and the existing persistence, replay, fullscreen, recovery, usage, and legacy checks.
- `git diff --check` passes.
