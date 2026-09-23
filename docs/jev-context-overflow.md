# Jev context overflow diagnosis

The guided capture's eleventh decision failed because its provider request exceeded the model's input-token limit. An isolated replay through the unchanged backend and official SDK reproduced HTTP 400 twice. The second diagnostic retained the provider's structured error type, `max_tokens_exceeded`. The earlier capture's generic unavailable message had obscured that cause.

## Reproduction and evidence

The minimized reproduction uses decision 11 from `public/guided/jev.json`, without advancing an expedition or making the preceding ten calls:

```sh
# Offline contract check; no environment file or provider access.
env -u TYPESAFE_API_KEY bun --no-env-file scripts/debug/reproduce-capture-failure.ts

# Explicitly authorized live verification only. One attempt, no retries,
# $0.01 estimated-cost threshold, and the existing five-second deadline.
bun scripts/debug/reproduce-capture-failure.ts --live
```

Before the fix, the live command exited 1 with `Expected an applied choice; received unavailable.` Both requests returned HTTP 400. After the fix, the same original-input command exited 0 with a valid choice and complete usage. Adding `--baseline` selects the larger final decision from the recorded matched baseline. The script runs one request per invocation, is separate from deterministic tests, and writes a new diagnostic artifact. It does not modify either source record.

Further paid input bisection was not needed once the provider identified the limit explicitly. The failure was already reduced from an eleven-decision expedition to one request. Requests with unknown usage stopped; the user explicitly authorized the next diagnostic and then the two verification calls.

| Evidence | Prompt | Result | Input / output tokens | Estimated cost |
| --- | --- | --- | --- | --- |
| [First reproduction](evaluation/diagnostic-c1fc49cd-7de5-468b-bb64-8414281f8982.json) | v3 | HTTP 400; structured detail not captured by initial string-only reader | Unavailable | Unavailable |
| [Structured diagnostic](evaluation/diagnostic-22e6cbe4-b227-44b2-82a2-13af531823c0.json) | v3 | HTTP 400, max_tokens_exceeded | Unavailable | Unavailable |
| [Original decision after fix](evaluation/diagnostic-99bfd1f6-9b49-4a5e-8983-4e1134f60626.json) | v4 | HTTP 200, valid choice | 11,920 / 951 | $0.000500640 |
| [Larger baseline input after fix](evaluation/diagnostic-cd55d628-80cf-4315-8589-8a2183245b5c.json) | v4 | HTTP 200, valid choice | 27,888 / 1,492 | $0.001171296 |

These are four confirmed diagnostic attempts with no retries. The known estimated subtotal is $0.001671936. The two failed attempts supplied no usage, so the overall diagnostic total remains unknown. Records retain model and pricing evidence. No credential or authorization header is logged or exported. SDK logging stays off; the diagnostic reader redacts the configured credential before retaining a bounded error detail.

## Cause and fix

The original model request sent verbose observation objects and full candidate descriptions twice: in the state and in the Choice criteria. The recorded inputs grew from 30 memory entries at decision 1 to 199 at decision 11, with 52 available actions. The matched baseline's final decision had 597 memory entries and 85 actions.

The investigation ranked duplicated action data, repeated observation fields, and structured-value formatting as sources of avoidable size. Local measurements confirmed the redundancy and size growth. They do not independently establish the provider's internal rendering or tokenizer behavior. The live error establishes token overflow; successful verification establishes that the combined lossless encoding fix admits both tested requests.

`rover-action-v4` sends compact JSON text with labeled tables for observations, memory, and candidate actions. Tables group rows by kind; column names define each value, and `recordIndex` preserves original ordering. Coordinates, timestamps, optional fields, sample properties, route estimates, and complete action identities remain present. Null denotes an absent optional field. Choice criteria list every candidate ID with null descriptions; the complete description appears once in the state. The prompt explains this representation.

The failed decision's state changes from 74,395 bytes when formatted with two-space indentation to 21,194 bytes of exact state text. The late-baseline state changes from 185,302 to 52,325 bytes. These are local serialization measurements, not claimed provider token counts. Live v4 counts are in the table above. The [model reference](https://docs.typesafe.ai/models), checked September 23, 2026, documents a 32k limit for state plus the longest question and 64k for the request overall. The [Choice API](https://docs.typesafe.ai/api) accepts null option descriptions.

The browser/backend input, simulation, baseline input, scoring, limits, deadlines, and recorded decisions keep their current formats and behavior. Only the model-facing representation and its prompt version change. The original guided replay remains an authentic v3 failure, with unchanged hashes, outcomes, and unknown usage. Old records are never rewritten or repriced.

## Verification and limits

The regression runs the actual backend and SDK against a scripted provider using both captured inputs. It independently reconstructs the complete original inputs, checks all offered action identities, and enforces a 60,000-byte state-plus-question regression budget for these fixtures. That byte budget is not a tokenizer or a universal service guarantee. Existing same-input comparison, mission, storm/detour, recovery, and accounting tests exercise the new representation through the same boundary.

Validation passed with 269 Bun tests, 25 focused browser tests, typechecking, and the production build. A further focused run passed all 29 request-size and TypeSafe tests after strengthening the round-trip assertions.

The fix preserves information; it does not promise identical model choices across prompt versions or establish decision quality. Inputs larger than the tested expeditions may still encounter provider limits, and existing failure/uncertainty handling remains in force. No additional full live expedition was run, and neither verification response replaces the original captured decisions.
