# 07: Recover explicitly from inference failures

**What to build:** Retry a failed decision or explicitly continue with the baseline controller while preserving honest results.

**Blocked by:** 06: Run a TypeSafe-controlled expedition

**Status:** ready-for-agent

- [x] After bounded inference failure, offer Retry and Continue with the baseline controller while the expedition remains paused.
- [x] Retry makes a new bounded decision operation for the current valid context and counts all attempts toward the existing expedition budget; it does not refill that budget.
- [x] When the attempt cap has been reached, prevent Retry from sending more requests. Explicit baseline continuation, stop, and reset remain usable.
- [x] Switch to the baseline controller only after mission control explicitly chooses it; resume from the same expedition state and retain the fixed objective, elapsed expedition time, cargo, energy, and prior results.
- [x] Record and display the controller transition and responsible controller for subsequent decisions. Results clearly identify an expedition that used both controllers.
- [x] Ensure late responses from failed or abandoned operations cannot execute after retry, baseline continuation, reset, or stop.
- [x] Verify retry success, repeated failure, retry at the attempt boundary, baseline continuation, and controller history using controlled time and scripted service responses, plus a browser recovery journey.

## Comments

- Added explicit recovery commands and UI controls for paused TypeSafe failures. Retry uses a fresh bounded operation with current context and the existing attempt budget. The session and UI both prevent retry at the cap; ordinary resume and controller selection cannot bypass recovery.
- Baseline continuation resumes the same expedition, preserving its objective, instructions, science, cargo, time, and resources. Controller transitions are recorded with the originating failure, displayed chronologically before the next decision, and included in results. Reset starts a fresh controller history.
- Added public-session scenarios using the actual controller, backend, and SDK with scripted external responses and controlled deadlines. They cover retry success, repeated failures, attempt 99/100 boundaries, baseline continuation with earned science and cargo, and late output after retry, continuation, reset, or stop. The browser journey covers repeated failure, edited-instruction retry success, explicit continuation, timeline attribution, mixed results, and reset.
- Verified under Bun 1.4.2: typecheck, production build, all 60 Bun scenarios, and all nine Playwright checks with system Chromium. No real credentials or paid calls were used. Existing dependency annotation and large-chunk build warnings remain.
- Completed separate Standards and Spec reviews against starting commit `24e4ec9`. The Spec review found no issues. The Standards review suggested consolidating duplicated recovery bookkeeping; a shared recovery transition now handles it, and the reviewer confirmed the finding resolved. Typecheck, all 29 TypeSafe scenarios, and the browser recovery journey passed again after that refactor. Neither review has outstanding findings.
