# 02: Preserve accounting through failures and cancellation

**What to build:** Mission control can account for provider attempts even when a request fails, retries, is cancelled, or returns after its action has become obsolete. The interface distinguishes confirmed activity from uncertainty instead of displaying a misleading exact total.

**Blocked by:** 01: Show actual Jev usage and estimated cost.

**Status:** ready-for-agent

**Parent spec:** [Fullscreen Jev decision lab](../spec.md). Primary user stories: 51-58, 69-75, 77.

- [x] Keep provider execution status separate from whether a choice was valid, current, and applied. A malformed, discarded, or obsolete choice does not erase a confirmed attempt or available usage.
- [x] Attribute each retry to its original decision with its own attempt identity. Duplicate delivery or reconciliation of metadata must not count an attempt, token total, or cost twice.
- [x] Distinguish confirmed pre-dispatch rejection, confirmed outbound activity with missing usage, and a local submission whose dispatch cannot be confirmed. Show unconfirmed submissions separately from confirmed attempts and identify totals that are only lower bounds.
- [x] Preserve all available model, token, request, and timing metadata on failure paths. When cancellation, deadline expiry, connection loss, or provider failure prevents usage confirmation, expose the uncertainty; do not infer free usage from an unsuccessful action.
- [x] Reconcile later confirmation with the original submission and attempt identities. If the transport provides no further evidence, retain the unresolved state honestly rather than fabricating a completed provider response.
- [x] Stop, reset, and mission changes can still cancel pending choices. Late accounting belongs to the originating expedition, including one that has stopped; it must not increase a replacement expedition's totals or apply an obsolete action there.
- [x] Keep one decision in flight and the five-second total decision deadline across at most one automatic retry. Preserve explicit recovery and controller attribution. This ticket does not authorize silent baseline substitution.
- [x] Make the status and uncertainty of individual attempts inspectable from their decision and expedition totals. Save the same evidence and provenance in local history and validated exports, and preserve it during keyless replay without changing imported source records.
- [x] Extend the existing session-to-real-SDK scripted-provider integration tests for transient failures, malformed choices, lost local responses, cancellation, deadline expiry, duplicate settlement, late results, and reset isolation. Assert exact counts when dispatch is known and explicit uncertainty otherwise.
- [x] Verify the failure accounting in the browser, preserve supported legacy imports and replay, and run the repository's required checks without live credentials or paid requests.

Ticket 03 consumes this accounting to reserve allowances and pause on uncertainty. Until that slice lands, preserve the existing request ceiling and recovery behavior while making their accounting truthful.


## Comments

- Implemented ticket 02 only. Provider execution status is independent of whether a choice applies. Failure, malformed-output, cancellation, deadline, and connection-loss paths retain available safe response metadata. Missing dispatch or usage stays unknown; the interface labels confirmed counts and known estimated cost as lower bounds where appropriate.
- The backend retains the latest 1,000 submissions in memory. A read-only accounting lookup returns evidence by expedition, decision, and attempt identity, and duplicate request delivery reuses its original response within that window. Increasing evidence revisions fill missing facts without replacing confirmed metadata or counting an attempt twice. A bounded response observer can retain late metadata from existing traffic after SDK cancellation.
- **Refresh inference accounting** checks submissions made on the current page, including stopped expeditions after reset. It makes no new provider requests and has its own bounded wait. A backend restart, evicted entry, lost page session, or transport without later evidence can leave accounting unresolved. The existing five-second decision deadline, one automatic retry, 100-submission ceiling, explicit recovery, and controller attribution remain in place. Ticket 03's guards and configurable limits are deferred.
- Late accounting changes only its original expedition. Version 3 records permit validated accounting extensions after completion; browser storage saves these updates while ordinary imports retain strict identity-conflict protection. Open inspection/replay snapshots remain detached. Reopen a saved entry to see newly saved accounting. Imported records and replay never query live accounting.
- Supported version 1 and 2 records retain their original metadata and behavior. The new version 2 fixture was captured from ticket 01 commit `cb15524` through its real session, backend, and SDK against a scripted provider. Replay checks cover late accounting and preserve source exports.

### Standards review

The initial review found no hard documented-standard violations and one judgment call, possible duplicated configuration. The SDK constructor used a literal model name while recorded evidence used `REQUESTED_MODEL`. The implementation now uses the same constant for both. The reviewer confirmed that this closes the finding. No outstanding documented-standard violations or material baseline smells remain.

### Spec review

No findings. The staged changes preserve available failure metadata, separate provider execution from choice validity, reconcile evidence by stable identity and increasing revision, and reject duplicate accounting. Late evidence updates the originating expedition, including completed records, without applying obsolete choices or changing replacement-run totals.

The version 3 record flow supports appended accounting, durable updates, validated export/import, and keyless replay. Legacy version 1 and 2 records remain supported. The interface exposes unresolved submissions and lower-bound totals. No missing ticket requirements, incorrect implemented behavior, or scope creep were identified. Ticket 03's configurable limits and uncertainty pauses remain deferred.

Review totals: Standards 1 finding resolved, 0 outstanding; Spec 0 findings. Both agents reviewed the staged implementation against ticket 01 commit `cb1552472766bbeca4d21e58cabb6cfd26c5a03c` before commit.

### Final verification

`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium bun run check` passed under Bun 1.4.2: typechecking, production build, all 124 Bun tests, and all 25 Playwright browser checks. The model-constant review fix also passed typechecking and the 12 focused usage tests. The browser regression verifies lost local responses, lower-bound labels, repeated refresh without new inference, old-expedition attribution after reset, browser persistence/reload, and unchanged keyless replay exports. The failure-accounting screenshot was inspected. Existing dependency-annotation, bundle-size, and Node browser-runner warnings remain. No live credentials or paid requests were used.
