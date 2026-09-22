import { expect, test } from 'bun:test';
import { createDecisionHandler } from '../server/decisions';
import { createTypeSafeController } from '../src/controllers/typesafe';
import { createReplay } from '../src/simulation/expedition';
import { createFirstPlayableExpedition as createExpedition } from './fixtures/first-playable-session';
import { exportExpeditionRecord, importExpeditionRecord } from '../src/records/contract';
import type { ControllerInput } from '../src/simulation/types';

const choice = (input: ControllerInput) => ({ type: 'choice', choice: 'wait:5000', confidence: 0,
  probabilities: Object.fromEntries(input.candidates.map(candidate => [candidate.id, 1 / input.candidates.length])) });
const settled = (session: ReturnType<typeof createExpedition>) => new Promise<void>(resolve => {
  const unsubscribe = session.onDecisionSettled(() => { unsubscribe(); resolve(); });
});

test('a Jev choice retains confirmed outbound usage, identities and token-derived cost through the real SDK', async () => {
  let outbound = 0;
  const submissions: any[] = [];
  const handler = createDecisionHandler({ apiKey: 'usage-test-key', fetch: async (_url, init) => {
    outbound++;
    return Response.json({ model: 'jev-1.13.0', usage: { input_tokens: 1000, output_tokens: 40 },
      answers: { action: choice(JSON.parse(init!.body as string).state) } },
    { headers: { 'x-typesafe-request-id': 'req-usage-1' } });
  } });
  const controller = createTypeSafeController({ fetch: (url, init) => {
    submissions.push(JSON.parse(init.body as string));
    return handler(new Request(new URL(url, 'http://localhost'), init));
  } });
  const session = createExpedition({ controller });
  session.dispatch({ type: 'start' });
  await settled(session);
  expect(outbound).toBe(1);
  expect(session.getSnapshot().usage).toMatchObject({ controllerDecisions: 1, jevDecisions: 1, localSubmissions: 1,
    providerAttempts: 1, retries: 0, unconfirmedSubmissions: 0, inputTokens: 1000, outputTokens: 40,
    estimatedCost: 0.000042, knownEstimatedCost: 0.000042 });
  const decision = session.getDecisions()[0]!;
  const attempt = decision.accounting!.attempts[0]!;
  expect(attempt.submission.identity).toEqual(submissions[0].identity);
  expect(attempt.evidence).toMatchObject({ identity: attempt.submission.identity, dispatch: 'dispatched',
    requestedModel: 'jev-latest', resolvedModel: 'jev-1.13.0', providerRequestId: 'req-usage-1',
    inputTokens: 1000, outputTokens: 40, promptVersion: 'rover-action-v3',
    pricing: { model: 'jev-1.13.0', inputPerMillion: 0.042, outputPerMillion: 0, currency: 'USD',
      source: 'https://docs.typesafe.ai/models' } });
  session.dispatch({ type: 'stop' });
  const record = session.getCompletedRecords()[0]!;
  expect(record.id).toBe(attempt.submission.identity.expeditionId);
  const json = exportExpeditionRecord(record);
  const reopened = importExpeditionRecord(json);
  expect(reopened.version).toBe(8);
  expect(reopened).toEqual(JSON.parse(json));
  const replay = createReplay(reopened);
  replay.dispatch({ type: 'start' });
  replay.advanceWallTime(1000);
  expect(replay.getSnapshot()).toEqual(record.results);
  expect(replay.getDecisions()).toEqual(record.decisions);
  expect(outbound).toBe(1);
  expect(exportExpeditionRecord(reopened)).toBe(json);
  for (const mutate of [
    (value: any) => { value.results.usage.providerAttempts = 0; },
    (value: any) => { value.decisions[0].accounting.attempts[0].evidence.inputTokens = 5000; },
    (value: any) => { value.events.find((event: any) => event.type === 'inference-accounted').evidence.identity.attemptId = crypto.randomUUID(); },
    (value: any) => { value.decisions[0].accounting.attempts[0].evidence.credentials = 'must-not-import'; },
    (value: any) => { value.events.splice(4, 0, value.events.find((event: any) => event.type === 'inference-accounted')); },
    (value: any) => { value.decisions[0].accounting.attempts[0].submission.submittedAtMs = 1e100; value.events.find((event: any) => event.type === 'inference-attempt').submission.submittedAtMs = 1e100; },
  ]) {
    const invalid = JSON.parse(json);
    mutate(invalid);
    expect(() => importExpeditionRecord(JSON.stringify(invalid))).toThrow('Invalid expedition record');
  }
  // A historical basis can differ from today's table. Inspection and replay
  // use this recorded rate without silently replacing it.
  const historical = JSON.parse(json);
  historical.decisions[0].accounting.attempts[0].evidence.pricing.inputPerMillion = 0.1;
  historical.events.find((event: any) => event.type === 'inference-accounted').evidence.pricing.inputPerMillion = 0.1;
  historical.results.usage.estimatedCost = 0.0001;
  historical.results.usage.knownEstimatedCost = 0.0001;
  const historicalRecord = importExpeditionRecord(JSON.stringify(historical));
  const historicalReplay = createReplay(historicalRecord);
  historicalReplay.dispatch({ type: 'start' });
  expect(historicalReplay.getSnapshot().usage!.estimatedCost).toBe(0.0001);
});

test('a version 1 expedition keeps its historical local counter and replays without inventing usage', async () => {
  // Captured with the real session/backend/SDK at 9713ae8, using a scripted provider.
  const json = await Bun.file(new URL('./fixtures/legacy-usage-v1.json', import.meta.url)).text();
  const record = importExpeditionRecord(json);
  expect(record.version).toBe(1);
  expect(record.results.inferenceAttempts).toBe(1);
  expect(record.results.usage).toBeUndefined();
  expect(record.decisions[0]!.accounting).toBeUndefined();
  const replay = createReplay(record);
  replay.dispatch({ type: 'start' });
  replay.advanceWallTime(1000);
  expect(replay.getSnapshot()).toEqual(record.results);
  expect(exportExpeditionRecord(record)).toBe(json);
});

test.each(['configuration', 'invalid-request'] as const)('a confirmed %s rejection contributes no provider attempts', async failure => {
  let outbound = 0;
  const handler = createDecisionHandler({ apiKey: failure === 'configuration' ? undefined : 'test-key',
    fetch: async () => { outbound++; throw new Error('Must not dispatch'); } });
  const session = createExpedition({ controller: createTypeSafeController({ fetch: (url, init) => {
    const body = JSON.parse(init.body as string);
    if (failure === 'invalid-request') body.input.world = 'hidden truth';
    return handler(new Request(new URL(url, 'http://localhost'), { ...init, body: JSON.stringify(body) }));
  } }) });
  session.dispatch({ type: 'start' });
  await settled(session);
  expect(outbound).toBe(0);
  expect(session.getSnapshot()).toMatchObject({ decisionFailure: failure, elapsedMs: 0, usage: {
    controllerDecisions: 1, localSubmissions: 1, providerAttempts: 0, retries: 0,
    unconfirmedSubmissions: 0, estimatedCost: 0, inputTokens: 0, outputTokens: 0,
  } });
  expect(session.getDecisions()[0]!.accounting!.attempts[0]!.evidence!.dispatch).toBe('not-dispatched');
  session.dispatch({ type: 'stop' });
  const record = importExpeditionRecord(exportExpeditionRecord(session.getCompletedRecords()[0]!));
  const replay = createReplay(record);
  replay.dispatch({ type: 'start' });
  expect(replay.getSnapshot()).toEqual(record.results);
});

test.each([
  { model: 'jev-next', usage: { input_tokens: 1000, output_tokens: 40 }, inputTokens: 1000, outputTokens: 40, resolvedModel: 'jev-next' },
  { model: 'jev-latest', usage: { input_tokens: 1000, output_tokens: 40 }, inputTokens: 1000, outputTokens: 40, resolvedModel: null },
  { model: 'jev-1.13.0', usage: { input_tokens: 1000 }, inputTokens: 1000, outputTokens: null, resolvedModel: 'jev-1.13.0' },
  { model: undefined, usage: undefined, inputTokens: null, outputTokens: null, resolvedModel: null },
])('missing metadata or unknown pricing stays incomplete: %j', async data => {
  const handler = createDecisionHandler({ apiKey: 'test-key', fetch: async (_url, init) => Response.json({
    model: data.model, usage: data.usage, answers: { action: choice(JSON.parse(init!.body as string).state) },
  }) });
  const session = createExpedition({ controller: createTypeSafeController({
    fetch: (url, init) => handler(new Request(new URL(url, 'http://localhost'), init)),
  }) });
  session.dispatch({ type: 'start' });
  await settled(session);
  expect(session.getSnapshot()).toMatchObject({ currentAction: { kind: 'wait' }, usage: {
    providerAttempts: 1, inputTokens: data.inputTokens, outputTokens: data.outputTokens,
    estimatedCost: null, knownEstimatedCost: 0,
  } });
  expect(session.getDecisions()[0]!.accounting!.attempts[0]!.evidence!.resolvedModel).toBe(data.resolvedModel);
  session.dispatch({ type: 'stop' });
  const record = importExpeditionRecord(exportExpeditionRecord(session.getCompletedRecords()[0]!));
  expect(record.results.usage!.estimatedCost).toBeNull();
});

test('decision wait and attempt timing are independent of expedition time and are not added together', async () => {
  let now = 100_000;
  const clock = { now: () => now, after: () => () => {} };
  let release!: () => void;
  const handler = createDecisionHandler({ apiKey: 'test-key', clock, fetch: (_url, init) => new Promise(resolve => {
    release = () => resolve(Response.json({ model: 'jev-1.13.0', usage: { input_tokens: 1000, output_tokens: 40 },
      answers: { action: choice(JSON.parse(init!.body as string).state) } }));
  }) });
  const session = createExpedition({ wallNow: clock.now, controller: createTypeSafeController({ clock, fetch: async (url, init) => {
    now += 20;
    const result = await handler(new Request(new URL(url, 'http://localhost'), init));
    now += 30;
    return result;
  } }) });
  session.dispatch({ type: 'start' });
  await Bun.sleep(0);
  now += 600;
  session.advanceWallTime(20_000);
  expect(session.getSnapshot()).toMatchObject({ elapsedMs: 0, battery: 100, decisionPending: true });
  const firstSettled = settled(session);
  release();
  await firstSettled;
  expect(session.getDecisions()[0]).toMatchObject({ latencyMs: 650, accounting: { attempts: [{ evidence: { startedAtMs: 100_020, latencyMs: 600 } }] } });
  expect(session.getSnapshot()).toMatchObject({ elapsedMs: 0, inferenceLatencyMs: 650 });
  session.advanceWallTime(5000);
  await Bun.sleep(0);
  now += 1200;
  const secondSettled = settled(session);
  release();
  await secondSettled;
  expect(session.getSnapshot()).toMatchObject({ elapsedMs: 5000, inferenceLatencyMs: 1900, usage: {
    controllerDecisions: 2, providerAttempts: 2, inputTokens: 2000, outputTokens: 80, estimatedCost: 0.000084,
  } });
  expect(session.getDecisions()[1]!.latencyMs).toBe(1250);
  session.dispatch({ type: 'stop' });
  expect(importExpeditionRecord(exportExpeditionRecord(session.getCompletedRecords()[0]!)).results.inferenceLatencyMs).toBe(1900);
});

test('explicit continuation has its own confirmed outbound identity and leaves acknowledged usage incomplete', async () => {
  let outbound = 0;
  const handler = createDecisionHandler({ apiKey: 'test-key', fetch: async (_url, init) => {
    if (++outbound === 1) return new Response('private provider error', { status: 503 });
    return Response.json({ model: 'jev-1.13.0', usage: { input_tokens: 1000, output_tokens: 40 },
      answers: { action: choice(JSON.parse(init!.body as string).state) } });
  } });
  const session = createExpedition({ controller: createTypeSafeController({
    fetch: (url, init) => handler(new Request(new URL(url, 'http://localhost'), init)),
  }) });
  session.dispatch({ type: 'start' });
  await settled(session);
  expect(outbound).toBe(1);
  session.dispatch({ type: 'acknowledge-usage', attemptIds: session.getSnapshot().usagePause!.attemptIds });
  await settled(session);
  expect(outbound).toBe(2);
  expect(session.getSnapshot().usage).toMatchObject({ controllerDecisions: 2, localSubmissions: 2, providerAttempts: 2,
    retries: 0, unconfirmedSubmissions: 0, estimatedCost: null, knownEstimatedCost: 0.000042, inputTokens: null, outputTokens: null });
  const attempts = session.getDecisions().flatMap(decision => decision.accounting!.attempts);
  expect(attempts.map(item => item.submission.retryIndex)).toEqual([0, 0]);
  expect(new Set(attempts.map(item => item.submission.identity.attemptId)).size).toBe(2);
  expect(attempts[0]!.submission.identity.decisionId).not.toBe(attempts[1]!.submission.identity.decisionId);
  session.dispatch({ type: 'stop' });
  const json = exportExpeditionRecord(session.getCompletedRecords()[0]!);
  expect(json).not.toContain('private provider error');
  const record = importExpeditionRecord(json);
  const replay = createReplay(record);
  replay.dispatch({ type: 'start' });
  expect(replay.getSnapshot()).toEqual(record.results);
});

test('a backend response for a different attempt cannot supply accounting or execute a choice', async () => {
  const handler = createDecisionHandler({ apiKey: 'test-key', fetch: async (_url, init) => Response.json({
    model: 'jev-1.13.0', usage: { input_tokens: 1000, output_tokens: 40 },
    answers: { action: choice(JSON.parse(init!.body as string).state) },
  }) });
  const session = createExpedition({ controller: createTypeSafeController({ fetch: async (url, init) => {
    const body = await (await handler(new Request(new URL(url, 'http://localhost'), init))).json();
    body.evidence.identity.attemptId = crypto.randomUUID();
    return Response.json(body);
  } }) });
  session.dispatch({ type: 'start' });
  await settled(session);
  expect(session.getSnapshot()).toMatchObject({ currentAction: null, decisionFailure: 'invalid-output', usage: {
    localSubmissions: 1, providerAttempts: 0, unconfirmedSubmissions: 1, estimatedCost: null,
  } });
});

test('successful metadata cannot echo a server credential or carry arbitrary provider fields', async () => {
  const handler = createDecisionHandler({ apiKey: '  secret-provider-key  ', fetch: async (_url, init) => Response.json({
    model: 'secret-provider-key', usage: { input_tokens: 1000, output_tokens: 40, credential: 'secret-provider-key' },
    providerDetail: 'secret-provider-key', answers: { action: choice(JSON.parse(init!.body as string).state) },
  }, { headers: { 'x-typesafe-request-id': 'req-secret-provider-key' } }) });
  const responses: string[] = [];
  const session = createExpedition({ controller: createTypeSafeController({ fetch: async (url, init) => {
    const response = await handler(new Request(new URL(url, 'http://localhost'), init));
    responses.push(await response.clone().text());
    return response;
  } }) });
  session.dispatch({ type: 'start' });
  await settled(session);
  expect(responses.join()).not.toContain('secret-provider-key');
  expect(session.getDecisions()[0]!.accounting!.attempts[0]!.evidence).toMatchObject({ resolvedModel: null, providerRequestId: null, inputTokens: 1000 });
  session.dispatch({ type: 'stop' });
  expect(exportExpeditionRecord(session.getCompletedRecords()[0]!)).not.toContain('secret-provider-key');
});
