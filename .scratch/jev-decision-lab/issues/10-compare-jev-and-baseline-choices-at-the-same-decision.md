# 10: Compare Jev and baseline choices at the same decision

**What to build:** Alongside a Jev decision, mission control can see what the improved baseline would choose from exactly the same knowledge and action candidates, including where their choices agree or differ.

**Blocked by:** 05: Make the baseline use scientific evidence and priorities; 09: Inspect decisions spatially and use teaching mode.

**Status:** ready-for-agent

**Parent spec:** [Fullscreen Jev decision lab](../spec.md). Primary user stories: 1, 31, 33-36, 39-41, 49, 50, 69-76, 78.

- [ ] At each Jev decision, evaluate the baseline against a detached copy of the exact controller input and candidate set supplied for that decision. Include the same mission, knowledge, resources, and available routes without adding hidden information.
- [ ] Record the alternative action, the selecting baseline rule, and baseline version with the decision. The comparison must not mutate the live session or input, execute a second rover, advance time, consume resources, or issue an additional Jev request.
- [ ] Display agreement or disagreement alongside the selected Jev action in the card or inspector. Base the comparison on the complete recorded action and target, including route distinctions that affect execution, rather than a matching action label alone.
- [ ] Link both choices to their recorded targets in the map view. Handle non-spatial actions explicitly and provide readable labels on desktop and narrow screens without depending on color alone.
- [ ] Keep pending, failed, and obsolete Jev results distinct from an applied choice. An available baseline alternative does not imply that Jev chose it, that it executed, or that the controller changed.
- [ ] Show the baseline rule explanation as code behavior and Jev's probabilities as model output. Label a differing action as a decision comparison, not proof of a better expedition outcome. Preserve the free-text limitation disclosure where relevant.
- [ ] Persist alternatives and their provenance through local saving, validated export/import, and inference-free replay. Historical inspection uses the saved alternative, not a recomputation with today's baseline. Legacy records without an alternative show it as unavailable and remain unchanged.
- [ ] Verify agreement, disagreement, distinct routes, missing Jev results, and non-spatial actions through the session boundary. Assert input immutability, unchanged live outcomes, and no extra provider dispatch or duplicate choice execution.
- [ ] Add focused browser checks for linked choices, history selection, provenance, and the distinction between suggested actions and realized outcomes. Preserve legacy replay and run the repository's required checks without paid inference.

Complete matched-expedition outcomes are ticket 12. This ticket delivers a comparison at one decision and must not predict the result of a route that was never executed.
