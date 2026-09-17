# Domain docs

RoverLab uses a single-context layout.

## Before exploring

- Read `CONTEXT.md` at the repository root for domain vocabulary.
- Read ADRs under `docs/adr/` that affect the area being explored or changed.

If these files do not exist, proceed silently. The `domain-modeling` skill creates them as terms or decisions are resolved.

## Layout

- `CONTEXT.md`: the repository's domain model and glossary.
- `docs/adr/NNNN-<decision-slug>.md`: architecture decision records.

## Use the glossary's vocabulary

When naming a domain concept in an issue, proposal, hypothesis, or test, use its term from `CONTEXT.md`.

If a needed concept is missing, check whether an existing term fits. Record a real vocabulary gap for `domain-modeling`.

## Surface ADR conflicts

If a proposal contradicts an existing ADR, identify that ADR and explain why the decision should be reconsidered.
