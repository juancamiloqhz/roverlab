# Authentic guided replay

Ticket 14 bundles the first live Evidence survey capture, including its failure. Start guided replay on the ready screen. Six steps show observations, Jev's choice, the same-state baseline alternative, recorded movement, original cost, and actual outcomes in fullscreen layout A. Evidence, Usage, Matched results, and Record & replay remain available throughout. Hide panel exposes the world for camera inspection, and the navigation buttons reopen panels. Escape returns to the guide. Exit or Finish returns to the ready expedition.

The guide requires no key and makes no inference requests. Its top usage figures are totals for the original capture, not new playback activity. The guide pauses at decision 2 using replay teaching mode. Step 4 executes that action at 4×, then holds decision 3. Previous/next navigation reconstructs recorded states; it never asks a controller for a replacement choice. Original JSON exports remain unchanged. Ordinary saved records, validated import/export, and legacy playback use their existing paths.

## Capture provenance and selection

One live run was captured on September 23, 2026, starting at 16:29:46 UTC, using the current session, backend handler, and official TypeSafe SDK. Simulation and inference implementation were at `b6578db0908ccc45aba8111ebc4f94a7bc3ee24b`. The handler ran in the server-side Bun capture process, with its credential read from the ignored local `.env`. No browser or scripted provider participated. SDK logging was off. Credential presence was checked without printing the key, and exported records were checked against the credential before writing.

- [Capture metadata](evaluation/capture-2026-09-23/capture.json) preserves identities, timestamps, limits, stop reason, totals, and selection rationale.
- [Original Jev record](../public/guided/jev.json) retains all ten applied choices and the eleventh failed decision, probabilities, same-state baseline alternatives, token availability, latency, model, prices, events, and results.
- [Matched baseline record](../public/guided/baseline.json) retains a fresh baseline expedition from those starting conditions and its actual outcome. It is not a replay of Jev choices.

The two JSON files are the canonical capture artifacts. They were compacted without altering their parsed contents. Their SHA-256 hashes are recorded in the capture metadata. There are no discarded live runs, repeated paid trials, synthetic replacement responses, baseline takeovers, or uncertainty acknowledgements in this evidence.

The selected benchmark is Evidence survey version 1, Balanced priorities, past-water objective, with no scheduled interventions. Records are version 13, the scenario is `ochre-basin-v6`, simulation is `grid-expedition-v1`, cadence is `meaningful-boundaries-v1`, prompt is `rover-action-v3`, and baseline strategy is `evidence-priorities-v1`. Successful responses resolved to `jev-1.13.0`; the failed response's model and tokens remain unavailable. Recorded pricing was verified September 22 and rechecked before capture on September 23 against the [official model reference](https://docs.typesafe.ai/models): $0.042 per million input tokens and free output tokens. Historical records retain the original verification date and capture timestamps.

## Results, including the failure

| Measure | Jev capture | Matched baseline |
| --- | --- | --- |
| Ending | Manual stop at uncertainty pause; unfinished | Eighteen-minute time budget reached at base |
| Expedition time | 02:12 | 18:00 |
| Delivered science | 0 | 10 |
| Samples delivered | 0 | 1 |
| Provider attempts | 11 confirmed; no retries | 0 |
| Applied choices | 10 | 83 |
| Estimated inference cost | Unavailable; known subtotal $0.009210096 | $0 |

The eleventh attempt received HTTP 400, which the existing backend mapped to unavailable, and had unknown token usage. The record retains that status without a raw provider error body. The capture stopped before another request, preserving both the failure and usage pause. The ten successful responses reported 219,288 input and 6,565 output tokens. Total input/output tokens and total estimated cost remain unavailable because the failed attempt supplied neither. Cumulative Jev decision wait was 4401.275569 ms, separate from simulated time. The known subtotal is not a billing total or proof of a spending cap.

Decision 2 illustrates a disagreement: Jev chose exploration toward Frontier 16 / 27 with 35% returned probability; the same-state baseline suggested a five-second wait after surveying. Code traveled six cells, used 12 energy units, and earned zero science. This says what happened, not why Jev internally chose it. A probability is not a scientific score or success guarantee. The guide uses this first recording because it contains authentic choices, execution, an alternative, and operational failure, regardless of relative score.

Both runs have matching starting conditions and schedules. Jev stopped early, so observed durations differ. These are observations about one incomplete Jev run and one completed baseline run, not evidence of consistent controller advantage. No successful Jev completion is claimed.

## Deliberate capture and local setup

For ordinary use, Start keyless baseline requires only `bun run dev`. Set up live Jev shows the backend workflow and editable limits before starting. Configure `TYPESAFE_API_KEY` in the ignored `.env`, never a `VITE_` variable. Run `bun run dev:server` and `bun run dev` in separate terminals. No key is accepted by the browser.

The capture script is separate from tests and the browser. It runs at most one expedition per explicit invocation and refuses an existing output directory. First check configuration without dispatch:

```sh
bun scripts/capture-guided-replay.ts docs/evaluation/capture-new-name
```

Only an intentional live capture adds `--live`. It uses explicit limits of 250 provider attempts and $0.10 estimated inference cost, the five-second total decision deadline, and at most one automatic retry under the existing guards. Limits are checked after configuration and before starting. Failure or usage uncertainty stops capture without raising limits, acknowledging unknown usage, or silently switching controllers. The cost threshold is a stopping rule; unavailable or late usage can prevent a precise spending total. Keep every resulting record and its metadata, even when it fails. Selecting a guide must not depend on Jev winning.

## Deterministic verification

`tests/guided-replay.test.ts` consumes these artifacts through record validation, JSON round trips, the replay/session API, teaching and inspection, and a freshly executed matched baseline. It verifies the actual original outcomes without contacting TypeSafe or loading credentials. Browser checks block provider routes while completing the guide, opening evidence and usage, comparing outcomes, exporting and replaying the original record, and entering a baseline expedition at desktop and 390 pixels. Live evaluation evidence above is separate from these deterministic checks.
