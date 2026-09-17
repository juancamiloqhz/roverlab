# Issue tracker: Local Markdown

Issues and specs for this repo live as Markdown files in `.scratch/`.

## Conventions

- One feature per directory: `.scratch/<feature-slug>/`.
- The spec is `.scratch/<feature-slug>/spec.md`.
- Implementation issues are separate files at `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01`.
- Record triage state in a `Status:` line near the top of each implementation issue. Use the roles in [triage-labels.md](triage-labels.md).
- Append comments and conversation history under `## Comments`.

## When a skill says "publish to the issue tracker"

Write the spec or individual issue files at the paths above, creating directories as needed.

## When a skill says "fetch the relevant ticket"

Read the referenced issue file. Resolve a ticket number within its feature directory; if more than one feature matches, request the feature or full path.

## Wayfinding operations

Used by `/wayfinder`. The map is a file with one child file per ticket.

- **Map:** `.scratch/<effort>/map.md`, containing Notes, Decisions-so-far, and Fog.
- **Child ticket:** `.scratch/<effort>/issues/NN-<slug>.md`, numbered from `01`, with the question in the body.
- **Type:** record `research`, `prototype`, `grilling`, or `task` in a `Type:` line.
- **Workflow state:** wayfinding tickets use `Status: open`, `Status: claimed`, or `Status: resolved`. If triage is also needed, record its role in a separate `Triage:` line.
- **Blocking:** list ticket numbers in `Blocked by: NN, NN`. A ticket is unblocked when every listed ticket is resolved.
- **Frontier:** scan the effort's issue files for open, unblocked tickets; the lowest number wins.
- **Claim:** set `Status: claimed` and save before starting work.
- **Resolve:** append the result under `## Answer`, set `Status: resolved`, and add a short result with a link to the map's Decisions-so-far.
