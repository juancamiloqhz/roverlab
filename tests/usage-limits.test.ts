import { expect, test } from 'bun:test';
import { createDecisionHandler } from '../server/decisions';
import { createTypeSafeController } from '../src/controllers/typesafe';
import { exportExpeditionRecord, importExpeditionRecord } from '../src/records/contract';
import { createExpedition, createReplay } from '../src/simulation/expedition';
import type { ControllerInput } from '../src/simulation/types';

const response = (input: ControllerInput, status = 200) => Response.json({
  model: 'jev-1.13.0', usage: { input_tokens: 1000, output_tokens: 40 },
  answers: { action: { type: 'choice', choice: 'wait:5000', confidence: 0,
    probabilities: Object.fromEntries(input.candidates.map(candidate => [candidate.id, 1 / input.candidates.length])) } },
}, { status });
const settled = (session: ReturnType<typeof createExpedition>) => new Promise<void>(resolve => {
  const unsubscribe = session.onDecisionSettled(() => { unsubscribe(); resolve(); });
});

test('a retry consumes the final provider slot and raising the limit preserves consumed usage', async () => {
  let outbound = 0;
  const handler = createDecisionHandler({ apiKey: 'scripted-key', fetch: async (_url, init) =>
    response(JSON.parse(init!.body as string).state, ++outbound === 1 ? 503 : 200) });
  const session = createExpedition({ controller: createTypeSafeController({
    fetch: (url, init) => handler(new Request(new URL(url, 'http://localhost'), init)),
  }) });
  expect(session.getSnapshot().inferenceLimits).toEqual({ providerAttempts: 250, estimatedCost: 0.1 });
  session.dispatch({ type: 'set-inference-limits', limits: { providerAttempts: 2, estimatedCost: 0.1 } });
  session.dispatch({ type: 'start' });
  await settled(session);
  expect(outbound).toBe(2);
  expect(session.getSnapshot()).toMatchObject({ status: 'paused', decisionFailure: null,
    usagePause: { reasons: ['attempt-limit'] }, usage: { providerAttempts: 2, retries: 1 } });
  const frozen = session.getSnapshot();
  session.advanceWallTime(20_000);
  session.dispatch({ type: 'resume' });
  session.dispatch({ type: 'retry-decision' });
  expect(session.getSnapshot()).toEqual(frozen);
  session.dispatch({ type: 'set-inference-limits', limits: { providerAttempts: 3, estimatedCost: 0.1 } });
  session.dispatch({ type: 'continue-inference' });
  expect(session.getSnapshot()).toMatchObject({ status: 'running', usagePause: null, usage: { providerAttempts: 2 } });
  session.advanceWallTime(5_000);
  await settled(session);
  expect(outbound).toBe(3);
  expect(session.getSnapshot().usagePause?.reasons).toEqual(['attempt-limit']);
});

test('uncertainty blocks retries, acknowledgements name attempts, and newly unknown usage pauses again', async () => {
  let outbound = 0;
  const handler = createDecisionHandler({ apiKey: 'scripted-key', fetch: async () => {
    outbound++;
    return new Response('Service unavailable', { status: 503 });
  } });
  const session = createExpedition({ controller: createTypeSafeController({
    fetch: (url, init) => handler(new Request(new URL(url, 'http://localhost'), init)),
  }) });
  session.dispatch({ type: 'set-inference-limits', limits: { providerAttempts: 1, estimatedCost: 0.1 } });
  session.dispatch({ type: 'start' });
  await settled(session);
  const first = session.getDecisions()[0]!.accounting!.attempts[0]!.submission.identity.attemptId;
  expect(outbound).toBe(1);
  expect(session.getSnapshot().usagePause).toEqual({ reasons: ['uncertainty', 'attempt-limit'], attemptIds: [first] });
  session.dispatch({ type: 'acknowledge-usage', attemptIds: [crypto.randomUUID()] });
  expect(session.getSnapshot().acknowledgedAttemptIds).toEqual([]);
  session.dispatch({ type: 'acknowledge-usage', attemptIds: [first] });
  expect(session.getSnapshot()).toMatchObject({ status: 'paused', usagePause: { reasons: ['attempt-limit'] },
    acknowledgedAttemptIds: [first], usage: { estimatedCost: null, providerAttempts: 1 } });
  session.dispatch({ type: 'set-inference-limits', limits: { providerAttempts: 2, estimatedCost: 0.1 } });
  session.dispatch({ type: 'continue-inference' });
  await settled(session);
  const second = session.getDecisions()[1]!.accounting!.attempts[0]!.submission.identity.attemptId;
  expect(session.getSnapshot().usagePause).toEqual({ reasons: ['uncertainty', 'attempt-limit'], attemptIds: [second] });
  expect(outbound).toBe(2);
  session.dispatch({ type: 'continue-with-baseline' });
  expect(session.getSnapshot()).toMatchObject({ status: 'running', controller: 'baseline', usagePause: null,
    usage: { providerAttempts: 2, estimatedCost: null }, controllerHistory: [{ controller: 'typesafe' }, { controller: 'baseline' }] });
  session.advanceWallTime(1000);
  expect(session.getSnapshot().elapsedMs).toBe(1000);
});

function roundTrip(session: ReturnType<typeof createExpedition>) {
  session.dispatch({ type: 'stop' });
  const record = session.getCompletedRecords()[0]!;
  const json = exportExpeditionRecord(record);
  const imported = importExpeditionRecord(json);
  const replay = createReplay(imported);
  replay.dispatch({ type: 'start' });
  replay.advanceWallTime(300_000);
  expect(replay.getSnapshot()).toEqual(record.results);
  expect(replay.getDecisions()).toEqual(record.decisions);
  expect(exportExpeditionRecord(imported)).toBe(json);
  return imported;
}

test('a completed response may cross the estimated-cost stopping rule and its history replays without inference', async () => {
  let outbound = 0;
  const handler = createDecisionHandler({ apiKey: 'scripted-key', fetch: async (_url, init) => {
    outbound++;
    return response(JSON.parse(init!.body as string).state);
  } });
  const session = createExpedition({ controller: createTypeSafeController({
    fetch: (url, init) => handler(new Request(new URL(url, 'http://localhost'), init)),
  }) });
  session.dispatch({ type: 'set-inference-limits', limits: { providerAttempts: 250, estimatedCost: 0.00004 } });
  session.dispatch({ type: 'start' });
  await settled(session);
  expect(session.getSnapshot()).toMatchObject({ status: 'paused', usagePause: { reasons: ['cost-limit'] },
    usage: { estimatedCost: 0.000042 }, currentAction: { kind: 'wait' } });
  session.advanceWallTime(60_000);
  expect(session.getSnapshot().elapsedMs).toBe(0);
  session.dispatch({ type: 'set-inference-limits', limits: { providerAttempts: 250, estimatedCost: 0.00008 } });
  session.dispatch({ type: 'continue-inference' });
  session.advanceWallTime(5_000);
  await settled(session);
  expect(session.getSnapshot()).toMatchObject({ usagePause: { reasons: ['cost-limit'] }, usage: { estimatedCost: 0.000084 } });
  session.dispatch({ type: 'continue-with-baseline' });
  session.advanceWallTime(1000);
  const record = roundTrip(session);
  expect(record.version).toBe(7);
  expect(record.events.filter(event => event.type === 'inference-limits-changed')).toHaveLength(2);
  expect(record.startingConditions.inferenceLimits).toEqual({ providerAttempts: 250, estimatedCost: 0.1 });
  expect(outbound).toBe(2);
});

test.each(['providerAttempts', 'estimatedCost'] as const)('a zero %s allowance blocks dispatch before any submission', field => {
  let submissions = 0;
  const session = createExpedition({ controller: createTypeSafeController({ fetch: async () => {
    submissions++;
    throw new Error('Must not dispatch');
  } }) });
  session.dispatch({ type: 'set-inference-limits', limits: { providerAttempts: 250, estimatedCost: 0.1, [field]: 0 } });
  session.dispatch({ type: 'start' });
  expect(session.getSnapshot()).toMatchObject({ status: 'paused', inferenceAttempts: 0, decisionPending: false });
  expect(session.getDecisions()).toEqual([]);
  expect(submissions).toBe(0);
  roundTrip(session);
});

test('acknowledged unconfirmed reservations stay unknown, and late evidence is checked before another retry', async () => {
  let outbound = 0;
  let release!: () => void;
  const handler = createDecisionHandler({ apiKey: 'scripted-key', fetch: async (_url, init) => {
    const input = JSON.parse(init!.body as string).state;
    if (++outbound === 2) return new Promise<Response>(resolve => { release = () => resolve(response(input, 503)); });
    return response(input);
  } });
  let submissions = 0;
  const session = createExpedition({ controller: createTypeSafeController({ fetch: async (url, init) => {
    const loseResponse = url === '/api/decision' && ++submissions === 1;
    const result = await handler(new Request(new URL(url, 'http://localhost'), init));
    if (loseResponse) throw new Error('Local response lost');
    return result;
  } }) });
  session.dispatch({ type: 'set-inference-limits', limits: { providerAttempts: 1, estimatedCost: 0.00008 } });
  session.dispatch({ type: 'start' });
  await settled(session);
  expect(session.getSnapshot()).toMatchObject({ usagePause: { reasons: ['uncertainty', 'attempt-limit'] },
    usage: { providerAttempts: 0, unconfirmedSubmissions: 1, estimatedCost: null } });
  const affected = session.getSnapshot().usagePause!.attemptIds;
  session.dispatch({ type: 'acknowledge-usage', attemptIds: affected });
  await Bun.sleep(0);
  expect(session.getSnapshot()).toMatchObject({ decisionPending: true, usage: { unconfirmedSubmissions: 2, estimatedCost: null } });
  await session.refreshInferenceUsage();
  // The original unknown submission now counts as a confirmed attempt. The
  // outstanding second request cannot release its reservation or issue a retry.
  expect(session.getSnapshot().usage!.providerAttempts).toBe(2);
  const done = settled(session);
  release();
  await done;
  expect(outbound).toBe(2);
  expect(session.getSnapshot()).toMatchObject({ status: 'paused', usagePause: { reasons: ['attempt-limit', 'cost-limit'] },
    usage: { estimatedCost: 0.000084, unconfirmedSubmissions: 0 } });
  roundTrip(session);
});

test('limits and acknowledgements reject invalid changes and reset to fresh allowances', async () => {
  const handler = createDecisionHandler({ apiKey: 'scripted-key', fetch: async () => new Response('unavailable', { status: 503 }) });
  const session = createExpedition({ controller: createTypeSafeController({
    fetch: (url, init) => handler(new Request(new URL(url, 'http://localhost'), init)),
  }) });
  for (const limits of [{ providerAttempts: -1, estimatedCost: 0.1 }, { providerAttempts: 1.5, estimatedCost: 0.1 },
    { providerAttempts: 250, estimatedCost: Infinity }, { providerAttempts: 250, estimatedCost: -0.1 }]) {
    expect(() => session.dispatch({ type: 'set-inference-limits', limits })).toThrow();
  }
  session.dispatch({ type: 'start' });
  await settled(session);
  const affected = session.getSnapshot().usagePause!.attemptIds;
  session.dispatch({ type: 'acknowledge-usage', attemptIds: affected });
  await settled(session);
  const record = roundTrip(session);
  for (const mutate of [
    (value: typeof record) => { value.results.acknowledgedAttemptIds = []; },
    (value: typeof record) => { value.results.inferenceLimits!.providerAttempts = 999; },
    (value: typeof record) => { value.version = 3; },
    (value: typeof record) => {
      const event = value.events.find(event => event.type === 'usage-acknowledged')!;
      if (event.type === 'usage-acknowledged') event.attemptIds = [crypto.randomUUID()];
    },
  ]) {
    const invalid = structuredClone(record);
    mutate(invalid);
    expect(() => importExpeditionRecord(JSON.stringify(invalid))).toThrow('Invalid expedition record');
  }
  session.dispatch({ type: 'reset' });
  expect(session.getSnapshot()).toMatchObject({ inferenceLimits: { providerAttempts: 250, estimatedCost: 0.1 },
    acknowledgedAttemptIds: [], usagePause: null, inferenceAttempts: 0 });
});

test('version 3 replay preserves its original retry through unknown usage without adding limits', async () => {
  // Captured from 227df55 using its session, backend, and real SDK with a scripted provider.
  const json = await Bun.file(new URL('./fixtures/legacy-usage-v3.json', import.meta.url)).text();
  const record = importExpeditionRecord(json);
  expect(record.version).toBe(3);
  expect(record.results.usage).toMatchObject({ providerAttempts: 2, retries: 1, estimatedCost: null });
  const replay = createReplay(record);
  replay.dispatch({ type: 'start' });
  replay.advanceWallTime(1000);
  expect(replay.getSnapshot()).toEqual(record.results);
  expect(replay.getSnapshot().inferenceLimits).toBeUndefined();
  expect(exportExpeditionRecord(record)).toBe(json);
});

test('confirmed pre-dispatch rejections release provider slots without hiding local submissions', async () => {
  const handler = createDecisionHandler();
  const session = createExpedition({ controller: createTypeSafeController({
    fetch: (url, init) => handler(new Request(new URL(url, 'http://localhost'), init)),
  }) });
  session.dispatch({ type: 'set-inference-limits', limits: { providerAttempts: 1, estimatedCost: 0.1 } });
  session.dispatch({ type: 'start' });
  await settled(session);
  session.dispatch({ type: 'retry-decision' });
  await settled(session);
  expect(session.getSnapshot()).toMatchObject({ usagePause: null, decisionFailure: 'configuration', usage: {
    localSubmissions: 2, providerAttempts: 0, unconfirmedSubmissions: 0, estimatedCost: 0,
  } });
  roundTrip(session);
});

test('the default provider allowance permits accounted attempts beyond the legacy local-submission ceiling', async () => {
  let outbound = 0;
  const handler = createDecisionHandler({ apiKey: 'scripted-key', fetch: async (_url, init) => {
    outbound++;
    return response(JSON.parse(init!.body as string).state, 503);
  } });
  const session = createExpedition({ controller: createTypeSafeController({
    fetch: (url, init) => handler(new Request(new URL(url, 'http://localhost'), init)),
  }) });
  session.dispatch({ type: 'start' });
  await settled(session);
  for (let index = 0; index < 50; index++) {
    session.dispatch({ type: 'retry-decision' });
    await settled(session);
  }
  expect(outbound).toBe(102);
  expect(session.getSnapshot()).toMatchObject({ usagePause: null, decisionFailure: 'unavailable',
    inferenceLimits: { providerAttempts: 250 }, usage: { providerAttempts: 102, retries: 51 } });
  roundTrip(session);
});

test('baseline continuation after late evidence reaches a safe waypoint and preserves the Jev action attribution', async () => {
  let outbound = 0;
  const handler = createDecisionHandler({ apiKey: 'scripted-key', fetch: async (_url, init) => {
    outbound++;
    const input: ControllerInput = JSON.parse(init!.body as string).state;
    const body = await response(input).json();
    if (outbound === 2) body.answers.action.choice = input.candidates.find(candidate => candidate.kind === 'explore')!.id;
    return Response.json(body);
  } });
  let submissions = 0;
  const session = createExpedition({ scenario: { id: 'late-limit-corridor', name: 'Late limit corridor', width: 8, depth: 1,
    base: { x: 0, z: 0 }, sensorRange: 3, obstacles: [], roughTerrain: [], samples: [] },
  controller: createTypeSafeController({ fetch: async (url, init) => {
    const loseResponse = url === '/api/decision' && ++submissions === 1;
    const result = await handler(new Request(new URL(url, 'http://localhost'), init));
    if (loseResponse) throw new Error('Local response lost');
    return result;
  } }) });
  session.dispatch({ type: 'set-inference-limits', limits: { providerAttempts: 2, estimatedCost: 0.1 } });
  session.dispatch({ type: 'start' });
  await settled(session);
  session.dispatch({ type: 'acknowledge-usage', attemptIds: session.getSnapshot().usagePause!.attemptIds });
  await settled(session);
  session.advanceWallTime(1000);
  expect(session.getSnapshot().rover.position).toEqual({ x: 0.25, z: 0 });
  await session.refreshInferenceUsage();
  expect(session.getSnapshot().usagePause?.reasons).toEqual(['attempt-limit']);
  session.dispatch({ type: 'continue-with-baseline' });
  expect(session.getSnapshot()).toMatchObject({ status: 'running', controller: 'baseline', currentAction: { kind: 'explore' } });
  expect(session.getDecisions()).toHaveLength(2);
  session.advanceWallTime(3000);
  expect(session.getSnapshot().rover.position).toEqual({ x: 1, z: 0 });
  expect(session.getDecisions()[2]).toMatchObject({ controller: 'baseline', input: { atMs: 4000 }, action: { kind: 'explore' } });
  expect(session.getRecord().events.find(event => event.type === 'action-cancelled')).toMatchObject({ controller: 'typesafe', atMs: 4000 });
  roundTrip(session);
  expect(outbound).toBe(2);
});
