# 07: Recover explicitly from inference failures

**What to build:** Retry a failed decision or explicitly continue with the baseline controller while preserving honest results.

**Blocked by:** 06: Run a TypeSafe-controlled expedition

**Status:** ready-for-agent

- [ ] After bounded inference failure, offer Retry and Continue with the baseline controller while the expedition remains paused.
- [ ] Retry makes a new bounded decision operation for the current valid context and counts all attempts toward the existing expedition budget; it does not refill that budget.
- [ ] When the attempt cap has been reached, prevent Retry from sending more requests. Explicit baseline continuation, stop, and reset remain usable.
- [ ] Switch to the baseline controller only after mission control explicitly chooses it; resume from the same expedition state and retain the fixed objective, elapsed expedition time, cargo, energy, and prior results.
- [ ] Record and display the controller transition and responsible controller for subsequent decisions. Results clearly identify an expedition that used both controllers.
- [ ] Ensure late responses from failed or abandoned operations cannot execute after retry, baseline continuation, reset, or stop.
- [ ] Verify retry success, repeated failure, retry at the attempt boundary, baseline continuation, and controller history using controlled time and scripted service responses, plus a browser recovery journey.
