# 05: Make the baseline use scientific evidence and priorities

**What to build:** A baseline expedition makes understandable scientific and resource choices using the same observed evidence and structured mission priorities available to Jev, giving developers a credible rule-based alternative.

**Blocked by:** 04: Choose shared priorities or free-text instructions.

**Status:** ready-for-agent

**Parent spec:** [Fullscreen Jev decision lab](../spec.md). Primary user stories: 20-22, 26, 27, 40, 41, 69-76.

- [x] Replace the baseline's mission-agnostic preference for nearby samples with documented general rules for interpreting inspected sample properties against the selected scientific objective. Uninspected properties remain unknown.
- [x] Weigh scientific opportunities alongside known route duration and energy, remaining expedition time, battery, cargo, delivery opportunities, recharge, and observed storms. Keep the existing bounded action vocabulary and simulation-owned routing, execution, and scoring.
- [x] Apply the shared preset settings from ticket 04. Demonstrate situations where Balanced, Conserve energy, and Explore more produce an understandable difference while preserving their common objective and physical rules.
- [x] Use only the supplied controller input and candidates. Do not consult hidden classifications, numeric sample scores, unexplored terrain, or authored sample IDs as an answer key. Rule behavior must generalize beyond the current authored samples.
- [x] Produce a stable baseline version and an inspectable explanation of the rule that selected each action. Explain this as a code rule, not as a Jev reasoning transcript or a prediction that its action must succeed.
- [x] Retain a usable baseline in free-text mode while visibly disclosing that arbitrary instructions are not interpreted. No claim of matched language understanding is implied by running both controllers.
- [x] Allow ordinary baseline expeditions and explicit baseline continuation after a Jev failure. Record controller transitions and preserve mixed-controller attribution; improving the strategy must not introduce automatic takeover.
- [x] Store the baseline version and applicable rule evidence in decision history and completed records. Replaying an older record executes its recorded choices under its supported original rules rather than recomputing them with the new baseline.
- [x] Verify behavior through session-driven scientific, resource, and storm scenarios. Include evidence and objective changes that can alter a choice, preset-sensitive trade-offs, multiple deliveries, and missing knowledge. Relabeling samples must not reveal hidden value, although documented neutral tie-breaking may use stable identity.
- [x] Add a focused browser check for a baseline run and its rule explanation. Preserve validated import/export, local history, and inference-free legacy replay, then run the repository's required checks. Automated verification uses deterministic inputs and no paid inference.

Comparing this baseline with Jev at the same decision is ticket 10. Comparing complete matched expeditions is ticket 12. Larger-world tuning is ticket 13; no new world is required to demonstrate this strategy slice.

## Comments

- Implemented ticket 05 only. The versioned `evidence-priorities-v1` baseline interprets inspected properties against the fixed objective, ranks opportunities with the shared presets, and plans for energy, time, delivery, recharge, and known storms. Free-text mode uses Balanced defaults and discloses its language limitation. See [baseline rules](../../../docs/baseline-strategy.md).
- Every applied baseline decision records its code rule, preference source, return candidate, observed evidence, planning estimates, utilities, and exclusions. The timeline displays this evidence in live, saved, and replayed expeditions. Version 6 exports validate the metadata and preserve mixed-controller attribution; takeover remains explicit.
- Versions 1 through 5 replay their recorded choices without invoking the new baseline. The version 5 fixture was captured from the original session at `ce564809a4e3aed7c583a916b0c8ecb8950a3c04` before the implementation. Tests cover changed evidence and objectives, relabeling, unknown properties, all presets, multiple deliveries, resource constraints, storms, failure continuation, and record corruption.
- Existing simulator tests that deliberately collect unrelated samples or take unsafe trips now use an explicit greedy script. The current baseline delivers ten science points on the unchanged authored map under either objective, choosing Sample A for past water and Sample B for unusual minerals. This does not establish an advantage over Jev.

### Standards review

No documented-standard violations found. One low-priority duplication finding in duration planning was resolved with a shared local helper. The reviewer checked the follow-up validator and tests and reported no remaining Standards findings.

### Spec review

The reviewer found that editing the rule in both history copies could falsely label a collection as a recharge. The importer now checks rule applicability against the action and supporting input. Nine regression cases change both copies and verify rejection. The reviewer reran the baseline tests and confirmed the fix, with no other missing ticket requirements or scope creep.

Final review totals: Standards 0 remaining findings; Spec 0 remaining findings.

### Verification

- `bun run typecheck` and `bun run build` passed. Build output retains the existing dependency annotation and bundle-size warnings.
- Final `bun test`: 172 passed, 0 failed across 16 files.
- The browser suite exercised all 32 scenarios. Its one outdated expectation, collecting Sample A under the minerals objective, was updated and passed a focused rerun alongside the new baseline check. After the import-validation fix, all six baseline, storage, exchange, and replay browser checks passed again.
- Browser verification used the installed Chromium, deterministic clocks, and scripted provider transport. No paid inference was used.
- `git diff --check` passed.
