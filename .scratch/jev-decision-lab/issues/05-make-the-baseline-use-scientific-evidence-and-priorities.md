# 05: Make the baseline use scientific evidence and priorities

**What to build:** A baseline expedition makes understandable scientific and resource choices using the same observed evidence and structured mission priorities available to Jev, giving developers a credible rule-based alternative.

**Blocked by:** 04: Choose shared priorities or free-text instructions.

**Status:** ready-for-agent

**Parent spec:** [Fullscreen Jev decision lab](../spec.md). Primary user stories: 20-22, 26, 27, 40, 41, 69-76.

- [ ] Replace the baseline's mission-agnostic preference for nearby samples with documented general rules for interpreting inspected sample properties against the selected scientific objective. Uninspected properties remain unknown.
- [ ] Weigh scientific opportunities alongside known route duration and energy, remaining expedition time, battery, cargo, delivery opportunities, recharge, and observed storms. Keep the existing bounded action vocabulary and simulation-owned routing, execution, and scoring.
- [ ] Apply the shared preset settings from ticket 04. Demonstrate situations where Balanced, Conserve energy, and Explore more produce an understandable difference while preserving their common objective and physical rules.
- [ ] Use only the supplied controller input and candidates. Do not consult hidden classifications, numeric sample scores, unexplored terrain, or authored sample IDs as an answer key. Rule behavior must generalize beyond the current authored samples.
- [ ] Produce a stable baseline version and an inspectable explanation of the rule that selected each action. Explain this as a code rule, not as a Jev reasoning transcript or a prediction that its action must succeed.
- [ ] Retain a usable baseline in free-text mode while visibly disclosing that arbitrary instructions are not interpreted. No claim of matched language understanding is implied by running both controllers.
- [ ] Allow ordinary baseline expeditions and explicit baseline continuation after a Jev failure. Record controller transitions and preserve mixed-controller attribution; improving the strategy must not introduce automatic takeover.
- [ ] Store the baseline version and applicable rule evidence in decision history and completed records. Replaying an older record executes its recorded choices under its supported original rules rather than recomputing them with the new baseline.
- [ ] Verify behavior through session-driven scientific, resource, and storm scenarios. Include evidence and objective changes that can alter a choice, preset-sensitive trade-offs, multiple deliveries, and missing knowledge. Relabeling samples must not reveal hidden value, although documented neutral tie-breaking may use stable identity.
- [ ] Add a focused browser check for a baseline run and its rule explanation. Preserve validated import/export, local history, and inference-free legacy replay, then run the repository's required checks. Automated verification uses deterministic inputs and no paid inference.

Comparing this baseline with Jev at the same decision is ticket 10. Comparing complete matched expeditions is ticket 12. Larger-world tuning is ticket 13; no new world is required to demonstrate this strategy slice.
