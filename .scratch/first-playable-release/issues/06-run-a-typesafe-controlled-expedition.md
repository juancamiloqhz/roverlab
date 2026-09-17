# 06: Run a TypeSafe-controlled expedition

**What to build:** Choose TypeSafe to drive a full expedition, inspect its probabilities, and see requests stop at defined limits.

**Blocked by:** 05: Inspect decisions and update mission instructions

**Status:** ready-for-agent

- [x] Add the local Bun backend using the official TypeSafe JavaScript SDK; verify the SDK contract and compatibility under the selected Bun version, including cancellation, deadlines, and retries. Document how to configure the server-side key.
- [x] Allow selecting the TypeSafe controller for an expedition while preserving key-free baseline operation. Keep credentials off the browser, records, and logs.
- [x] Send only the objective, current instructions, observations, timestamped memory, resources, and available complete candidates. Validate browser/backend contracts and execute only an available typed Choice that passes current preconditions.
- [x] Display actual returned probabilities in the timeline, without presenting them as utility, science score, guaranteed correctness, or generated reasoning. A valid uncertain Choice continues autonomously.
- [x] Enforce one decision in flight, a five-second total wall-clock deadline including retries, and at most one automatic retry within that deadline. SDK defaults cannot add hidden attempts.
- [x] Count every inference attempt, including retries, against a 100-attempt expedition cap. Pause before issuing an attempt that would exceed the cap.
- [x] Keep expedition time and modeled evolution frozen while awaiting the complete decision operation; measure latency separately and preserve responsive camera and interface controls.
- [x] Failure, invalid output, or budget exhaustion leaves the expedition paused with an understandable status and no silent controller change. Existing stop/reset controls remain usable; the next ticket adds recovery choices.
- [x] Add inference attempts, latency, and controller attribution to timeline events and expedition results.
- [x] Verify the full request-to-action path with a scripted external service, including delayed responses, invalid choices, uncertain choices, automatic retry, total deadline, stale responses, and attempt exhaustion. Tests require no real credentials or paid calls.

## Comments

- Added the loopback Bun backend with official `@typesafe-ai/sdk` 0.6.0, strict shared runtime contracts, and server-only `.env` configuration. SDK retries and logging are disabled explicitly. README documents configuration, scripts, verified SDK behavior, and request accounting.
- TypeSafe is selectable before an expedition. The baseline remains the default and requires no backend or key. Valid uncertain choices execute only the simulator's still-available candidate; actual returned probabilities appear in the timeline. Failures pause with fixed explanatory statuses, preserving stop/reset. Ticket 07 recovery controls are not implemented.
- A browser operation carries one five-second deadline across local transport, response bodies, and at most one retry; the backend bounds its SDK attempt to the same remaining deadline. The session reserves each submitted attempt before sending, conservatively including local transport/configuration failures. Cancelled attempts are never refunded. Reset starts a fresh budget, and old settlements retain original expedition attribution.
- Verified under Bun 1.4.2: typecheck, production build, all 52 Bun scenarios, and all eight Playwright checks using system Chromium. Tests substitute only the external TypeSafe service for integration scenarios, retain the actual SDK/backend/controller/coordinator, and include native HTTP cancellation. No paid calls or real credentials were used. Browser output contains no SDK, environment-key reference, or credential fixtures. Build succeeds with dependency annotation and large-chunk warnings.
- Completed separate Standards and Spec reviews against starting commit `a39fa49`. Standards found no violations or actionable smells. Spec review identified a late-response deadline edge, reproduced by a failing public-session test and corrected with a final cancellation/expiry check before returning the outcome. The Spec reviewer verified the correction; neither axis has outstanding findings.
