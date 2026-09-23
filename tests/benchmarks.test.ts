import { expect, test } from 'bun:test';
import { createExpedition, createMatchedBaseline, createReplay } from '../src/simulation/expedition';
import { exportExpeditionRecord, importExpeditionRecord } from '../src/records/contract';
import { benchmarkIds, type BenchmarkId } from '../src/simulation/benchmarks';
import { runBenchmarkPlaytest } from '../scripts/playtest-benchmarks';
import { createDecisionHandler } from '../server/decisions';
import { createTypeSafeController } from '../src/controllers/typesafe';
import type { ControllerInput, ExpeditionRecord } from '../src/simulation/types';
import { compareExpeditionRecords } from '../src/records/matching';

test('a selected benchmark installs complete starting conditions and survives matching and replay', () => {
  const session = createExpedition({ benchmark: 'storm-response' });
  expect(session.getSnapshot()).toMatchObject({ benchmark: { id: 'storm-response', version: 1 },
    objective: 'unusual-minerals', durationMs: 1_080_000, battery: 160,
    mission: { effective: { preferences: { mode: 'preset', preset: { id: 'balanced', version: 1 } } } } });
  expect(session.getRecord().startingConditions.interventionSchedule?.events).toHaveLength(2);
  session.dispatch({ type: 'start' });
  session.advanceWallTime(61_000);
  session.dispatch({ type: 'stop' });
  const source = importExpeditionRecord(exportExpeditionRecord(session.getCompletedRecords()[0]!));
  expect(source.decisions.filter(decision => decision.input.atMs === 60_000)).toHaveLength(1);
  expect(source.decisions.find(decision => decision.input.atMs === 60_000)!.input.decisionBoundary!.triggers)
    .toEqual(['storm-effects-changed', 'storm-detected', 'mission-changed']);
  expect(source.version).toBe(13);
  expect(source.events.filter(event => event.type === 'storm-introduced')).toMatchObject([
    { atMs: 60_000, storm: { position: { x: 26, z: 24 }, expiresAtMs: 240_000 } },
  ]);
  const baseline = createMatchedBaseline(source);
  baseline.dispatch({ type: 'start' });
  baseline.advanceWallTime(61_000);
  baseline.dispatch({ type: 'stop' });
  const matched = importExpeditionRecord(exportExpeditionRecord(baseline.getCompletedRecords()[0]!));
  expect(compareExpeditionRecords(source, matched)).toMatchObject({ benchmark: true, scenario: true, simulation: true, schedule: true, missionRequests: true });
  const replay = createReplay(source);
  replay.dispatch({ type: 'start' });
  replay.advanceWallTime(61_000);
  expect(replay.getSnapshot()).toEqual(source.results);
  expect(replay.getDecisions()).toEqual(source.decisions);
  expect(source.startingConditions.benchmark).toEqual(matched.startingConditions.benchmark);
});

function roundTrip(record: ExpeditionRecord) {
  const json = exportExpeditionRecord(record);
  const imported = importExpeditionRecord(json);
  const replay = createReplay(imported);
  replay.dispatch({ type: 'start' });
  replay.advanceWallTime(record.results.durationMs);
  expect(replay.getSnapshot()).toEqual(record.results);
  expect(replay.getDecisions()).toEqual(record.decisions);
  expect(exportExpeditionRecord(imported)).toBe(json);
}

const measured: Record<BenchmarkId, [number, number, number][]> = {
  // Delivered science, completed decisions, inspections, in preset order below.
  'evidence-survey': [[10, 83, 2], [15, 87, 3], [0, 79, 0]],
  'changing-priorities': [[15, 83, 3], [15, 87, 3], [5, 81, 3]],
  'storm-response': [[10, 84, 2], [10, 84, 2], [15, 86, 3]],
};
for (const benchmark of benchmarkIds) test(`${benchmark}: all presets complete long baseline runs with distinct measured tradeoffs`, async () => {
  let index = 0;
  for (const preset of ['balanced', 'conserve-energy', 'explore-more'] as const) {
    const record = await runBenchmarkPlaytest(benchmark, 'baseline', preset);
    const result = record.results;
    expect([result.scienceScore, record.decisions.length, result.inspectionCount]).toEqual(measured[benchmark][index++]!);
    expect(result.endingCondition).toBe('timeout');
    expect(result.elapsedMs).toBe(1_080_000);
    expect(result.cargo).toEqual([]);
    expect(result.rover.position).toEqual({ x: 16, z: 24 });
    expect(record.decisions.every(decision => decision.baseline?.version === 'evidence-priorities-v1')).toBe(true);
    expect(record.decisions.length).toBeLessThan(250);
    expect(result.usage!.providerAttempts).toBe(0);
    if (preset === 'balanced') roundTrip(record);
  }
}, 90_000);

for (const benchmark of benchmarkIds) test(`${benchmark}: scripted SDK survey delivers on multiple trips and preserves the external schedule`, async () => {
  const record = await runBenchmarkPlaytest(benchmark, 'survey', undefined, true);
  const result = record.results;
  expect(result.scienceScore).toBe(25);
  expect(result.deliveredSamples).toHaveLength(5);
  expect(new Set(result.deliveredSamples.map(sample => sample.deliveredAtMs)).size).toBe(3);
  expect(result.elapsedMs).toBe(1_080_000);
  expect(result.inspectionCount).toBe(5);
  expect(result.usage!.providerAttempts).toBe(benchmark === 'evidence-survey' ? 39 : benchmark === 'changing-priorities' ? 40 : 41);
  expect(result.usage!.retries).toBe(0);
  expect(record.decisions.some(decision => decision.input.decisionBoundary!.triggers.length > 1)).toBe(true);
  expect(result.memory.filter(item => item.kind === 'terrain').length).toBeGreaterThan(500);
  for (const decision of record.decisions) {
    const input = decision.input;
    expect(input).not.toHaveProperty('benchmark');
    expect(input).not.toHaveProperty('scenario');
    expect(JSON.stringify(input)).not.toContain('classifications');
    for (const sample of input.memory.filter(item => item.kind === 'sample')) {
      expect(sample).not.toHaveProperty('score');
      if (sample.properties) expect(sample.inspectedAtMs).toBeLessThanOrEqual(input.atMs);
    }
  }
  if (benchmark !== 'evidence-survey') {
    const baseline = createMatchedBaseline(record);
    baseline.dispatch({ type: 'start' });
    baseline.advanceWallTime(1_080_000);
    const matched = baseline.getCompletedRecords()[0]!;
    expect(compareExpeditionRecords(record, matched)).toMatchObject({ schedule: true, missionRequests: true, missionApplications: false });
    expect(matched.decisions.map(item => item.selectedCandidateId)).not.toEqual(record.decisions.map(item => item.selectedCandidateId));
    expect(matched.events.filter(event => event.type === 'storm-introduced').map(event => [event.atMs, event.storm]))
      .toEqual(record.events.filter(event => event.type === 'storm-introduced').map(event => [event.atMs, event.storm]));
  }
  roundTrip(record);
}, 90_000);

for (const benchmark of benchmarkIds) test(`${benchmark}: neglecting recharge causes an avoidable failure with retained outcomes`, async () => {
  const record = await runBenchmarkPlaytest(benchmark, 'no-recharge');
  expect(record.results.endingCondition).toBe('stranded');
  expect(record.results.battery).toBe(0);
  expect(record.results.elapsedMs).toBe(benchmark === 'storm-response' ? 256_000 : 340_000);
  expect(record.results.scienceScore).toBe(10);
  if (benchmark === 'changing-priorities') expect(record.results.interventions!.history).toEqual([]);
  roundTrip(record);
}, 30_000);

test('benchmark reset restores its setup and edits remain visible in comparison', () => {
  const session = createExpedition({ benchmark: 'storm-response' });
  const initial = session.getSnapshot();
  session.dispatch({ type: 'set-objective', objective: 'past-water' });
  session.dispatch({ type: 'set-instructions', instructions: 'Custom experiment' });
  session.dispatch({ type: 'set-intervention-schedule', schedule: { version: 'expedition-time-v1', events: [] } });
  session.dispatch({ type: 'start' });
  session.advanceWallTime(10_000);
  session.dispatch({ type: 'stop' });
  const custom = session.getCompletedRecords()[0]!;
  session.dispatch({ type: 'reset' });
  expect(session.getSnapshot()).toEqual(initial);
  session.dispatch({ type: 'start' });
  session.advanceWallTime(10_000);
  session.dispatch({ type: 'stop' });
  const original = session.getCompletedRecords()[1]!;
  expect(compareExpeditionRecords(custom, original)).toMatchObject({ benchmark: true, objective: false, missionRequests: false, schedule: false, freeText: true });
  roundTrip(original);
  const changedVersion = structuredClone(original);
  changedVersion.startingConditions.benchmark!.version++;
  changedVersion.results.benchmark!.version++;
  expect(compareExpeditionRecords(original, changedVersion).benchmark).toBe(false);
  changedVersion.results.benchmark!.version++;
  expect(() => exportExpeditionRecord(changedVersion)).toThrow('Invalid expedition record');
});

test('the pre-benchmark version 12 fixture replays and matches without acquiring a benchmark identity', async () => {
  const record = importExpeditionRecord(await Bun.file(`${import.meta.dir}/fixtures/legacy-benchmarks-v12.json`).text());
  expect(record.version).toBe(12);
  expect(record.startingConditions.benchmark).toBeUndefined();
  roundTrip(record);
  const matched = createMatchedBaseline(record);
  expect(matched.getSnapshot().benchmark).toBeUndefined();
});

for (const failure of ['retry', 'unknown', 'cost'] as const) test(`benchmark ${failure} responses stop at the configured usage guard`, async () => {
  let attempts = 0;
  const handler = createDecisionHandler({ apiKey: 'benchmark-scripted-provider', fetch: async (_url, init) => {
    attempts++;
    if (failure === 'unknown') return new Response('Unavailable', { status: 503 });
    const input: ControllerInput = JSON.parse(init!.body as string).state;
    return Response.json({ model: 'jev-1.13.0', usage: { input_tokens: 1000, output_tokens: 40 },
      answers: { action: { type: 'choice', choice: 'wait:5000', confidence: 0,
        probabilities: Object.fromEntries(input.candidates.map(action => [action.id, 1 / input.candidates.length])) } } },
      { status: failure === 'retry' && attempts === 1 ? 503 : 200 });
  } });
  const session = createExpedition({ benchmark: 'storm-response', controller: createTypeSafeController({
    fetch: (url, init) => handler(new Request(new URL(url, 'http://localhost'), init)),
  }) });
  session.dispatch({ type: 'set-inference-limits', limits: { providerAttempts: 2, estimatedCost: failure === 'cost' ? 0.00004 : 0.1 } });
  const settled = new Promise<void>(resolve => { const unsubscribe = session.onDecisionSettled(() => { unsubscribe(); resolve(); }); });
  session.dispatch({ type: 'start' });
  await settled;
  expect(attempts).toBe(failure === 'retry' ? 2 : 1);
  expect(session.getSnapshot().usagePause!.reasons).toEqual([failure === 'retry' ? 'attempt-limit' : failure === 'unknown' ? 'uncertainty' : 'cost-limit']);
  const frozen = session.getSnapshot();
  session.advanceWallTime(1_080_000);
  session.dispatch({ type: 'resume' });
  session.dispatch({ type: 'retry-decision' });
  expect(session.getSnapshot()).toEqual(frozen);
  expect(session.getSnapshot().stormIntroduced).toBe(false);
  session.dispatch({ type: 'stop' });
  roundTrip(session.getCompletedRecords()[0]!);
  expect(attempts).toBe(failure === 'retry' ? 2 : 1);
});
