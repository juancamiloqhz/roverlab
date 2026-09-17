# 11: Replay recorded expeditions

**What to build:** Watch a saved expedition unfold from its original state without making new AI requests.

**Blocked by:** 10: Save and exchange expedition records

**Status:** ready-for-agent

- [ ] Start replay from a saved or imported expedition record, clearly distinguishing replay from a new live expedition.
- [ ] Reconstruct its original starting conditions and objective/rubric, and apply recorded decisions, actions, instruction changes, controller transitions, and environmental events at their recorded expedition-time boundaries.
- [ ] Bypass live controller selection and the inference service during replay; credentials are not required and no inference attempts are made.
- [ ] Support viewing the recorded timeline and results while using playback speed and pause controls. Viewing or stopping replay does not mutate the saved record.
- [ ] Reproduce the recorded final science score, discoveries, inspections, energy use, ending condition, and controller history.
- [ ] Reject records that cannot be replayed under the supported record contract with a clear explanation; do not silently run a fresh AI expedition.
- [ ] Verify baseline, TypeSafe, and mixed-controller records including storms and instruction changes, and compare final results at different playback speeds. Add a browser save/import-to-replay journey.
