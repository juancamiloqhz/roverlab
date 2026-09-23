import { expect, test } from 'bun:test';
import { createExpedition, createMatchedBaseline, createReplay, type ExpeditionSession } from '../src/simulation/expedition';
import { exportExpeditionRecord, importExpeditionRecord } from '../src/records/contract';
import type { ExpeditionRecord, Scenario } from '../src/simulation/types';
import { compareExpeditionRecords, presetAdherence } from '../src/records/matching';
import { createDecisionHandler } from '../server/decisions';
import { createTypeSafeController } from '../src/controllers/typesafe';

const corridor: Scenario = {
  id: 'matched-corridor', name: 'Matched corridor', width: 10, depth: 1,
  base: { x: 0, z: 0 }, sensorRange: 1, obstacles: [], roughTerrain: [], samples: [], durationMs: 30_000,
  dustStorm: { position: { x: 4, z: 0 }, radius: 0.5, durationMs: 20_000, sensorRange: 0.5, movementEnergyMultiplier: 3 },
};
function finish(session: ExpeditionSession) {
  session.advanceWallTime(session.getSnapshot().durationMs);
  session.dispatch({ type: 'stop' });
  return session.getCompletedRecords().at(-1)!;
}
function roundTrip(record: ExpeditionRecord) {
  const json = exportExpeditionRecord(record);
  const imported = importExpeditionRecord(json);
  const replay = createReplay(imported);
  replay.dispatch({ type: 'start' });
  replay.advanceWallTime(record.results.durationMs);
  expect(replay.getSnapshot()).toEqual({ ...record.results, speed: 1 });
  expect(replay.getDecisions()).toEqual(record.decisions);
  expect(exportExpeditionRecord(imported)).toBe(json);
}
function sourceRun() {
  const session = createExpedition({ scenario: corridor, controller: { id: 'typesafe', decide: input => ({
    selectedCandidateId: 'wait:5000', confidence: 1,
    probabilities: Object.fromEntries(input.candidates.map(candidate => [candidate.id, candidate.id === 'wait:5000' ? 1 : 0])),
  }) } });
  session.dispatch({ type: 'set-objective', objective: 'unusual-minerals' });
  session.dispatch({ type: 'set-mission-preset', preset: 'balanced' });
  session.dispatch({ type: 'start' });
  session.advanceWallTime(8_000);
  session.dispatch({ type: 'introduce-storm' });
  session.dispatch({ type: 'set-mission-preset', preset: 'conserve-energy' });
  return finish(session);
}

test('a matched baseline executes its own choices, preserves conditions and schedule, and round-trips both histories without inference', () => {
  const source = sourceRun();
  const json = exportExpeditionRecord(source);
  const originalFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = Object.assign(() => { requests++; throw new Error('No provider access allowed'); }, { preconnect: originalFetch.preconnect });
  try {
    const baseline = createMatchedBaseline(source);
    baseline.dispatch({ type: 'start' });
    const record = finish(baseline);
    expect(record.id).not.toBe(source.id);
    expect(record.matchedFrom).toEqual({ recordId: source.id, recordVersion: source.version, scheduleBasis: 'recorded' });
    expect(record.startingConditions.scenario).toEqual(source.startingConditions.scenario);
    expect(record.results.objective).toBe('unusual-minerals');
    expect(record.results.interventions!.schedule).toEqual(source.results.interventions!.schedule);
    expect(record.events.filter(event => event.type === 'storm-introduced')).toMatchObject([
      { atMs: 8_000, storm: { position: { x: 4, z: 0 }, expiresAtMs: 28_000 } },
    ]);
    expect(record.results.interventions!.history.map(item => item.requestedAtMs)).toEqual([0, 8_000, 8_000]);
    expect(record.decisions[0]!.action!.kind).toBe('explore');
    expect(record.results.rover.distance).toBeGreaterThan(0);
    expect(source.results.rover.distance).toBe(0);
    expect(record.decisions.every(decision => decision.controller === 'baseline' && decision.baseline)).toBe(true);
    expect(record.results.usage).toMatchObject({ providerAttempts: 0, inputTokens: 0, outputTokens: 0, estimatedCost: 0 });
    roundTrip(source);
    roundTrip(record);
    expect(exportExpeditionRecord(source)).toBe(json);
    expect(requests).toBe(0);
  } finally { globalThis.fetch = originalFetch; }
});

test('comparison distinguishes matched requests from path-dependent mission application and later manual edits', () => {
  const source = sourceRun();
  const session = createMatchedBaseline(source);
  session.dispatch({ type: 'start' });
  const baseline = finish(session);
  const comparison = compareExpeditionRecords(source, baseline);
  expect(comparison).toMatchObject({ scenario: true, simulation: true, objective: true, rubric: true,
    missionRequests: true, schedule: true, scheduleComplete: true, freeText: false, missionApplications: false });
  const changed = createMatchedBaseline(source);
  changed.dispatch({ type: 'start' });
  changed.advanceWallTime(12_000);
  changed.dispatch({ type: 'set-instructions', instructions: 'Prioritize crystals.' });
  expect(compareExpeditionRecords(source, finish(changed))).toMatchObject({ missionRequests: false, schedule: false, freeText: true });
  expect(presetAdherence(baseline).returnMargins.some(margin => margin.required === 20)).toBe(true);
  expect(presetAdherence(source)).toMatchObject({ knowledgeRate: 0, deliveryFraction: null });
});

test('legacy conditions retain five-minute budgets and cadence, with incomplete schedule and free-text disclosures', async () => {
  for (const filename of ['legacy-usage-v1', 'legacy-mission-v4', 'legacy-baseline-v5', 'legacy-cadence-v6', 'legacy-world-v7', 'legacy-interventions-v10']) {
    const source = importExpeditionRecord(await Bun.file(`${import.meta.dir}/fixtures/${filename}.json`).text());
    const original = exportExpeditionRecord(source);
    const baseline = createMatchedBaseline(source);
    expect(baseline.getSnapshot().durationMs).toBe(source.startingConditions.durationMs);
    baseline.dispatch({ type: 'start' });
    baseline.advanceWallTime(12_000);
    baseline.dispatch({ type: 'stop' });
    const record = baseline.getCompletedRecords()[0]!;
    expect(record.startingConditions.decisionCadence).toBe(source.startingConditions.decisionCadence);
    expect(record.matchedFrom?.scheduleBasis).toBe('reconstructed-legacy');
    expect(compareExpeditionRecords(source, record).scheduleComplete).toBe(false);
    roundTrip(record);
    expect(exportExpeditionRecord(source)).toBe(original);
  }
});

test('unsupported conditions reject a fresh run without rewriting the source', () => {
  const source = sourceRun();
  source.startingConditions.travelTimeMs.plain = 1;
  const original = JSON.stringify(source);
  expect(() => createMatchedBaseline(source)).toThrow('not supported');
  expect(JSON.stringify(source)).toBe(original);
});

test('lost responses and explicit mixed-controller continuation retain unknown usage and failures during matching', async () => {
  let calls = 0;
  const handler = createDecisionHandler({ apiKey: 'scripted-key', fetch: async () => {
    calls++;
    return Response.json({ error: 'scripted failure' }, { status: 503 });
  } });
  const session = createExpedition({ scenario: corridor, controller: createTypeSafeController({ fetch: async (url, init) => {
    await handler(new Request(new URL(url, 'http://localhost'), init));
    throw new Error('Lost local response');
  } }) });
  session.dispatch({ type: 'set-instructions', instructions: 'Look for unusual crystals.' });
  session.dispatch({ type: 'start' });
  await new Promise<void>(resolve => { const unsubscribe = session.onDecisionSettled(() => { unsubscribe(); resolve(); }); });
  expect(session.getSnapshot().usagePause?.reasons).toContain('uncertainty');
  session.dispatch({ type: 'continue-with-baseline' });
  const source = finish(session);
  expect(source.results.controllerHistory.map(entry => entry.controller)).toEqual(['typesafe', 'baseline']);
  expect(source.results.usage).toMatchObject({ unconfirmedSubmissions: 1, estimatedCost: null, inputTokens: null });
  const baseline = createMatchedBaseline(source);
  baseline.dispatch({ type: 'start' });
  const record = finish(baseline);
  expect(record.results.usage).toMatchObject({ providerAttempts: 0, estimatedCost: 0 });
  expect(source.decisions.some(decision => decision.status === 'failed')).toBe(true);
  expect(compareExpeditionRecords(source, record).freeText).toBe(true);
  roundTrip(source);
  roundTrip(record);
  expect(calls).toBe(1);
});

test('legacy incompleteness remains visible when matching a generated baseline again', async () => {
  const source = importExpeditionRecord(await Bun.file(`${import.meta.dir}/fixtures/legacy-usage-v1.json`).text());
  const first = createMatchedBaseline(source);
  first.dispatch({ type: 'start' });
  first.dispatch({ type: 'stop' });
  const second = createMatchedBaseline(first.getCompletedRecords()[0]);
  second.dispatch({ type: 'start' });
  second.dispatch({ type: 'stop' });
  const record = second.getCompletedRecords()[0]!;
  expect(record.matchedFrom?.scheduleBasis).toBe('reconstructed-legacy');
  roundTrip(record);
});

test('the version 11 SDK fixture matches its complete schedule and retains recorded prices', async () => {
  const source = importExpeditionRecord(await Bun.file(`${import.meta.dir}/fixtures/legacy-matching-v11.json`).text());
  expect(source.version).toBe(11);
  const session = createMatchedBaseline(source);
  session.dispatch({ type: 'start' });
  const baseline = finish(session);
  expect(compareExpeditionRecords(source, baseline)).toMatchObject({ schedule: true, scheduleComplete: true, missionRequests: true });
  expect(source.results.usage?.estimatedCost).toBe(0.000042);
  expect(baseline.matchedFrom).toMatchObject({ recordId: source.id, recordVersion: 11, scheduleBasis: 'recorded' });
  roundTrip(source);
  roundTrip(baseline);
});

test('delivered science and measured adherence preserve a Jev loss without crediting unexecuted alternatives', () => {
  const source = createExpedition({ scenario: { ...corridor, width: 3, durationMs: 60_000, dustStorm: undefined,
    samples: [{ id: 'water', label: 'Water evidence', position: { x: 1, z: 0 }, properties: ['Rounded grains deposited by flowing water'],
      classifications: { 'past-water': 'strong-evidence', 'unusual-minerals': 'unrelated' } }],
  }, controller: { id: 'typesafe', decide: input => ({ selectedCandidateId: 'wait:5000', confidence: 1,
    probabilities: Object.fromEntries(input.candidates.map(candidate => [candidate.id, candidate.id === 'wait:5000' ? 1 : 0])) }) } });
  source.dispatch({ type: 'set-mission-preset', preset: 'balanced' });
  source.dispatch({ type: 'start' });
  const record = finish(source);
  const session = createMatchedBaseline(record);
  session.dispatch({ type: 'start' });
  const baseline = finish(session);
  expect(record.results.scienceScore).toBe(0);
  expect(record.decisions[0]!.baselineAlternative!.action.kind).toBe('inspect');
  expect(baseline.results).toMatchObject({ scienceScore: 10, cargo: [], endingCondition: 'timeout', rover: { position: { x: 0, z: 0 } } });
  expect(presetAdherence(baseline)).toMatchObject({ knowledgeRate: 1, deliveryFraction: 1 });
  expect(presetAdherence(record)).toMatchObject({ knowledgeRate: 0, deliveryFraction: null });
  roundTrip(baseline);
});

test('a stranded source remains inspectable and can be matched without forcing the same ending', () => {
  const source = createExpedition({ scenario: { ...corridor, batteryCapacity: 2 },
    controller: { id: 'scripted', decide: input => input.candidates.find(action => action.kind === 'explore')!.id } });
  source.dispatch({ type: 'start' });
  const record = finish(source);
  expect(record.results.endingCondition).toBe('stranded');
  const session = createMatchedBaseline(record);
  session.dispatch({ type: 'start' });
  const baseline = finish(session);
  expect(baseline.results.endingCondition).toBe('timeout');
  expect(baseline.results.rover.position).toEqual({ x: 0, z: 0 });
  expect(record.results.endingCondition).toBe('stranded');
  roundTrip(record);
  roundTrip(baseline);
});
