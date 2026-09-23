import { readProviderInput } from './fixtures/provider-input';
import { expect, test } from 'bun:test';
import { createDecisionHandler } from '../server/decisions';
import { createTypeSafeController } from '../src/controllers/typesafe';
import { exportExpeditionRecord, importExpeditionRecord } from '../src/records/contract';
import { createReplay } from '../src/simulation/expedition';
import { createFirstPlayableExpedition as createExpedition } from './fixtures/first-playable-session';
import type { ControllerInput } from '../src/simulation/types';

const success = (input: ControllerInput) => Response.json({ model: 'jev-1.13.0', usage: { input_tokens: 1000, output_tokens: 40 },
  answers: { action: { type: 'choice', choice: 'wait:5000', confidence: 0,
    probabilities: Object.fromEntries(input.candidates.map(candidate => [candidate.id, 1 / input.candidates.length])) } },
}, { headers: { 'x-typesafe-request-id': 'req-success' } });
const settled = (session: ReturnType<typeof createExpedition>) => new Promise<void>(resolve => {
  const unsubscribe = session.onDecisionSettled(() => { unsubscribe(); resolve(); });
});

test('provider failure metadata survives a retry without being confused with whether the choice applied', async () => {
  let outbound = 0;
  const handler = createDecisionHandler({ apiKey: 'failure-accounting-key', fetch: async (_url, init) => {
    if (++outbound === 1) return Response.json({ model: 'jev-1.13.0', usage: { input_tokens: 500, output_tokens: 20 },
      error: 'private provider details failure-accounting-key' }, { status: 503, headers: { 'x-typesafe-request-id': 'req-failure' } });
    return success(readProviderInput(JSON.parse(init!.body as string).state));
  } });
  const session = createExpedition({ controller: createTypeSafeController({
    fetch: (url, init) => handler(new Request(new URL(url, 'http://localhost'), init)),
  }) });
  session.dispatch({ type: 'start' });
  await settled(session);
  expect(outbound).toBe(2);
  expect(session.getSnapshot()).toMatchObject({ currentAction: { kind: 'wait' }, usage: {
    providerAttempts: 2, retries: 1, inputTokens: 1500, outputTokens: 60, estimatedCost: 0.000063,
  } });
  expect(session.getDecisions()[0]!.accounting!.attempts.map(item => item.evidence)).toMatchObject([
    { execution: 'provider-error', httpStatus: 503, providerRequestId: 'req-failure', inputTokens: 500 },
    { execution: 'response-received', httpStatus: 200, providerRequestId: 'req-success', inputTokens: 1000 },
  ]);
  expect(JSON.stringify(session.getRecord())).not.toContain('failure-accounting-key');
  expect(JSON.stringify(session.getRecord())).not.toContain('private provider details');
});

test('late accounting updates the stopped expedition after reset without executing its obsolete choice', async () => {
  let release!: () => void;
  const handler = createDecisionHandler({ apiKey: 'test-key', fetch: async (_url, init) => success(readProviderInput(JSON.parse(init!.body as string).state)) });
  const controller = createTypeSafeController({ fetch: async (url, init) => {
    const response = await handler(new Request(new URL(url, 'http://localhost'), init));
    return new Promise<Response>(resolve => { release = () => resolve(response); });
  } });
  const session = createExpedition({ controller });
  session.dispatch({ type: 'start' });
  await Bun.sleep(0);
  session.dispatch({ type: 'stop' });
  session.dispatch({ type: 'reset' });
  await Bun.sleep(0);
  const original = session.getCompletedRecords()[0]!;
  expect(original.results.usage).toMatchObject({ providerAttempts: 0, unconfirmedSubmissions: 1, estimatedCost: null });
  release();
  await Bun.sleep(0);
  expect(session.getSnapshot().usage).toMatchObject({ providerAttempts: 0, localSubmissions: 0, estimatedCost: 0 });
  const updated = session.getCompletedRecords()[0]!;
  expect(updated.id).toBe(original.id);
  expect(updated.decisions[0]!.status).toBe('discarded');
  expect(updated.results.usage).toMatchObject({ providerAttempts: 1, unconfirmedSubmissions: 0, inputTokens: 1000, estimatedCost: 0.000042 });
  expect(updated.events.filter(event => event.type === 'action-started')).toHaveLength(0);
  expect(original.results.usage!.estimatedCost).toBeNull();
  verifyReplay(updated);
});

test('a read-only reconciliation confirms lost local responses once, without retrying provider access', async () => {
  let outbound = 0;
  const handler = createDecisionHandler({ apiKey: 'test-key', fetch: async (_url, init) => {
    outbound++;
    return success(readProviderInput(JSON.parse(init!.body as string).state));
  } });
  const session = createExpedition({ controller: createTypeSafeController({ fetch: async (url, init) => {
    const response = await handler(new Request(new URL(url, 'http://localhost'), init));
    if (url === '/api/decision') throw new Error('Local response lost after provider completed');
    return response;
  } }) });
  session.dispatch({ type: 'start' });
  await settled(session);
  expect(session.getSnapshot().usage).toMatchObject({ providerAttempts: 0, unconfirmedSubmissions: 1, estimatedCost: null });
  session.dispatch({ type: 'stop' });
  session.dispatch({ type: 'reset' });
  await session.refreshInferenceUsage();
  expect(outbound).toBe(1);
  const record = session.getCompletedRecords()[0]!;
  expect(record.results.usage).toMatchObject({ providerAttempts: 1, retries: 0, unconfirmedSubmissions: 0,
    inputTokens: 1000, outputTokens: 40, estimatedCost: 0.000042 });
  expect(record.decisions[0]!.status).toBe('failed');
  expect(session.getSnapshot().usage!.localSubmissions).toBe(0);
  const before = JSON.stringify(record);
  await session.refreshInferenceUsage();
  expect(JSON.stringify(session.getCompletedRecords()[0])).toBe(before);
  expect(outbound).toBe(1);
  verifyReplay(record);
});

function verifyReplay(record: ReturnType<ReturnType<typeof createExpedition>['getCompletedRecords']>[number]) {
  const json = exportExpeditionRecord(record);
  const replay = createReplay(importExpeditionRecord(json));
  replay.dispatch({ type: 'start' });
  for (let index = 0; index < 10 && replay.getSnapshot().status !== 'ended'; index++) replay.advanceWallTime(300_000);
  expect(replay.getSnapshot().usage).toEqual(record.results.usage);
  expect(replay.getDecisions()).toEqual(record.decisions);
  expect(exportExpeditionRecord(record)).toBe(json);
}
function manualClock() {
  let time = 100_000;
  const timers = new Map<() => void, number>();
  return { now: () => time,
    after(ms: number, callback: () => void) { timers.set(callback, time + ms); return () => { timers.delete(callback); }; },
    advance(ms: number) { time += ms; for (const [callback, at] of timers) if (at <= time) { timers.delete(callback); callback(); } },
  };
}

test.each(['stop', 'deadline', 'instructions'] as const)('a provider result after %s upgrades only its original accounting', async reason => {
  const clock = manualClock();
  let release!: () => void;
  let outbound = 0;
  const handler = createDecisionHandler({ apiKey: 'test-key', clock, fetch: async (_url, init) => {
    outbound++;
    return new Promise<Response>(resolve => { release = () => resolve(success(readProviderInput(JSON.parse(init!.body as string).state))); });
  } });
  const session = createExpedition({ wallNow: clock.now, controller: createTypeSafeController({ clock,
    fetch: (url, init) => handler(new Request(new URL(url, 'http://localhost'), init)),
  }) });
  session.dispatch({ type: 'start' });
  await Bun.sleep(0);
  if (reason === 'deadline') clock.advance(5_000);
  else {
    clock.advance(200);
    if (reason === 'instructions') session.dispatch({ type: 'set-instructions', instructions: 'Conserve energy' });
    session.dispatch({ type: 'stop' });
    session.dispatch({ type: 'reset' });
  }
  await Bun.sleep(0);
  if (reason === 'deadline') { session.dispatch({ type: 'stop' }); session.dispatch({ type: 'reset' }); }
  await session.refreshInferenceUsage();
  const before = session.getCompletedRecords()[0]!;
  expect(before.results.usage).toMatchObject({ providerAttempts: 1, unconfirmedSubmissions: 0, estimatedCost: null });
  expect(before.decisions[0]!.accounting!.attempts[0]!.evidence).toMatchObject({
    execution: reason === 'deadline' ? 'deadline' : 'cancelled', inputTokens: null,
  });
  const latency = before.results.inferenceLatencyMs;
  clock.advance(200);
  release();
  await Bun.sleep(0);
  await session.refreshInferenceUsage();
  const after = session.getCompletedRecords()[0]!;
  expect(after.results.usage).toMatchObject({ providerAttempts: 1, inputTokens: 1000, estimatedCost: 0.000042 });
  expect(after.decisions[0]!.accounting!.attempts[0]!.evidence).toMatchObject({ execution: 'response-received', providerRequestId: 'req-success' });
  expect(after.results.inferenceLatencyMs).toBe(latency);
  expect(after.events.some(event => event.type === 'action-started')).toBe(false);
  expect(session.getSnapshot().usage!.localSubmissions).toBe(0);
  const serialized = JSON.stringify(after);
  await session.refreshInferenceUsage();
  expect(JSON.stringify(session.getCompletedRecords()[0])).toBe(serialized);
  expect(outbound).toBe(1);
  verifyReplay(after);
});

test.each(['choice', 'json', 'local-choice'] as const)('a malformed %s preserves whatever provider accounting was available', async malformed => {
  const handler = createDecisionHandler({ apiKey: 'test-key', fetch: async (_url, init) => {
    if (malformed === 'json') return new Response('{broken', { headers: { 'x-typesafe-request-id': 'req-malformed' } });
    const body = await success(readProviderInput(JSON.parse(init!.body as string).state)).json();
    if (malformed === 'choice') body.answers.action.choice = 'invented';
    return Response.json(body, { headers: { 'x-typesafe-request-id': 'req-malformed' } });
  } });
  const session = createExpedition({ controller: createTypeSafeController({ fetch: async (url, init) => {
    const response = await handler(new Request(new URL(url, 'http://localhost'), init));
    if (malformed !== 'local-choice' || url !== '/api/decision') return response;
    const body = await response.json();
    body.choice.choice = 'invented';
    return Response.json(body);
  } }) });
  session.dispatch({ type: 'start' });
  await settled(session);
  expect(session.getSnapshot()).toMatchObject({ status: 'paused', currentAction: null,
    usage: { providerAttempts: 1, retries: 0, unconfirmedSubmissions: 0, estimatedCost: malformed === 'json' ? null : 0.000042 } });
  expect(session.getDecisions()[0]!.accounting!.attempts[0]!.evidence).toMatchObject({
    execution: 'response-received', httpStatus: 200, providerRequestId: 'req-malformed',
  });
  session.dispatch({ type: 'stop' });
  verifyReplay(session.getCompletedRecords()[0]!);
});

test('transport failure and an unavailable ledger retain uncertainty without fabricating usage', async () => {
  let outbound = 0;
  const handler = createDecisionHandler({ apiKey: 'test-key', fetch: async () => { outbound++; throw new Error('connection lost'); } });
  const session = createExpedition({ controller: createTypeSafeController({ fetch: async (url, init) => {
    if (url.endsWith('/usage')) return Response.json({ evidence: null });
    return handler(new Request(new URL(url, 'http://localhost'), init));
  } }) });
  session.dispatch({ type: 'start' });
  await settled(session);
  expect(session.getSnapshot().usage).toMatchObject({ providerAttempts: 1, retries: 0, inputTokens: null, estimatedCost: null });
  expect(session.getDecisions()[0]!.accounting!.attempts.every(item => item.evidence!.execution === 'transport-error')).toBe(true);
  const before = session.getDecisions();
  await session.refreshInferenceUsage();
  expect(session.getDecisions()).toEqual(before);
  expect(outbound).toBe(1);
  session.dispatch({ type: 'stop' });
  verifyReplay(session.getCompletedRecords()[0]!);
});

test('duplicate request delivery is idempotent and missing lookup evidence cannot invent a free attempt', async () => {
  let outbound = 0;
  const handler = createDecisionHandler({ apiKey: 'test-key', fetch: async (_url, init) => { outbound++; return success(readProviderInput(JSON.parse(init!.body as string).state)); } });
  const session = createExpedition({ controller: createTypeSafeController({ fetch: async (url, init) => {
    const request = () => new Request(new URL(url, 'http://localhost'), init);
    const first = await handler(request());
    const duplicate = await handler(request());
    expect(await first.clone().json()).toEqual(await duplicate.json());
    return first;
  } }) });
  session.dispatch({ type: 'start' });
  await settled(session);
  await session.refreshInferenceUsage();
  expect(outbound).toBe(1);
  expect(session.getSnapshot().usage!.providerAttempts).toBe(1);
  const unknown = await handler(new Request('http://localhost/api/decision/usage', { method: 'POST',
    body: JSON.stringify({ identity: { expeditionId: crypto.randomUUID(), decisionId: 1, attemptId: crypto.randomUUID() } }) }));
  expect(await unknown.json()).toEqual({ evidence: null });
});


test('supported version 2 records retain their original evidence and replay without execution-status inventions', async () => {
  // Captured from cb15524 through its real session/backend/SDK and a scripted provider.
  const source = await Bun.file(new URL('./fixtures/legacy-usage-v2.json', import.meta.url)).text();
  const record = importExpeditionRecord(source);
  expect(record.version).toBe(2);
  expect(record.decisions[0]!.accounting!.attempts[0]!.evidence!.execution).toBeUndefined();
  expect(record.results.usage!.estimatedCost).toBe(0.000042);
  verifyReplay(record);
  expect(exportExpeditionRecord(record)).toBe(source);
});

test('a lost local request stays unconfirmed and refresh has its own bounded wait', async () => {
  const clock = manualClock();
  let reads = 0;
  let submissions = 0;
  const session = createExpedition({ controller: createTypeSafeController({ clock, fetch: async url => {
    if (url === '/api/decision') { submissions++; throw new Error('Local connection lost before dispatch could be confirmed'); }
    reads++;
    // A broken transport may ignore AbortSignal. The lookup still must finish.
    return new Promise<Response>(() => {});
  } }) });
  session.dispatch({ type: 'start' });
  await settled(session);
  const snapshot = session.getSnapshot();
  expect(snapshot.usage).toMatchObject({ providerAttempts: 0, unconfirmedSubmissions: 1, inputTokens: null, estimatedCost: null });
  let done = false;
  const first = session.refreshInferenceUsage().then(() => { done = true; });
  const duplicate = session.refreshInferenceUsage();
  clock.advance(4_999);
  await Bun.sleep(0);
  expect(done).toBe(false);
  clock.advance(1);
  await first;
  await duplicate;
  expect(reads).toBe(1);
  expect(submissions).toBe(1);
  expect(session.getSnapshot()).toEqual(snapshot);
  session.dispatch({ type: 'stop' });
  verifyReplay(session.getCompletedRecords()[0]!);
});

test('a stalled response body preserves headers at deadline without inventing tokens', async () => {
  const clock = manualClock();
  const handler = createDecisionHandler({ apiKey: 'test-key', clock, fetch: async () => new Response(new ReadableStream(), {
    headers: { 'x-typesafe-request-id': 'req-stalled' },
  }) });
  const session = createExpedition({ wallNow: clock.now, controller: createTypeSafeController({ clock,
    fetch: (url, init) => handler(new Request(new URL(url, 'http://localhost'), init)),
  }) });
  session.dispatch({ type: 'start' });
  await Bun.sleep(0);
  clock.advance(5_000);
  await Bun.sleep(0);
  await session.refreshInferenceUsage();
  expect(session.getSnapshot()).toMatchObject({ decisionFailure: 'deadline', elapsedMs: 0,
    usage: { providerAttempts: 1, unconfirmedSubmissions: 0, inputTokens: null, estimatedCost: null } });
  expect(session.getDecisions()[0]!.accounting!.attempts[0]!.evidence).toMatchObject({
    execution: 'deadline', httpStatus: 200, providerRequestId: 'req-stalled', latencyMs: 5000,
  });
  session.dispatch({ type: 'stop' });
  verifyReplay(session.getCompletedRecords()[0]!);
});
