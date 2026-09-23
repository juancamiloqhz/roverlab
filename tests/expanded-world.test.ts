import { expect, test } from 'bun:test';
import { runExpandedPlaytest } from '../scripts/playtest-expanded-world';
import { createExpedition, createReplay } from '../src/simulation/expedition';
import { exportExpeditionRecord, importExpeditionRecord } from '../src/records/contract';

test('the authored world records an eighteen-minute budget and resets its expanded resources', () => {
  const session = createExpedition({ controller: { id: 'scripted', decide: input => input.candidates.find(action => action.kind === 'wait')!.id } });
  const initial = session.getSnapshot();
  expect(initial).toMatchObject({ durationMs: 1_080_000, remainingMs: 1_080_000, battery: 160, cargoCapacity: 2,
    area: { width: 42, depth: 38 } });
  session.dispatch({ type: 'start' });
  session.advanceWallTime(300_000);
  expect(session.getSnapshot()).toMatchObject({ status: 'running', remainingMs: 780_000 });
  session.dispatch({ type: 'pause' });
  const paused = session.getSnapshot();
  session.advanceWallTime(1_000_000);
  expect(session.getSnapshot()).toEqual(paused);
  session.dispatch({ type: 'resume' });
  session.advanceWallTime(780_000);
  expect(session.getSnapshot()).toMatchObject({ status: 'ended', endingCondition: 'timeout', elapsedMs: 1_080_000 });
  const record = importExpeditionRecord(exportExpeditionRecord(session.getCompletedRecords()[0]!));
  expect(record).toMatchObject({ version: 13, startingConditions: { simulationVersion: 'grid-expedition-v1',
    durationMs: 1_080_000, batteryCapacity: 160, initialBattery: 160, scenario: { id: 'ochre-basin-v6' } } });
  expect(record.startingConditions.scenario.samples).toHaveLength(12);
  const replay = createReplay(record);
  replay.dispatch({ type: 'start' });
  replay.advanceWallTime(1_080_000);
  expect(replay.getSnapshot()).toEqual(record.results);
  session.dispatch({ type: 'reset' });
  expect(session.getSnapshot()).toEqual(initial);
  session.dispatch({ type: 'start' });
  session.dispatch({ type: 'stop' });
  expect(session.getSnapshot()).toMatchObject({ endingCondition: 'manual-stop', remainingMs: 1_080_000 });
});

test('region names and sample properties are learned only through observation and inspection', () => {
  const session = createExpedition();
  const initial = session.getSnapshot();
  const regions = (memory: typeof initial.memory) => [...new Set(memory.flatMap(item => item.kind === 'terrain' && item.region ? [item.region] : []))];
  expect(regions(initial.memory)).toEqual(['Western delta']);
  const debug = session.getFullWorldView();
  expect(new Set(debug.terrain.map(cell => cell.region))).toEqual(new Set(['Northern highlands', 'Eastern volcanic field', 'Western delta']));
  expect(debug.samples).toHaveLength(12);
  debug.terrain.length = 0;
  debug.samples[0]!.position.x = 0;
  expect(session.getSnapshot()).toEqual(initial);
  session.dispatch({ type: 'start' });
  session.advanceWallTime(21_900);
  expect(session.getSnapshot().scienceScore).toBe(0);
  expect(session.getSnapshot().memory.find(item => item.kind === 'sample')).not.toHaveProperty('properties');
  session.advanceWallTime(100);
  expect(session.getSnapshot().memory.find(item => item.kind === 'sample')).toMatchObject({ inspectedAtMs: 22_000,
    properties: ['Layered sediment', 'Rounded grains deposited by flowing water'] });
  for (const decision of session.getDecisions()) {
    expect(JSON.stringify(decision.input)).not.toContain('classifications');
    expect(JSON.stringify(decision.input)).not.toContain('Northern highlands');
    expect(JSON.stringify(decision.input)).not.toContain('Rare mineral intergrowths');
  }
});


test('a survey across the authored world delivers multiple loads and leaves competing opportunities at timeout', () => {
  const record = runExpandedPlaytest();
  expect(record.results.endingCondition).toBe('timeout');
  expect(record.results.elapsedMs).toBe(1_080_000);
  expect(record.results.deliveredSamples.length).toBeGreaterThanOrEqual(4);
  expect(record.results.deliveredSamples.length).toBeLessThan(12);
  expect(record.results.scienceScore).toBeGreaterThan(10);
  expect(record.events.filter(event => event.type === 'samples-delivered').length).toBeGreaterThanOrEqual(2);
  expect(record.events.some(event => event.type === 'samples-delivered' && event.samples.length === 2)).toBe(true);
  expect(record.events.filter(event => event.type === 'action-completed' && event.action.kind === 'recharge').length).toBeGreaterThanOrEqual(2);
  expect(record.decisions.some(decision => decision.input.cargo.length === 2
    && !decision.input.candidates.some(action => action.kind === 'collect'))).toBe(true);
});

test('a survey that skips recharge and the return reserve can strand before the time budget ends', () => {
  const record = runExpandedPlaytest({ recharge: false });
  expect(record.results.endingCondition).toBe('stranded');
  expect(record.results.battery).toBe(0);
  expect(record.results.elapsedMs).toBeLessThan(1_080_000);
  expect(record.results.scienceScore).toBe(10);
});


test('long surveys and their saved histories retain the same physical outcome at every playback speed', () => {
  const first = runExpandedPlaytest();
  const source = exportExpeditionRecord(first);
  for (const speed of [1, 2, 4] as const) {
    const live = speed === 1 ? first : runExpandedPlaytest({ speed });
    expect(live.results).toEqual({ ...first.results, speed });
    const imported = importExpeditionRecord(exportExpeditionRecord(live));
    const replay = createReplay(imported);
    replay.dispatch({ type: 'set-speed', speed });
    replay.dispatch({ type: 'start' });
    replay.advanceWallTime(1_080_000 / speed);
    expect(replay.getSnapshot()).toEqual(live.results);
    expect(replay.getDecisions()).toEqual(live.decisions);
    expect(replay.getRecord().events).toEqual(live.events);
    expect(replay.getCompletedRecords()).toEqual([]);
  }
  expect(exportExpeditionRecord(first)).toBe(source);
}, 30_000);

test.each(['legacy-usage-v1', 'legacy-usage-v2', 'legacy-usage-v3', 'legacy-mission-v4', 'legacy-baseline-v5',
  'legacy-cadence-v6', 'legacy-world-v7'])('supported five-minute history %s replays its original conditions without mutation', async name => {
  const source = await Bun.file(new URL(`./fixtures/${name}.json`, import.meta.url)).text();
  const record = importExpeditionRecord(source);
  for (const speed of [1, 2, 4] as const) {
    const replay = createReplay(record);
    expect(replay.getSnapshot().durationMs).toBe(300_000);
    expect(replay.getRecord().startingConditions).toEqual(record.startingConditions);
    replay.dispatch({ type: 'set-speed', speed });
    replay.dispatch({ type: 'start' });
    replay.advanceWallTime(300_000 / speed);
    expect(replay.getSnapshot()).toEqual({ ...record.results, speed });
    expect(replay.getDecisions()).toEqual(record.decisions);
    expect(replay.getRecord().events).toEqual(record.events);
  }
  expect(JSON.parse(exportExpeditionRecord(record))).toEqual(JSON.parse(source));
});

test('unsupported settings and malformed research regions are rejected before replay', () => {
  const session = createExpedition();
  session.dispatch({ type: 'start' });
  session.dispatch({ type: 'stop' });
  const record = session.getCompletedRecords()[0]!;
  expect(() => createReplay({ ...record, startingConditions: { ...record.startingConditions, simulationVersion: 'unknown' } })).toThrow();
  expect(() => createReplay({ ...record, startingConditions: { ...record.startingConditions, durationMs: 300_000 } })).toThrow();
  record.startingConditions.scenario.regions![0]!.max.x = 42;
  expect(() => exportExpeditionRecord(record)).toThrow('Invalid expedition record');
});

test('cargo and energy impose a time cost even on an ideal tour that collects every sample without inspection', () => {
  const { scenario, durationMs, collectMs, rechargePerSecond, initialBattery } = createExpedition().getRecord().startingConditions;
  // With two slots, every closed trip has at least one base-to-sample leg per
  // delivered sample. Ignore all obstacles, rough terrain, sensing and inspection.
  const baseLegs = scenario.samples.reduce((sum, sample) => sum
    + Math.abs(sample.position.x - scenario.base.x) + Math.abs(sample.position.z - scenario.base.z), 0);
  expect(baseLegs).toBe(245);
  const minimumMs = baseLegs * 4_000 + scenario.samples.length * collectMs
    + Math.max(0, baseLegs * 2 - initialBattery) / rechargePerSecond * 1_000;
  expect(minimumMs).toBe(1_094_000);
  expect(minimumMs).toBeGreaterThan(durationMs);
});

test('changing unseen research and terrain cannot change either controller input before discovery', () => {
  const original = createExpedition().getRecord().startingConditions.scenario;
  const changed = structuredClone(original);
  changed.samples[7]!.properties = ['Hidden replacement'];
  changed.samples[0]!.classifications['past-water'] = 'unrelated';
  changed.obstacles.push({ x: 41, z: 0 });
  changed.regions![1]!.name = 'Hidden region replacement';
  const first = createExpedition({ scenario: original });
  const second = createExpedition({ scenario: changed });
  for (const session of [first, second]) {
    session.getFullWorldView();
    session.dispatch({ type: 'start' });
    session.advanceWallTime(21_900);
  }
  expect(first.getSnapshot()).toEqual(second.getSnapshot());
  expect(first.getDecisions()).toEqual(second.getDecisions());
});

test('the backend and real SDK accept growing rover knowledge across an eighteen-minute scripted expedition', async () => {
  const { createDecisionHandler } = await import('../server/decisions');
  const { createTypeSafeController } = await import('../src/controllers/typesafe');
  const { chooseSurveyAction } = await import('../scripts/playtest-expanded-world');
  let calls = 0;
  let mostKnownCells = 0;
  const handler = createDecisionHandler({ apiKey: 'expanded-world-scripted-provider', fetch: async (_url, init) => {
    calls++;
    const input = JSON.parse(init!.body as string).state;
    mostKnownCells = Math.max(mostKnownCells, input.memory.filter((item: { kind: string }) => item.kind === 'terrain').length);
    expect(JSON.stringify(input)).not.toContain('classifications');
    return Response.json({ model: 'jev-1.13.0', usage: { input_tokens: 1000, output_tokens: 40 },
      answers: { action: { type: 'choice', choice: chooseSurveyAction(input), confidence: 0,
        probabilities: Object.fromEntries(input.candidates.map((action: { id: string }) => [action.id, 1 / input.candidates.length])) } } });
  } });
  const session = createExpedition({ controller: createTypeSafeController({ fetch: (url, init) =>
    handler(new Request(new URL(url, 'http://localhost'), init)) }) });
  session.dispatch({ type: 'start' });
  for (let turns = 0; turns < 2_000 && session.getSnapshot().status !== 'ended'; turns++) {
    if (session.getSnapshot().decisionPending) await Bun.sleep(0);
    else session.advanceWallTime(5_000);
    expect(session.getSnapshot().decisionFailure).toBeNull();
    expect(session.getSnapshot().usagePause).toBeNull();
  }
  const record = importExpeditionRecord(exportExpeditionRecord(session.getCompletedRecords()[0]!));
  expect(record.results).toMatchObject({ endingCondition: 'timeout', elapsedMs: 1_080_000, scienceScore: 25 });
  expect(record.results.deliveredSamples).toHaveLength(5);
  expect(calls).toBe(39);
  expect(calls).toBeLessThan(record.startingConditions.inferenceLimits!.providerAttempts);
  expect(record.results.usage?.providerAttempts).toBe(calls);
  expect(mostKnownCells).toBeGreaterThan(399);
  const replay = createReplay(record);
  replay.dispatch({ type: 'start' });
  replay.advanceWallTime(1_080_000);
  expect(replay.getSnapshot()).toEqual(record.results);
  expect(calls).toBe(39);
}, 30_000);
