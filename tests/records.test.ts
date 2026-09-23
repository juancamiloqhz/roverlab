import { readProviderInput } from './fixtures/provider-input';
import { expect, test } from 'bun:test';
import { createFirstPlayableExpedition as createExpedition } from './fixtures/first-playable-session';

test('completed expeditions retain their own starting conditions, final knowledge and history across reset', () => {
  const expedition = createExpedition();
  expect(expedition.getCompletedRecords()).toHaveLength(0);
  expedition.dispatch({ type: 'set-objective', objective: 'unusual-minerals' });
  expedition.dispatch({ type: 'set-instructions', instructions: 'Inspect the nearest sample.' });
  expedition.dispatch({ type: 'start' });
  expedition.advanceWallTime(43_000);
  expedition.dispatch({ type: 'stop' });
  const final = expedition.getSnapshot();
  const [first] = expedition.getCompletedRecords();
  expect(first!.results).toEqual(final);
  expect(first!.results).toMatchObject({ scienceScore: 0, inspectionCount: 1, deliveredSamples: [] });
  expect(first!.decisions).toEqual(expedition.getDecisions());
  expect(first!.events).toEqual(expedition.getRecord().events);
  expect(first!.startingConditions.scenario.samples).toHaveLength(3);

  expedition.dispatch({ type: 'reset' });
  expedition.dispatch({ type: 'start' });
  expedition.advanceWallTime(1_000);
  expedition.dispatch({ type: 'stop' });
  const records = expedition.getCompletedRecords();
  expect(records).toHaveLength(2);
  expect(records[0]).toEqual(first);
  expect(records[1]!.id).not.toBe(first!.id);
  expect(records[1]!.startingConditions).toMatchObject({ objective: 'unusual-minerals', instructions: 'Inspect the nearest sample.' });
  expect(records[1]!.events.every(event => event.expedition === 2)).toBe(true);
  records[0]!.results.memory.length = 0;
  expect(expedition.getCompletedRecords()[0]!.results.memory).toEqual(final.memory);
});

test('a completed history with instructions and a dust storm round-trips as validated JSON without changing the session', async () => {
  const { exportExpeditionRecord, importExpeditionRecord } = await import('../src/records/contract');
  const expedition = createExpedition();
  expedition.dispatch({ type: 'start' });
  expedition.advanceWallTime(90_000);
  expedition.dispatch({ type: 'introduce-storm' });
  expedition.dispatch({ type: 'set-instructions', instructions: 'Avoid costly crossings.' });
  expedition.advanceWallTime(210_000);
  const [record] = expedition.getCompletedRecords();
  const json = exportExpeditionRecord(record!);
  const reopened = importExpeditionRecord(json);
  expect(reopened).toEqual(JSON.parse(JSON.stringify(record)));
  expect(reopened.events.some(event => event.type === 'storm-detected')).toBe(true);
  expect(reopened.events.some(event => event.type === 'storm-expired')).toBe(true);
  expect(reopened.events.some(event => event.type === 'instructions-changed')).toBe(true);
  expect(reopened.decisions.every(decision => !decision.probabilities)).toBe(true);
  expect(reopened.results).toEqual(expedition.getSnapshot());
  expect(expedition.getCompletedRecords()).toEqual([record!]);
});

test('stop followed immediately by reset saves cancelled inference latency in the completed expedition', async () => {
  const { createTypeSafeController } = await import('../src/controllers/typesafe');
  const controller = createTypeSafeController({ fetch: (_url, init) => new Promise((_resolve, reject) => {
    init!.signal!.addEventListener('abort', () => reject(new Error('cancelled')), { once: true });
  }) });
  const expedition = createExpedition({ controller });
  expedition.dispatch({ type: 'start' });
  await Bun.sleep(5);
  expedition.dispatch({ type: 'stop' });
  expect(expedition.getCompletedRecords()).toHaveLength(0);
  expedition.dispatch({ type: 'reset' });
  await Bun.sleep(0);
  const [record] = expedition.getCompletedRecords();
  expect(record!.results).toMatchObject({ status: 'ended', decisionPending: false, inferenceAttempts: 1, endingCondition: 'manual-stop' });
  expect(record!.results.inferenceLatencyMs).toBeGreaterThan(0);
  expect(record!.decisions[0]).toMatchObject({ status: 'discarded', inferenceAttempts: 1, latencyMs: record!.results.inferenceLatencyMs });
  expect(record!.events.at(-1)).toMatchObject({ type: 'decision-settled', expedition: 1 });
  expect(expedition.getSnapshot()).toMatchObject({ status: 'ready', inferenceAttempts: 0, inferenceLatencyMs: 0 });
  const { exportExpeditionRecord, importExpeditionRecord } = await import('../src/records/contract');
  expect(importExpeditionRecord(exportExpeditionRecord(record!))).toEqual(JSON.parse(JSON.stringify(record)));
});

test.each([false, true])('TypeSafe histories preserve actual probabilities, recovery and controller attribution (mixed: %s)', async mixed => {
  const { createDecisionHandler } = await import('../server/decisions');
  const { createTypeSafeController } = await import('../src/controllers/typesafe');
  const { exportExpeditionRecord, importExpeditionRecord } = await import('../src/records/contract');
  let fail = mixed;
  let calls = 0;
  const handler = createDecisionHandler({ apiKey: 'record-test-key-never-export', fetch: async (_url, init) => {
    calls++;
    if (fail) return Response.json({ model: 'jev-1.13.0', usage: { input_tokens: 1000, output_tokens: 40 }, error: 'record-test-key-never-export' }, { status: 503 });
    const input = readProviderInput(JSON.parse(init!.body as string).state);
    return Response.json({ model: 'jev-1.13.0', usage: { input_tokens: 1000, output_tokens: 40 }, answers: { action: { type: 'choice', choice: 'wait:5000', confidence: 0,
      probabilities: Object.fromEntries(input.candidates.map((candidate: { id: string }) => [candidate.id, 1 / input.candidates.length])),
    } } });
  } });
  const expedition = createExpedition({ controller: createTypeSafeController({ fetch: (url, init) => handler(new Request(new URL(url, 'http://localhost'), init)) }) });
  const settle = () => new Promise<void>(resolve => {
    const unsubscribe = expedition.onDecisionSettled(() => { unsubscribe(); resolve(); });
  });
  expedition.dispatch({ type: 'start' });
  await settle();
  if (mixed) {
    expect(expedition.getSnapshot()).toMatchObject({ decisionFailure: 'unavailable', inferenceAttempts: 2 });
    fail = false;
    expedition.dispatch({ type: 'set-instructions', instructions: 'Prioritize water evidence.' });
    expedition.dispatch({ type: 'retry-decision' });
    await settle();
    fail = true;
    expedition.advanceWallTime(5_000);
    await settle();
    expedition.dispatch({ type: 'continue-with-baseline' });
    expedition.advanceWallTime(90_000);
    expedition.dispatch({ type: 'introduce-storm' });
    expedition.advanceWallTime(100_000);
  } else expedition.advanceWallTime(1_000);
  expedition.dispatch({ type: 'stop' });
  const [record] = expedition.getCompletedRecords();
  const json = exportExpeditionRecord(record!);
  const callsBeforeOpening = calls;
  const reopened = importExpeditionRecord(json);
  expect(reopened).toEqual(JSON.parse(JSON.stringify(record)));
  expect(json).not.toContain('record-test-key-never-export');
  expect(json).not.toContain('private provider failure');
  expect(reopened.results.inferenceAttempts).toBe(mixed ? 5 : 1);
  expect(reopened.results.inferenceLatencyMs).toBeGreaterThan(0);
  expect(reopened.results.controllerHistory.map(entry => entry.controller)).toEqual(mixed ? ['typesafe', 'baseline'] : ['typesafe']);
  expect(reopened.decisions.find(decision => decision.status === 'applied' && decision.controller === 'typesafe')!.probabilities).toBeDefined();
  expect(reopened.decisions.filter(decision => decision.controller === 'baseline').every(decision => !decision.probabilities)).toBe(true);
  if (mixed) {
    expect(reopened.events.some(event => event.type === 'controller-changed')).toBe(true);
    expect(reopened.events.some(event => event.type === 'storm-detected')).toBe(true);
    expect(reopened.decisions.some(decision => decision.input.decisionBoundary?.triggers.includes('retry'))).toBe(true);
  }
  expect(calls).toBe(callsBeforeOpening);
});

test('record imports reject unknown fields, malformed histories, nonfinite values and fabricated baseline probabilities', async () => {
  const { exportExpeditionRecord, importExpeditionRecord } = await import('../src/records/contract');
  const expedition = createExpedition();
  expedition.dispatch({ type: 'start' });
  expedition.advanceWallTime(1_000);
  expedition.dispatch({ type: 'stop' });
  const json = exportExpeditionRecord(expedition.getCompletedRecords()[0]!);
  const mutations = [
    (record: any) => { record.results.controllerHistory = []; },
    (record: any) => { record.decisions = []; },
    (record: any) => { record.events = record.events.filter((event: any) => ['created', 'started', 'ended'].includes(event.type)); },
    (record: any) => { record.events = record.events.filter((event: any) => !event.type.startsWith('action-')); },
    (record: any) => { record.decisions[0].input.instructions = 'Invented history'; },
    (record: any) => { record.results.controller = 'typesafe'; record.results.controllerHistory[0].controller = 'typesafe'; },
    (record: any) => { record.version = 99; },
    (record: any) => { record.startingConditions.apiKey = 'not-a-real-secret'; },
    (record: any) => { record.decisions[0].input.credentials = 'not-a-real-secret'; },
    (record: any) => { record.events[0].type = 'execute-script'; },
    (record: any) => { record.results.status = 'running'; },
    (record: any) => { record.results.scienceScore = 999; },
    (record: any) => { record.results.inferenceAttempts = 1; },
    (record: any) => { record.decisions[0].probabilities = { 'wait:5000': 1 }; },
    (record: any) => { record.decisions[0].selectedCandidateId = 'invented'; },
    (record: any) => { record.results.memory[0].position.x = null; },
    (record: any) => { record.events.pop(); },
  ];
  for (const mutate of mutations) {
    const record = JSON.parse(json);
    mutate(record);
    expect(() => importExpeditionRecord(JSON.stringify(record))).toThrow('Invalid expedition record');
  }
  expect(() => importExpeditionRecord(json.replace('"energyUsed":0.5', '"energyUsed":1e999'))).toThrow('Invalid expedition record');
  expect(() => importExpeditionRecord('{broken')).toThrow('Invalid JSON');
  expect(expedition.getCompletedRecords()).toHaveLength(1);
});

test('a second expedition stopped before cancelled inference settles cannot replace the first completed record', async () => {
  const { createTypeSafeController } = await import('../src/controllers/typesafe');
  const { exportExpeditionRecord } = await import('../src/records/contract');
  const expedition = createExpedition({ controller: createTypeSafeController({ fetch: (_url, init) => new Promise((_resolve, reject) => {
    init!.signal!.addEventListener('abort', () => reject(new Error('cancelled')), { once: true });
  }) }) });
  expedition.dispatch({ type: 'start' });
  expedition.dispatch({ type: 'stop' });
  expedition.dispatch({ type: 'reset' });
  expedition.dispatch({ type: 'start' });
  expedition.dispatch({ type: 'stop' });
  await Bun.sleep(0);
  const records = expedition.getCompletedRecords();
  expect(records).toHaveLength(2);
  expect(records.map(record => record.results.inferenceAttempts).sort()).toEqual([0, 1]);
  expect(records.every(record => !record.results.decisionPending)).toBe(true);
  for (const record of records) expect(() => exportExpeditionRecord(record)).not.toThrow();
});

test('mission instructions outside the shared contract are rejected before they can make an expedition unsavable', async () => {
  const { exportExpeditionRecord, importExpeditionRecord } = await import('../src/records/contract');
  const expedition = createExpedition();
  expedition.dispatch({ type: 'set-instructions', instructions: 'Keep the accepted mission.' });
  expect(() => expedition.dispatch({ type: 'set-instructions', instructions: 'x'.repeat(20_001) })).toThrow('20,000 characters or fewer');
  expect(expedition.getSnapshot().instructions).toBe('Keep the accepted mission.');
  expedition.dispatch({ type: 'start' });
  expedition.dispatch({ type: 'stop' });
  const reopened = importExpeditionRecord(exportExpeditionRecord(expedition.getCompletedRecords()[0]!));
  expect(reopened.results.instructions).toBe('Keep the accepted mission.');
});
