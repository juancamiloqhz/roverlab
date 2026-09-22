import { expect, test } from 'bun:test';
import { createExpedition, createReplay } from '../src/simulation/expedition';
import { exportExpeditionRecord, importExpeditionRecord } from '../src/records/contract';
import { createTypeSafeController } from '../src/controllers/typesafe';
import { createDecisionHandler } from '../server/decisions';
import { chooseBaselineAction } from '../src/controllers/baseline';
import type { ExpeditionSession } from '../src/simulation/expedition';
import type { ExpeditionRecord } from '../src/simulation/types';
import { greedySurvey } from './fixtures/greedy-survey';

async function advanceTo(session: ExpeditionSession, atMs: number) {
  for (let steps = 0; steps < 2000; steps++) {
    const snapshot = session.getSnapshot();
    if (snapshot.status === 'ended' || snapshot.decisionFailure) return;
    if (snapshot.decisionPending) { await Bun.sleep(0); continue; }
    if (snapshot.elapsedMs >= atMs) return;
    session.advanceWallTime(Math.min(5_000, atMs - snapshot.elapsedMs));
  }
  throw new Error('Expedition did not reach the requested time.');
}

test('a saved baseline expedition replays its actions and discoveries from its original scenario', () => {
  const live = createExpedition();
  live.dispatch({ type: 'start' });
  live.advanceWallTime(43_000);
  live.dispatch({ type: 'stop' });
  const record = importExpeditionRecord(exportExpeditionRecord(live.getCompletedRecords()[0]!));
  const replay = createReplay(record);
  expect(replay.getSnapshot()).toMatchObject({ status: 'ready', elapsedMs: 0, scienceScore: 0 });
  replay.dispatch({ type: 'start' });
  replay.advanceWallTime(10_000);
  expect(replay.getSnapshot()).toMatchObject({ status: 'running', elapsedMs: 10_000 });
  expect(replay.getSnapshot().rover.position).not.toEqual(record.startingConditions.scenario.base);
  replay.advanceWallTime(60_000);
  expect(replay.getSnapshot()).toEqual(record.results);
  expect(replay.getSnapshot()).toMatchObject({ scienceScore: 10, inspectionCount: 1, deliveredSamples: [{ sampleId: 'a' }] });
  expect(replay.getDecisions()).toEqual(record.decisions);
  expect(replay.getRecord().events).toEqual(record.events);
  expect(replay.getCompletedRecords()).toEqual([]);
});

test('replay applies storm and mission events at their recorded times across pauses and playback speeds', () => {
  const live = createExpedition();
  live.dispatch({ type: 'set-objective', objective: 'unusual-minerals' });
  live.dispatch({ type: 'set-instructions', instructions: 'Inspect nearby minerals.' });
  live.dispatch({ type: 'reset' });
  live.dispatch({ type: 'start' });
  live.advanceWallTime(90_000);
  live.dispatch({ type: 'introduce-storm' });
  live.dispatch({ type: 'pause' });
  live.dispatch({ type: 'set-instructions', instructions: 'Avoid costly crossings.' });
  live.dispatch({ type: 'set-speed', speed: 2 });
  live.dispatch({ type: 'resume' });
  live.advanceWallTime(105_000);
  const record = importExpeditionRecord(exportExpeditionRecord(live.getCompletedRecords()[0]!));
  const original = structuredClone(record);
  expect(record.events.some(event => event.type === 'storm-detected')).toBe(true);
  expect(record.events.some(event => event.type === 'storm-expired')).toBe(true);
  for (const speed of [1, 2, 4] as const) {
    const replay = createReplay(record);
    expect(replay.getSnapshot()).toMatchObject({ objective: 'unusual-minerals', instructions: 'Inspect nearby minerals.' });
    replay.dispatch({ type: 'set-speed', speed });
    replay.dispatch({ type: 'start' });
    replay.advanceWallTime(89_900 / speed);
    expect(replay.getSnapshot()).toMatchObject({ elapsedMs: 89_900, stormIntroduced: false, instructionsVersion: 0 });
    replay.advanceWallTime(100 / speed);
    expect(replay.getSnapshot()).toMatchObject({ elapsedMs: 90_000, stormIntroduced: true, instructions: 'Avoid costly crossings.', speed });
    replay.dispatch({ type: 'pause' });
    const paused = replay.getSnapshot();
    replay.advanceWallTime(60_000);
    replay.dispatch({ type: 'set-instructions', instructions: 'Overwrite history' });
    replay.dispatch({ type: 'set-objective', objective: 'past-water' });
    expect(replay.getSnapshot()).toEqual(paused);
    replay.dispatch({ type: 'resume' });
    for (let count = 0; count < 1600 && replay.getSnapshot().status !== 'ended'; count++) replay.advanceWallTime(137);
    replay.advanceWallTime(300_000);
    expect(replay.getSnapshot()).toEqual({ ...record.results, speed });
    expect(replay.getRecord().events).toEqual(record.events);
    expect(replay.getCompletedRecords()).toEqual([]);
  }
  expect(record).toEqual(original);
});

test.each([false, true])('TypeSafe choices and recovery replay without inference (mixed controller: %s)', async mixed => {
  let calls = 0;
  let fail = false;
  const handler = createDecisionHandler({ apiKey: 'replay-scripted-service', fetch: async (_url, init) => {
    calls++;
    if (fail) return Response.json({ model: 'jev-1.13.0', usage: { input_tokens: 1000, output_tokens: 40 } }, { status: 503 });
    const input = JSON.parse(init!.body as string).state;
    return Response.json({ model: 'jev-1.13.0', usage: { input_tokens: 1000, output_tokens: 40 }, answers: { action: { type: 'choice', choice: chooseBaselineAction(input).id, confidence: 0,
      probabilities: Object.fromEntries(input.candidates.map((candidate: { id: string }) => [candidate.id, 1 / input.candidates.length])),
    } } });
  } });
  const live = createExpedition({ typesafeController: createTypeSafeController({ fetch: (url, init) => handler(new Request(new URL(url, 'http://localhost'), init)) }) });
  live.dispatch({ type: 'set-controller', controller: 'typesafe' });
  live.dispatch({ type: 'set-objective', objective: 'unusual-minerals' });
  live.dispatch({ type: 'set-instructions', instructions: 'Survey the mineral samples.' });
  live.dispatch({ type: 'start' });
  await advanceTo(live, 90_000);
  live.dispatch({ type: 'introduce-storm' });
  await advanceTo(live, 90_000);
  fail = mixed;
  live.dispatch({ type: 'set-instructions', instructions: 'Conserve energy around the storm.' });
  if (mixed) {
    await advanceTo(live, 120_000);
    expect(live.getSnapshot().decisionFailure).toBe('unavailable');
    live.dispatch({ type: 'retry-decision' });
    await advanceTo(live, 120_000);
    live.dispatch({ type: 'continue-with-baseline' });
  }
  await advanceTo(live, 300_000);
  const record = importExpeditionRecord(exportExpeditionRecord(live.getCompletedRecords()[0]!));
  expect(record.results.controllerHistory.map(entry => entry.controller)).toEqual(mixed ? ['typesafe', 'baseline'] : ['typesafe']);
  expect(record.decisions.filter(decision => decision.controller === 'baseline').every(decision => decision.baseline?.version === 'evidence-priorities-v1')).toBe(true);
  expect(record.decisions.filter(decision => decision.controller === 'typesafe').every(decision => !decision.baseline)).toBe(true);
  expect(record.results.inspectionCount).toBeGreaterThan(0);
  expect(record.events.some(event => event.type === 'storm-expired')).toBe(true);
  const recordedCalls = calls;
  for (const speed of [1, 2, 4] as const) {
    const replay = createReplay(record);
    replay.dispatch({ type: 'set-speed', speed });
    replay.dispatch({ type: 'start' });
    replay.advanceWallTime(300_000 / speed);
    expect(replay.getSnapshot()).toEqual({ ...record.results, speed });
    expect(replay.getDecisions()).toEqual(record.decisions);
    expect(replay.getRecord().events).toEqual(record.events);
    expect(replay.getCompletedRecords()).toEqual([]);
  }
  expect(calls).toBe(recordedCalls);
});

test('cancelled decisions and rapid stop/reset histories replay in their original event order', async () => {
  let calls = 0;
  const live = createExpedition({ controller: createTypeSafeController({ fetch: (_url, init) => {
    calls++;
    return new Promise((_resolve, reject) => init!.signal!.addEventListener('abort', () => reject(new Error('cancelled')), { once: true }));
  } }) });
  live.dispatch({ type: 'start' });
  live.dispatch({ type: 'set-instructions', instructions: 'Use the updated mission.' });
  await Bun.sleep(0);
  live.dispatch({ type: 'stop' });
  live.dispatch({ type: 'reset' });
  live.dispatch({ type: 'start' });
  live.dispatch({ type: 'stop' });
  await Bun.sleep(0);
  const records = live.getCompletedRecords();
  expect(records).toHaveLength(2);
  expect(records[0]!.decisions.every(decision => decision.status === 'discarded')).toBe(true);
  const callsBeforeReplay = calls;
  for (const record of records) {
    const replay = createReplay(importExpeditionRecord(exportExpeditionRecord(record)));
    replay.dispatch({ type: 'start' });
    expect(replay.getSnapshot()).toEqual(record.results);
    expect(replay.getRecord().events).toEqual(record.events);
    expect(replay.getDecisions()).toEqual(record.decisions);
  }
  expect(calls).toBe(callsBeforeReplay);
});

test('records with unsupported settings or irreproducible history are rejected before playback starts', () => {
  const live = createExpedition();
  live.dispatch({ type: 'start' });
  live.advanceWallTime(1_000);
  live.dispatch({ type: 'stop' });
  const source = live.getCompletedRecords()[0]!;
  const mutations: ((record: ExpeditionRecord) => void)[] = [
    record => { record.startingConditions.fixedStepMs = 50; },
    record => { record.startingConditions.initialBattery = 99; },
    record => { record.startingConditions.travelTimeMs.plain = 2_000; },
    record => { record.events = record.events.filter(event => event.type !== 'energy-changed'); },
    record => { record.events.find(event => event.type === 'energy-changed')!.atMs = 51; },
    record => { record.results.rover.position.x += 1; },
    record => { record.results.energyUsed += 1; },
  ];
  for (const mutate of mutations) {
    const record = structuredClone(source);
    mutate(record);
    expect(() => createReplay(record)).toThrow('Cannot replay this expedition');
  }
  expect(() => createReplay({ ...source, version: 99 })).toThrow('Invalid expedition record');
  expect(() => createReplay({ ...source, decisions: [] })).toThrow('Invalid expedition record');
  expect(live.getCompletedRecords()).toEqual([source]);
});

test('stopping and restarting replay preserves the saved custom scenario and stranded result', () => {
  const live = createExpedition({ controller: greedySurvey, scenario: {
    id: 'replay-corridor', name: 'Recorded corridor', width: 54, depth: 1, base: { x: 0, z: 0 },
    sensorRange: 53, obstacles: [], roughTerrain: [],
    samples: [1, 52].map(x => ({ id: String(x), label: `Sample ${x}`, position: { x, z: 0 }, properties: ['Layered sediment'],
      classifications: { 'past-water': 'strong-evidence', 'unusual-minerals': 'unrelated' },
    })),
  } });
  live.dispatch({ type: 'start' });
  live.advanceWallTime(300_000);
  const source = live.getCompletedRecords()[0]!;
  expect(source.results).toMatchObject({ endingCondition: 'stranded', scienceScore: 0, energyUsed: 100, elapsedMs: 210_000, cargo: [{ sampleId: '1' }] });
  const saved = exportExpeditionRecord(source);
  const replay = createReplay(source);
  let completions = 0;
  replay.onExpeditionCompleted(() => { completions++; });
  expect(replay.getSnapshot().area.name).toBe('Recorded corridor');
  expect(replay.getFullWorldView().samples).toHaveLength(2);
  replay.dispatch({ type: 'start' });
  replay.advanceWallTime(10_000);
  replay.dispatch({ type: 'stop' });
  const stopped = replay.getSnapshot();
  expect(stopped).toMatchObject({ status: 'ended', elapsedMs: 10_000, currentAction: null });
  replay.advanceWallTime(300_000);
  expect(replay.getSnapshot()).toEqual(stopped);
  replay.dispatch({ type: 'reset' });
  expect(replay.getSnapshot()).toMatchObject({ status: 'ready', elapsedMs: 0 });
  replay.dispatch({ type: 'set-speed', speed: 4 });
  replay.dispatch({ type: 'start' });
  replay.advanceWallTime(75_000);
  expect(replay.getSnapshot()).toEqual({ ...source.results, speed: 4 });
  expect(replay.getRecord().events).toEqual(source.events);
  expect(replay.getFullWorldView().samples).toHaveLength(1);
  expect(completions).toBe(0);
  expect(replay.getCompletedRecords()).toEqual([]);
  expect(exportExpeditionRecord(source)).toBe(saved);
});
