# 03: Pause at usage limits or unknown cost

**What to build:** Mission control can set an expedition's provider-attempt and estimated-cost limits, see why inference has paused, and explicitly decide whether to continue. Failures and retries cannot bypass those choices.

**Blocked by:** 02: Preserve accounting through failures and cancellation.

**Status:** ready-for-agent

**Parent spec:** [Fullscreen Jev decision lab](../spec.md). Primary user stories: 17, 18, 53, 58-63, 69-75, 77.

- [x] Default each new live expedition to 250 provider attempts and $0.10 estimated inference cost. Allow valid limits to be configured before starting and show the selected allowances alongside current usage.
- [x] Check the allowances before every provider attempt, including automatic and manual retries. Reserve possible activity for outstanding or unconfirmed submissions so duplicate handling, transport loss, and retry timing cannot silently release an allowance.
- [x] Pause further inference when an attempt limit or known estimated-cost threshold is reached, or when an attempt leaves its usage or cost basis unknown. Show the specific cause and the affected attempts. An uncertainty pause takes precedence over an otherwise eligible automatic retry.
- [x] A usage pause freezes simulated time and modeled evolution while camera and interface controls remain usable. Keep it distinct from choosing, ordinary pause, execution, and request failure. Do not switch controllers automatically.
- [x] Offer appropriate explicit actions: raise a reached limit, acknowledge identified uncertainty and continue, continue with the baseline, or stop. Preserve stop and reset while requests are pending. Continuation must still satisfy all other active guards.
- [x] Record uncertainty acknowledgements against the affected attempts. Acknowledgement neither turns missing usage into zero nor hides it from estimates. A later newly unknown attempt requires another explicit acknowledgement before further inference.
- [x] Record initial limits, later changes, acknowledgements, and controller transitions with their expedition context. Reconcile late usage against its original expedition and re-evaluate guards before any subsequent attempt there.
- [x] Describe the dollar limit as an estimated-cost stopping rule. A completed response may cross it, and unresolved usage prevents a verified billing total. Do not promise an exact billed-spending cap.
- [x] Preserve the five-second total decision deadline, at most one automatic retry, one in-flight decision, stale-action rejection, and server-only credentials. Raising a limit does not reset already consumed usage.
- [x] Through the session and real SDK with scripted transport, test a retry consuming the final slot, blocked dispatch, threshold crossing, uncertain reservations, acknowledgement, newly unknown usage after acknowledgement, late settlement, and explicit baseline continuation. Use controlled clocks and no paid calls.
- [x] Add browser coverage for setup limits, cause-specific pause controls, persistent uncertainty, and visible controller transitions. Round-trip the new history through saving, import/export, and inference-free replay; preserve supported legacy records and run required repository checks.


## Comments

- Implemented ticket 03 only. Live expeditions start with 250 provider attempts and $0.10 estimated inference cost. Setup accepts nonnegative whole-number attempt allowances and finite nonnegative estimated-cost thresholds. Zero blocks live inference. Reset starts a fresh allowance and acknowledgement history.
- Each submission checks confirmed attempts, unconfirmed reservations, the known estimated-cost subtotal, and unacknowledged uncertainty. Unknown usage blocks automatic retry. Acknowledgements name the affected attempts and preserve incomplete estimates. Later unknown attempts require another acknowledgement. Raising an allowance keeps prior usage, and all other guards still apply.
- Usage pauses freeze simulated evolution and expose cause-specific controls. Mission control can raise a reached allowance, acknowledge identified uncertainty, explicitly continue with baseline, or stop. Stop/reset, the five-second decision deadline, at most one automatic retry, one in-flight decision, and stale-action rejection remain available.
- Version 4 records preserve limits, changes, acknowledgements, pauses, and controller transitions. Late evidence remains in its original expedition. Saved inspection, import/export, browser storage, and inference-free replay retain these facts. A version 3 fixture captured from `227df55` with the real backend/SDK and scripted transport verifies its original retry behavior without adding new guards. Versions 1 and 2 remain supported.


### Standards review

No remaining standards findings. The review identified one travel-boundary violation: late accounting could pause the rover between cells, and immediate baseline takeover cancelled travel at that fractional position. Baseline continuation now preserves travel to the next safe waypoint. Cancellation and completion retain the selecting controller's attribution. The real-SDK regression verifies movement, attribution, import/export, and replay. The reviewer confirmed the finding is closed. No additional documented-standard violations or baseline smells warranted.

### Spec review

No remaining spec findings. The review identified the same unsafe baseline takeover, and confirmed its correction. History validation tracks the action's selecting controller separately from the controller for subsequent decisions. The timeline also displays baseline continuation when a zero allowance prevented Jev's first decision. No missing ticket 03 requirements, incorrect guard/accounting behavior, or scope creep remain.

Review totals: Standards 1 finding resolved, 0 outstanding; Spec 1 finding resolved, 0 outstanding. Both agents reviewed the staged implementation against `227df55fa4ac18e51d857a46f85a5a4bd21ee5e3` before commit.


### Final verification

Bun 1.4.2 typechecking, the production build, and all 133 Bun tests pass. The full Chromium run passed 28 of 29 browser cases; its remaining assertion expected a baseline decision before the newly preserved safe action boundary. After advancing the controlled clock to that boundary, all four focused usage-limit browser cases pass, completing verification of all 29 browser cases. The narrow-screen usage-pause screenshot was inspected, and the browser check confirms no horizontal overflow.

The final standards and spec reviews have no outstanding findings. Existing dependency-annotation, bundle-size, and Node browser-runner warnings remain. All provider traffic used scripted transport; verification used no live credentials or paid requests.
