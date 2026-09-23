import { expect, test } from 'bun:test';
import { createReplay, createMatchedBaseline } from '../src/simulation/expedition';
import { exportExpeditionRecord, importExpeditionRecord } from '../src/records/contract';
import { compareExpeditionRecords } from '../src/records/matching';

const load = async (name: string) => importExpeditionRecord(await Bun.file(`public/guided/${name}.json`).text());

test('the authentic capture round-trips and replays its unfinished outcome with unavailable usage intact', async () => {
  const source = await load('jev');
  const original = exportExpeditionRecord(source);
  expect(source.results).toMatchObject({ endingCondition: 'manual-stop', elapsedMs: 132_000, scienceScore: 0,
    usage: { providerAttempts: 11, estimatedCost: null, inputTokens: null } });
  expect(source.decisions.at(-1)).toMatchObject({ status: 'failed', failure: 'unavailable' });
  expect(source.decisions[1]).toMatchObject({ controller: 'typesafe', action: { kind: 'explore' },
    baselineAlternative: { action: { kind: 'wait' } } });
  const replay = createReplay(importExpeditionRecord(original));
  replay.dispatch({ type: 'start' });
  replay.advanceWallTime(source.results.durationMs);
  expect(replay.getSnapshot()).toEqual(source.results);
  expect(replay.getDecisions()).toEqual(source.decisions);
  expect(exportExpeditionRecord(source)).toBe(original);
  expect(replay.getCompletedRecords()).toEqual([]);
});

test('teaching and historical inspection preserve source evidence and the independently executed matched baseline', async () => {
  const source = await load('jev');
  const baseline = await load('baseline');
  const original = exportExpeditionRecord(source);
  const replay = createReplay(source);
  replay.dispatch({ type: 'set-teaching-mode', enabled: true });
  replay.dispatch({ type: 'start' });
  replay.dispatch({ type: 'continue-choice' });
  replay.advanceWallTime(60_000);
  expect(replay.getSnapshot()).toMatchObject({ status: 'paused', elapsedMs: 12_000, heldDecisionId: 2 });
  replay.dispatch({ type: 'inspect-decision', decisionId: 2 });
  replay.advanceWallTime(100_000);
  expect(replay.getSnapshot().elapsedMs).toBe(12_000);
  replay.dispatch({ type: 'end-inspection' });
  replay.dispatch({ type: 'continue-choice' });
  replay.advanceWallTime(60_000);
  expect(replay.getSnapshot()).toMatchObject({ elapsedMs: 36_000, battery: 142, scienceScore: 0, heldDecisionId: 3 });
  expect(compareExpeditionRecords(source, baseline)).toMatchObject({ scenario: true, simulation: true, missionRequests: true, schedule: true });
  const fresh = createMatchedBaseline(source);
  fresh.dispatch({ type: 'start' });
  while (fresh.getSnapshot().status !== 'ended') fresh.advanceWallTime(5000);
  expect(fresh.getSnapshot()).toEqual(baseline.results);
  expect(baseline.results).toMatchObject({ scienceScore: 10, endingCondition: 'timeout', usage: { providerAttempts: 0 } });
  expect(exportExpeditionRecord(source)).toBe(original);
  const baselineReplay = createReplay(baseline);
  baselineReplay.dispatch({ type: 'start' });
  baselineReplay.advanceWallTime(baseline.results.durationMs);
  expect(baselineReplay.getSnapshot()).toEqual(baseline.results);
});
