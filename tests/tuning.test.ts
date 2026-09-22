import { expect, test } from 'bun:test';
import { runPlaytest, runStormRoutePlaytest } from '../scripts/playtest-tuning';
import { createReplay } from '../src/simulation/expedition';
import { firstPlayableScenario as authoredScenario } from './fixtures/first-playable-scenario';
import { exportExpeditionRecord, importExpeditionRecord } from '../src/records/contract';

test('a deliberate survey can wait for a storm and inspect all samples but miss delivery with the boundary cadence', () => {
  const record = runPlaytest({ strategy: 'wait-for-storm', stormAtMs: 90_000 });
  expect(record.results).toMatchObject({
    elapsedMs: 300_000, endingCondition: 'timeout', scienceScore: 10,
    discoveryCount: 3, inspectionCount: 3, cargo: [{ sampleId: 'b' }, { sampleId: 'c' }],
  });
  expect(record.results.deliveredSamples.map(sample => sample.sampleId)).toEqual(['a']);
  expect(record.results.deliveredSamples.at(-1)!.deliveredAtMs).toBe(42_000);
  expect(record.events.some(event => event.type === 'storm-detected')).toBe(true);
  expect(record.decisions.some(decision => decision.action?.kind === 'wait' && decision.input.memory.some(item => item.kind === 'dust-storm' && item.remainingMs > 0))).toBe(true);
});

test.each(['past-water', 'unusual-minerals'] as const)('baseline and deliberate surveys expose delivery risk for %s', objective => {
  const baseline = runPlaytest({ strategy: 'baseline', objective });
  const survey = runPlaytest({ objective });
  expect(baseline.results.deliveredSamples.map(sample => sample.sampleId)).toEqual([objective === 'past-water' ? 'a' : 'b']);
  expect(baseline.results.scienceScore).toBe(10);
  expect(baseline.results.discoveryCount).toBe(objective === 'past-water' ? 1 : 2);
  expect(baseline.results.inspectionCount).toBe(objective === 'past-water' ? 1 : 2);
  expect(survey.results.scienceScore).toBe(objective === 'past-water' ? 10 : 0);
  expect(survey.results).toMatchObject({ endingCondition: 'stranded', elapsedMs: 265_200, cargo: [{ sampleId: 'b' }, { sampleId: 'c' }] });
  expect(survey.results.deliveredSamples.map(sample => [sample.sampleId, sample.deliveredAtMs])).toEqual([
    ['a', 42_000],
  ]);
  expect(survey.results.energyUsed).toBe(116);
  expect(survey.startingConditions).toMatchObject({
    durationMs: 300_000, cargoCapacity: 2, inspectMs: 6_000, collectMs: 4_000,
    rechargePerSecond: 5, rubric: { unrelated: 0, suggestive: 5, 'strong-evidence': 10 },
  });
  expect(survey.startingConditions.scenario.samples).toHaveLength(3);
  const firstReturn = survey.events.find(event => event.type === 'action-started' && event.action.kind === 'return-to-base');
  expect(firstReturn).toMatchObject({ atMs: 26_000, action: { routeEstimate: { durationMs: 16_000, energy: 8 } } });
  const firstRecharge = survey.events.find(event => event.type === 'action-started' && event.action.kind === 'recharge');
  expect(firstRecharge).toMatchObject({ atMs: 42_000, action: { durationMs: 3_200 } });
});

test.each([
  { strategy: 'no-recharge', elapsedMs: 230_000, ending: 'stranded', cargo: ['b', 'c'], energy: 100 },
  { strategy: 'survey', delayMs: 50_000, elapsedMs: 300_000, ending: 'timeout', cargo: ['b', 'c'], energy: 108.4 },
  { strategy: 'survey', stormAtMs: 90_000, elapsedMs: 185_200, ending: 'stranded', cargo: ['b'], energy: 116 },
] as const)('skipping recharge, delaying, or crossing the storm can forfeit delivery: %j', playtest => {
  const record = runPlaytest(playtest);
  expect(record.results.endingCondition).toBe(playtest.ending);
  expect(record.results.elapsedMs).toBe(playtest.elapsedMs);
  expect(record.results.energyUsed).toBeCloseTo(playtest.energy);
  expect(record.results.cargo.map(sample => sample.sampleId)).toEqual([...playtest.cargo]);
  expect(record.results.scienceScore).toBe(10);
  expect(record.results.deliveredSamples.map(sample => sample.sampleId)).toEqual(['a']);
});

test('a known storm crossing, wait, and detour exchange expedition time for energy under the chosen storm tuning', () => {
  const crossing = runStormRoutePlaytest('survey');
  const waiting = runStormRoutePlaytest('wait-for-storm');
  const detour = runStormRoutePlaytest('detour');
  expect([crossing, waiting, detour].map(record => [record.results.deliveredSamples[0]!.deliveredAtMs, record.results.energyUsed])).toEqual([
    [122_000, 91], [157_000, 56], [162_000, 76],
  ]);
  expect(detour.decisions.some(decision => decision.action && 'routeMode' in decision.action && decision.action.routeMode === 'avoid-storm')).toBe(true);
  expect(waiting.decisions.some(decision => decision.action?.kind === 'wait' && decision.input.atMs < 45_000)).toBe(true);
  for (const record of [crossing, waiting, detour]) {
    expect(record.results.scienceScore).toBe(10);
    expect(record.startingConditions.scenario.dustStorm).toMatchObject({ durationMs: 45_000, radius: 4.5, sensorRange: 1.5, movementEnergyMultiplier: 3 });
  }
});

test('both the earlier and tuned layouts replay from recorded conditions at every viewing speed', () => {
  const earlier = structuredClone(authoredScenario);
  earlier.id = 'ochre-basin-v4';
  earlier.samples[2]!.position.z = 4;
  for (const scenario of [earlier, authoredScenario]) {
    const record = importExpeditionRecord(exportExpeditionRecord(runPlaytest({ scenario, strategy: 'wait-for-storm', stormAtMs: 90_000 })));
    const original = structuredClone(record);
    for (const speed of [1, 2, 4] as const) {
      const replay = createReplay(record);
      replay.dispatch({ type: 'set-speed', speed });
      replay.dispatch({ type: 'start' });
      replay.advanceWallTime(300_000 / speed);
      expect(replay.getSnapshot()).toEqual({ ...record.results, speed });
      expect(replay.getRecord().events).toEqual(record.events);
      expect(replay.getDecisions()).toEqual(record.decisions);
    }
    expect(record).toEqual(original);
  }
}, 15_000);
