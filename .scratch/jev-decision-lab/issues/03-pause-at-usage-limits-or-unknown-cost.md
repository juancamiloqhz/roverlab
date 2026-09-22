# 03: Pause at usage limits or unknown cost

**What to build:** Mission control can set an expedition's provider-attempt and estimated-cost limits, see why inference has paused, and explicitly decide whether to continue. Failures and retries cannot bypass those choices.

**Blocked by:** 02: Preserve accounting through failures and cancellation.

**Status:** ready-for-agent

**Parent spec:** [Fullscreen Jev decision lab](../spec.md). Primary user stories: 17, 18, 53, 58-63, 69-75, 77.

- [ ] Default each new live expedition to 250 provider attempts and $0.10 estimated inference cost. Allow valid limits to be configured before starting and show the selected allowances alongside current usage.
- [ ] Check the allowances before every provider attempt, including automatic and manual retries. Reserve possible activity for outstanding or unconfirmed submissions so duplicate handling, transport loss, and retry timing cannot silently release an allowance.
- [ ] Pause further inference when an attempt limit or known estimated-cost threshold is reached, or when an attempt leaves its usage or cost basis unknown. Show the specific cause and the affected attempts. An uncertainty pause takes precedence over an otherwise eligible automatic retry.
- [ ] A usage pause freezes simulated time and modeled evolution while camera and interface controls remain usable. Keep it distinct from choosing, ordinary pause, execution, and request failure. Do not switch controllers automatically.
- [ ] Offer appropriate explicit actions: raise a reached limit, acknowledge identified uncertainty and continue, continue with the baseline, or stop. Preserve stop and reset while requests are pending. Continuation must still satisfy all other active guards.
- [ ] Record uncertainty acknowledgements against the affected attempts. Acknowledgement neither turns missing usage into zero nor hides it from estimates. A later newly unknown attempt requires another explicit acknowledgement before further inference.
- [ ] Record initial limits, later changes, acknowledgements, and controller transitions with their expedition context. Reconcile late usage against its original expedition and re-evaluate guards before any subsequent attempt there.
- [ ] Describe the dollar limit as an estimated-cost stopping rule. A completed response may cross it, and unresolved usage prevents a verified billing total. Do not promise an exact billed-spending cap.
- [ ] Preserve the five-second total decision deadline, at most one automatic retry, one in-flight decision, stale-action rejection, and server-only credentials. Raising a limit does not reset already consumed usage.
- [ ] Through the session and real SDK with scripted transport, test a retry consuming the final slot, blocked dispatch, threshold crossing, uncertain reservations, acknowledgement, newly unknown usage after acknowledgement, late settlement, and explicit baseline continuation. Use controlled clocks and no paid calls.
- [ ] Add browser coverage for setup limits, cause-specific pause controls, persistent uncertainty, and visible controller transitions. Round-trip the new history through saving, import/export, and inference-free replay; preserve supported legacy records and run required repository checks.
