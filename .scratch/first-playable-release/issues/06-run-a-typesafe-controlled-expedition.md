# 06: Run a TypeSafe-controlled expedition

**What to build:** Choose TypeSafe to drive a full expedition, inspect its probabilities, and see requests stop at defined limits.

**Blocked by:** 05: Inspect decisions and update mission instructions

**Status:** ready-for-agent

- [ ] Add the local Bun backend using the official TypeSafe JavaScript SDK; verify the SDK contract and compatibility under the selected Bun version, including cancellation, deadlines, and retries. Document how to configure the server-side key.
- [ ] Allow selecting the TypeSafe controller for an expedition while preserving key-free baseline operation. Keep credentials off the browser, records, and logs.
- [ ] Send only the objective, current instructions, observations, timestamped memory, resources, and available complete candidates. Validate browser/backend contracts and execute only an available typed Choice that passes current preconditions.
- [ ] Display actual returned probabilities in the timeline, without presenting them as utility, science score, guaranteed correctness, or generated reasoning. A valid uncertain Choice continues autonomously.
- [ ] Enforce one decision in flight, a five-second total wall-clock deadline including retries, and at most one automatic retry within that deadline. SDK defaults cannot add hidden attempts.
- [ ] Count every inference attempt, including retries, against a 100-attempt expedition cap. Pause before issuing an attempt that would exceed the cap.
- [ ] Keep expedition time and modeled evolution frozen while awaiting the complete decision operation; measure latency separately and preserve responsive camera and interface controls.
- [ ] Failure, invalid output, or budget exhaustion leaves the expedition paused with an understandable status and no silent controller change. Existing stop/reset controls remain usable; the next ticket adds recovery choices.
- [ ] Add inference attempts, latency, and controller attribution to timeline events and expedition results.
- [ ] Verify the full request-to-action path with a scripted external service, including delayed responses, invalid choices, uncertain choices, automatic retry, total deadline, stale responses, and attempt exhaustion. Tests require no real credentials or paid calls.
