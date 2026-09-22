# 02: Preserve accounting through failures and cancellation

**What to build:** Mission control can account for provider attempts even when a request fails, retries, is cancelled, or returns after its action has become obsolete. The interface distinguishes confirmed activity from uncertainty instead of displaying a misleading exact total.

**Blocked by:** 01: Show actual Jev usage and estimated cost.

**Status:** ready-for-agent

**Parent spec:** [Fullscreen Jev decision lab](../spec.md). Primary user stories: 51-58, 69-75, 77.

- [ ] Keep provider execution status separate from whether a choice was valid, current, and applied. A malformed, discarded, or obsolete choice does not erase a confirmed attempt or available usage.
- [ ] Attribute each retry to its original decision with its own attempt identity. Duplicate delivery or reconciliation of metadata must not count an attempt, token total, or cost twice.
- [ ] Distinguish confirmed pre-dispatch rejection, confirmed outbound activity with missing usage, and a local submission whose dispatch cannot be confirmed. Show unconfirmed submissions separately from confirmed attempts and identify totals that are only lower bounds.
- [ ] Preserve all available model, token, request, and timing metadata on failure paths. When cancellation, deadline expiry, connection loss, or provider failure prevents usage confirmation, expose the uncertainty; do not infer free usage from an unsuccessful action.
- [ ] Reconcile later confirmation with the original submission and attempt identities. If the transport provides no further evidence, retain the unresolved state honestly rather than fabricating a completed provider response.
- [ ] Stop, reset, and mission changes can still cancel pending choices. Late accounting belongs to the originating expedition, including one that has stopped; it must not increase a replacement expedition's totals or apply an obsolete action there.
- [ ] Keep one decision in flight and the five-second total decision deadline across at most one automatic retry. Preserve explicit recovery and controller attribution. This ticket does not authorize silent baseline substitution.
- [ ] Make the status and uncertainty of individual attempts inspectable from their decision and expedition totals. Save the same evidence and provenance in local history and validated exports, and preserve it during keyless replay without changing imported source records.
- [ ] Extend the existing session-to-real-SDK scripted-provider integration tests for transient failures, malformed choices, lost local responses, cancellation, deadline expiry, duplicate settlement, late results, and reset isolation. Assert exact counts when dispatch is known and explicit uncertainty otherwise.
- [ ] Verify the failure accounting in the browser, preserve supported legacy imports and replay, and run the repository's required checks without live credentials or paid requests.

Ticket 03 consumes this accounting to reserve allowances and pause on uncertainty. Until that slice lands, preserve the existing request ceiling and recovery behavior while making their accounting truthful.
