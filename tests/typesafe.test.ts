import { expect, test, spyOn } from 'bun:test';
import { createDecisionHandler } from '../server/decisions';
import { createTypeSafeController } from '../src/controllers/typesafe';
import { createExpedition } from '../src/simulation/expedition';
import type { ControllerInput, Scenario } from '../src/simulation/types';
import { chooseBaselineAction } from '../src/controllers/baseline';
import type { Fetch } from '@typesafe-ai/sdk';
import type { DecisionClock } from '../shared/decisions';

function manualClock() {
  let time = 100_000;
  const timers = new Map<() => void, number>();
  return {
    now: () => time,
    after(ms: number, callback: () => void) { timers.set(callback, time + ms); return () => { timers.delete(callback); }; },
    advance(ms: number) {
      time += ms;
      for (const [callback, at] of timers) if (at <= time) { timers.delete(callback); callback(); }
    },
  };
}
const flush = () => Bun.sleep(0);
const knownUsage = { model: 'jev-1.13.0', usage: { input_tokens: 1000, output_tokens: 40 } };
const transient = () => Response.json({ ...knownUsage, error: 'temporary' }, { status: 503 });
const success = (input: ControllerInput, selected = 'wait:5000') => Response.json({ ...knownUsage,
  answers: { action: { type: 'choice', choice: selected, confidence: 0,
    probabilities: Object.fromEntries(input.candidates.map(candidate => [candidate.id, 1 / input.candidates.length])) } },
});
function expeditionWithService(service: Fetch, options: { clock?: DecisionClock; scenario?: Scenario } = {}) {
  const responses: string[] = [];
  const handler = createDecisionHandler({ apiKey: 'test-key-never-expose', fetch: service, clock: options.clock });
  const controller = createTypeSafeController({ clock: options.clock, fetch: async (url, init) => {
    const response = await handler(new Request(new URL(url, 'http://localhost'), init));
    responses.push(await response.clone().text());
    return response;
  } });
  const expedition = createExpedition({ controller, scenario: options.scenario });
  return { expedition, responses };
}
function settled(expedition: ReturnType<typeof createExpedition>) {
  return new Promise<void>(resolve => {
    const unsubscribe = expedition.onDecisionSettled(() => { unsubscribe(); resolve(); });
  });
}

test('an uncertain TypeSafe Choice executes an offered action and records its actual probabilities', async () => {
  const requests: unknown[] = [];
  const handler = createDecisionHandler({ apiKey: 'test-key-never-expose', fetch: async (_url, init) => {
    const body = JSON.parse(init!.body as string);
    requests.push(body);
    const ids = Object.keys(body.questions.action.criteria);
    return Response.json({ ...knownUsage, answers: { action: { type: 'choice', choice: 'wait:5000', confidence: 0,
      probabilities: Object.fromEntries(ids.map(id => [id, 1 / ids.length])) } } });
  } });
  const controller = createTypeSafeController({ fetch: (url, init) => handler(new Request(new URL(url, 'http://localhost'), init)) });
  const expedition = createExpedition({ controller });
  expedition.dispatch({ type: 'start' });
  await new Promise<void>(resolve => expedition.onDecisionSettled(resolve));
  expect(expedition.getSnapshot()).toMatchObject({ status: 'running', controller: 'typesafe', inferenceAttempts: 1, currentAction: { kind: 'wait' } });
  expect(expedition.getDecisions()[0]).toMatchObject({ status: 'applied', controller: 'typesafe', inferenceAttempts: 1, confidence: 0 });
  expect(expedition.getDecisions()[0]!.probabilities!['wait:5000']).toBeGreaterThan(0);
  expect(JSON.stringify(requests)).not.toContain('classifications');
  expect(JSON.stringify(requests)).not.toContain('Sample B');
  expect(JSON.stringify(expedition.getRecord())).not.toContain('test-key-never-expose');
  expedition.advanceWallTime(1000);
  expect(expedition.getSnapshot().elapsedMs).toBe(1000);
});

test('one retry follows a transient external failure and both attempts are recorded without SDK retries', async () => {
  let attempts = 0;
  const { expedition } = expeditionWithService(async (_url, init) => {
    attempts++;
    if (attempts === 1) return transient();
    expect(new Headers(init!.headers).has('X-TypeSafe-Retry-Count')).toBe(false);
    return success(JSON.parse(init!.body as string).state);
  });
  expedition.dispatch({ type: 'start' });
  await settled(expedition);
  expect(attempts).toBe(2);
  expect(expedition.getSnapshot()).toMatchObject({ status: 'running', inferenceAttempts: 2 });
  expect(expedition.getDecisions()[0]).toMatchObject({ inferenceAttempts: 2, status: 'applied' });
  expect(expedition.getRecord().events.filter(event => event.type === 'inference-attempt')).toHaveLength(2);
});

test('a retry shares the five-second total deadline, aborts the SDK and freezes modeled evolution', async () => {
  const clock = manualClock();
  let attempts = 0;
  let release!: () => void;
  let retrySignal!: AbortSignal;
  const { expedition } = expeditionWithService((_url, init) => {
    attempts++;
    if (attempts === 1) return new Promise(resolve => { release = () => resolve(transient()); });
    retrySignal = init!.signal!;
    return new Promise((_resolve, reject) => retrySignal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true }));
  }, { clock });
  expedition.dispatch({ type: 'start' });
  await flush();
  const frozen = expedition.getSnapshot();
  clock.advance(4_000);
  expedition.advanceWallTime(4_000);
  expect(expedition.getSnapshot()).toEqual(frozen);
  release();
  await flush();
  expect(attempts).toBe(2);
  clock.advance(999);
  await flush();
  expect(expedition.getSnapshot().decisionPending).toBe(true);
  clock.advance(1);
  await flush();
  expect(retrySignal.aborted).toBe(true);
  expect(expedition.getSnapshot()).toMatchObject({ status: 'paused', decisionFailure: 'deadline', elapsedMs: 0, battery: 100, inferenceAttempts: 2 });
  expedition.dispatch({ type: 'resume' });
  expedition.dispatch({ type: 'set-instructions', instructions: 'Try again.' });
  expect(expedition.getSnapshot().status).toBe('paused');
  expect(attempts).toBe(2);
  expedition.dispatch({ type: 'stop' });
  expect(expedition.getSnapshot().endingCondition).toBe('manual-stop');
});

test.each(['invented-choice', 'missing-probability', 'bad-probability', 'wrong-type', 'malformed-json'])(
  'invalid external output (%s) pauses without a retry or controller substitution', async invalid => {
    let attempts = 0;
    const { expedition } = expeditionWithService(async (_url, init) => {
      attempts++;
      if (invalid === 'malformed-json') return new Response('{broken', { headers: { 'Content-Type': 'application/json' } });
      const body = await success(JSON.parse(init!.body as string).state).json();
      const answer = body.answers.action;
      if (invalid === 'invented-choice') answer.choice = 'invented';
      if (invalid === 'missing-probability') delete answer.probabilities['wait:5000'];
      if (invalid === 'bad-probability') answer.probabilities['wait:5000'] = 99;
      if (invalid === 'wrong-type') answer.type = 'score';
      return Response.json(body);
    });
    expedition.dispatch({ type: 'start' });
    await settled(expedition);
    expect(expedition.getSnapshot()).toMatchObject({ status: 'paused', decisionFailure: 'invalid-output', controller: 'typesafe', currentAction: null, inferenceAttempts: 1 });
    expect(attempts).toBe(1);
  },
);

test('malformed browser/backend output pauses instead of automatically retrying an invalid response', async () => {
  const controller = createTypeSafeController({ fetch: async () => new Response('{broken') });
  const expedition = createExpedition({ controller });
  expedition.dispatch({ type: 'start' });
  await settled(expedition);
  expect(expedition.getSnapshot()).toMatchObject({ status: 'paused', decisionFailure: 'invalid-output', inferenceAttempts: 1 });
});

test.each(['set-instructions', 'reset', 'stop'] as const)('%s cancels the external request, discards late output and preserves attempt attribution', async command => {
  const pending: { input: ControllerInput; signal: AbortSignal; resolve: (response: Response) => void }[] = [];
  const { expedition } = expeditionWithService((_url, init) => new Promise(resolve => {
    pending.push({ input: JSON.parse(init!.body as string).state, signal: init!.signal!, resolve });
  }));
  expedition.dispatch({ type: 'start' });
  await flush();
  if (command === 'set-instructions') expedition.dispatch({ type: command, instructions: 'New instructions' });
  else expedition.dispatch({ type: command });
  if (command === 'reset') expedition.dispatch({ type: 'start' });
  await flush();
  expect(pending[0]!.signal.aborted).toBe(true);
  pending[0]!.resolve(success(pending[0]!.input, pending[0]!.input.candidates[0]!.id));
  await flush();
  expect(expedition.getRecord().events.filter(event => event.type === 'action-started')).toHaveLength(0);
  if (command === 'set-instructions') {
    expedition.dispatch({ type: 'acknowledge-usage', attemptIds: expedition.getSnapshot().usagePause!.attemptIds });
    await flush();
  }
  if (command !== 'stop') {
    expect(pending).toHaveLength(2);
    expect(expedition.getSnapshot().inferenceAttempts).toBe(command === 'reset' ? 1 : 2);
    pending[1]!.resolve(success(pending[1]!.input));
    await settled(expedition);
    expect(expedition.getSnapshot().currentAction?.kind).toBe('wait');
  } else expect(expedition.getSnapshot()).toMatchObject({ status: 'ended', inferenceAttempts: 1 });
  expect(expedition.getRecord().events.filter(event => event.type === 'decision-settled')[0]).toMatchObject({ expedition: 1, decision: { status: 'discarded', inferenceAttempts: 1 } });
});

test('a complete TypeSafe expedition uses only rover knowledge through exploration, inspection, delivery and recharge', async () => {
  const inputs: ControllerInput[] = [];
  const { expedition } = expeditionWithService(async (_url, init) => {
    const input = JSON.parse(init!.body as string).state as ControllerInput;
    inputs.push(input);
    return success(input, chooseBaselineAction(input).id);
  });
  expedition.dispatch({ type: 'start' });
  while (expedition.getSnapshot().status === 'running') {
    if (expedition.getSnapshot().decisionPending) await settled(expedition);
    expedition.advanceWallTime(100);
  }
  const snapshot = expedition.getSnapshot();
  expect(snapshot.endingCondition).toBe('timeout');
  expect(snapshot.scienceScore).toBeGreaterThan(0);
  expect(snapshot.inspectionCount).toBeGreaterThan(0);
  expect(expedition.getRecord().events.some(event => event.type === 'action-completed' && event.action.kind === 'recharge')).toBe(true);
  expect(expedition.getDecisions().every(decision => decision.controller === 'typesafe' && decision.status === 'applied')).toBe(true);
  expect(JSON.stringify(inputs)).not.toContain('classifications');
  expect(JSON.stringify(inputs[0])).not.toContain('Layered sediment');
  expect(expedition.getRecord().results.inferenceAttempts).toBe(inputs.length);
});

test('persistent service failure stops after two attempts and cannot leak echoed credentials or SDK logs', async () => {
  const logs = (['debug', 'info', 'warn', 'error'] as const).map(level => spyOn(console, level).mockImplementation(() => {}));
  try {
    let attempts = 0;
    const { expedition, responses } = expeditionWithService(async () => {
      attempts++;
      return Response.json({ ...knownUsage, error: 'test-key-never-expose' }, { status: 503 });
    });
    expedition.dispatch({ type: 'start' });
    await settled(expedition);
    expect(expedition.getSnapshot().decisionFailure).toBe('unavailable');
    expect(attempts).toBe(2);
    expect(JSON.stringify(responses)).not.toContain('test-key-never-expose');
    expect(JSON.stringify(expedition.getRecord())).not.toContain('test-key-never-expose');
    for (const log of logs) expect(log).not.toHaveBeenCalled();
  } finally { for (const log of logs) log.mockRestore(); }
});

test('the backend rejects unexpected request fields before issuing a paid-service attempt', async () => {
  let attempts = 0;
  const handler = createDecisionHandler({ apiKey: 'test-key', fetch: async () => { attempts++; throw new Error('should not run'); } });
  const controller = createTypeSafeController({ fetch: (url, init) => {
    const body = JSON.parse(init.body as string);
    body.input.world = { hiddenSamples: [] };
    return handler(new Request(new URL(url, 'http://localhost'), { ...init, body: JSON.stringify(body) }));
  } });
  const expedition = createExpedition({ controller });
  expedition.dispatch({ type: 'start' });
  await settled(expedition);
  expect(expedition.getSnapshot().decisionFailure).toBe('invalid-request');
  expect(attempts).toBe(0);
});

test('a server without a key pauses TypeSafe while baseline remains key-free', async () => {
  const handler = createDecisionHandler();
  const typesafeController = createTypeSafeController({ fetch: (url, init) => handler(new Request(new URL(url, 'http://localhost'), init)) });
  const expedition = createExpedition({ typesafeController });
  expedition.dispatch({ type: 'set-controller', controller: 'typesafe' });
  expedition.dispatch({ type: 'start' });
  await settled(expedition);
  expect(expedition.getSnapshot()).toMatchObject({ controller: 'typesafe', decisionFailure: 'configuration', status: 'paused' });
  expedition.dispatch({ type: 'reset' });
  expedition.dispatch({ type: 'set-controller', controller: 'baseline' });
  expedition.dispatch({ type: 'start' });
  expedition.advanceWallTime(1000);
  expect(expedition.getSnapshot()).toMatchObject({ controller: 'baseline', inferenceAttempts: 0, elapsedMs: 1000 });
});

test('Bun HTTP cancellation reaches the real SDK and aborts its external transport', async () => {
  let serviceSignal!: AbortSignal;
  let notifyStarted!: () => void;
  const started = new Promise<void>(resolve => { notifyStarted = resolve; });
  const handler = createDecisionHandler({ apiKey: 'test-key', fetch: (_url, init) => {
    serviceSignal = init!.signal!;
    notifyStarted();
    return new Promise((_resolve, reject) => serviceSignal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true }));
  } });
  const server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: handler });
  try {
    const controller = createTypeSafeController({ fetch: (url, init) => fetch(new URL(url, server.url), init) });
    const expedition = createExpedition({ controller });
    expedition.dispatch({ type: 'start' });
    await started;
    expedition.dispatch({ type: 'stop' });
    await settled(expedition);
    for (let i = 0; i < 20 && !serviceSignal.aborted; i++) await Bun.sleep(5);
    expect(serviceSignal.aborted).toBe(true);
    expect(expedition.getSnapshot()).toMatchObject({ status: 'ended', inferenceAttempts: 1, currentAction: null });
  } finally { await server.stop(true); }
});

test('the deadline covers a stalled response body and late bytes cannot execute an action', async () => {
  const clock = manualClock();
  let signal!: AbortSignal;
  let body!: ReadableStreamDefaultController<Uint8Array>;
  const { expedition } = expeditionWithService(async (_url, init) => {
    signal = init!.signal!;
    return new Response(new ReadableStream<Uint8Array>({ start(controller) {
      body = controller;
      controller.enqueue(new TextEncoder().encode('{"answers":'));
    } }), { headers: { 'Content-Type': 'application/json' } });
  }, { clock });
  expedition.dispatch({ type: 'start' });
  await flush();
  clock.advance(5_000);
  await flush();
  expect(signal.aborted).toBe(true);
  expect(expedition.getSnapshot()).toMatchObject({ status: 'paused', decisionFailure: 'deadline', inferenceAttempts: 1, currentAction: null });
  // A cancelled stream may already be closed by the SDK; either way it is stale.
  try { body.close(); } catch { /* already cancelled */ }
  await flush();
  expect(expedition.getSnapshot().currentAction).toBeNull();
});

test('a successful response arriving after the deadline is rejected even before a delayed timer callback runs', async () => {
  let now = 100_000;
  const clock: DecisionClock = { now: () => now, after(ms, callback) {
    const timer = setTimeout(callback, ms);
    return () => clearTimeout(timer);
  } };
  const handler = createDecisionHandler({ apiKey: 'test-key', clock, fetch: async (_url, init) => success(JSON.parse(init!.body as string).state) });
  const controller = createTypeSafeController({ clock, fetch: async (url, init) => {
    const response = await handler(new Request(new URL(url, 'http://localhost'), init));
    // Model network delivery arriving after expiry while timers are not serviced.
    now += 5_001;
    return response;
  } });
  const expedition = createExpedition({ controller });
  expedition.dispatch({ type: 'start' });
  await settled(expedition);
  expect(expedition.getSnapshot().decisionFailure).toBe('deadline');
  expect(expedition.getSnapshot().currentAction).toBeNull();
});

test('mission control retries a failed decision with current instructions and the existing attempt budget', async () => {
  const clock = manualClock();
  const inputs: ControllerInput[] = [];
  let release!: () => void;
  const { expedition } = expeditionWithService((_url, init) => {
    const input = JSON.parse(init!.body as string).state as ControllerInput;
    inputs.push(input);
    if (inputs.length <= 2) return Promise.resolve(transient());
    return new Promise(resolve => { release = () => resolve(success(input)); });
  }, { clock });
  expedition.dispatch({ type: 'start' });
  await settled(expedition);
  expect(expedition.getSnapshot()).toMatchObject({ status: 'paused', decisionFailure: 'unavailable', inferenceAttempts: 2 });
  const failed = expedition.getSnapshot();
  clock.advance(6_000);
  expedition.advanceWallTime(6_000);
  expect(expedition.getSnapshot()).toEqual(failed);
  expedition.dispatch({ type: 'set-instructions', instructions: 'Use the updated mission priorities.' });
  expedition.dispatch({ type: 'retry-decision' });
  expect(expedition.getSnapshot()).toMatchObject({ decisionPending: true, decisionFailure: null });
  expedition.dispatch({ type: 'retry-decision' });
  await flush();
  expect(inputs).toHaveLength(3);
  expect(inputs[2]).toMatchObject({ instructions: 'Use the updated mission priorities.', instructionsVersion: 1 });
  const pending = expedition.getSnapshot();
  clock.advance(4_999);
  expedition.advanceWallTime(4_999);
  expect(expedition.getSnapshot()).toEqual(pending);
  release();
  await settled(expedition);
  expect(expedition.getSnapshot()).toMatchObject({ status: 'running', controller: 'typesafe', inferenceAttempts: 3, currentAction: { kind: 'wait' }, elapsedMs: 0, battery: 100 });
  expect(expedition.getDecisions().map(decision => [decision.input.decisionBoundary?.triggers, decision.status, decision.inferenceAttempts])).toEqual([
    [['start'], 'failed', 2], [['instructions-changed', 'retry'], 'applied', 1],
  ]);
  expedition.advanceWallTime(1_000);
  expect(expedition.getSnapshot().elapsedMs).toBe(1_000);
});

test('explicit baseline continuation preserves cargo, earned science and resources, and records both controllers', async () => {
  const scenario: Scenario = {
    id: 'recovery-corridor', name: 'Recovery corridor', width: 3, depth: 1,
    base: { x: 0, z: 0 }, sensorRange: 3, obstacles: [], roughTerrain: [],
    samples: [
      { id: 'a', label: 'Sample A', position: { x: 1, z: 0 }, properties: ['Layered sediment'],
        classifications: { 'past-water': 'strong-evidence', 'unusual-minerals': 'unrelated' } },
      { id: 'b', label: 'Sample B', position: { x: 2, z: 0 }, properties: ['Hydrated minerals'],
        classifications: { 'past-water': 'suggestive', 'unusual-minerals': 'strong-evidence' } },
    ],
  };
  const { expedition } = expeditionWithService(async (_url, init) => {
    const input = JSON.parse(init!.body as string).state as ControllerInput;
    if (input.cargo.some(sample => sample.sampleId === 'b')) return success(input, 'invented');
    const action = input.cargo.length ? input.candidates.find(action => action.kind === 'return-to-base')! : chooseBaselineAction(input);
    return success(input, action.id);
  }, { scenario });
  expedition.dispatch({ type: 'set-instructions', instructions: 'Bring back evidence of water.' });
  expedition.dispatch({ type: 'start' });
  while (expedition.getSnapshot().status === 'running' && expedition.getSnapshot().elapsedMs < 40_000) {
    if (expedition.getSnapshot().decisionPending) await settled(expedition);
    expedition.advanceWallTime(100);
  }
  expect(expedition.getSnapshot()).toMatchObject({ status: 'paused', controller: 'typesafe', cargo: [{ sampleId: 'b' }], scienceScore: 10, energyUsed: 8, battery: 92, elapsedMs: 36_000 });
  const failed = expedition.getSnapshot();
  expedition.dispatch({ type: 'set-controller', controller: 'baseline' });
  expedition.dispatch({ type: 'resume' });
  expedition.advanceWallTime(10_000);
  expect(expedition.getSnapshot()).toEqual(failed);
  expedition.dispatch({ type: 'continue-with-baseline' });
  expect(expedition.getSnapshot().controller).toBe('baseline');
  expect(expedition.getSnapshot()).toMatchObject({ status: 'running', decisionFailure: null, currentAction: { kind: 'return-to-base' } });
  for (const field of ['objective', 'rubric', 'elapsedMs', 'remainingMs', 'cargo', 'energyUsed', 'battery', 'rover', 'scienceScore', 'deliveredSamples', 'instructions', 'instructionsVersion', 'memory', 'observations', 'inferenceAttempts', 'inferenceLatencyMs'] as const) {
    expect(expedition.getSnapshot()[field]).toEqual(failed[field]);
  }
  expect(expedition.getSnapshot().controllerHistory).toEqual([
    { controller: 'typesafe', atMs: 0, firstDecisionId: 1 },
    { controller: 'baseline', atMs: 36_000, firstDecisionId: 7 },
  ]);
  expect(expedition.getDecisions().at(-1)).toMatchObject({ controller: 'baseline', reason: 'controller-changed', status: 'applied', inferenceAttempts: 0 });
  expedition.dispatch({ type: 'continue-with-baseline' });
  expedition.dispatch({ type: 'retry-decision' });
  expedition.advanceWallTime(8_000);
  expedition.dispatch({ type: 'stop' });
  expect(expedition.getSnapshot()).toMatchObject({ cargo: [], scienceScore: 15, elapsedMs: 44_000 });
  expect(expedition.getRecord().results.controllerHistory).toEqual(expedition.getSnapshot().controllerHistory);
  const transitions = expedition.getRecord().events.filter(event => event.type === 'controller-changed');
  expect(transitions).toMatchObject([{ from: 'typesafe', to: 'baseline', failure: 'invalid-output', atMs: 36_000, expedition: 1 }]);
  expect(transitions).toHaveLength(1);
  expect(expedition.getRecord().events.filter(event => event.type === 'action-completed').at(-1)).toMatchObject({ controller: 'baseline', action: { kind: 'return-to-base' } });
  expedition.dispatch({ type: 'reset' });
  expect(expedition.getSnapshot().controllerHistory).toEqual([{ controller: 'baseline', atMs: 0, firstDecisionId: 1 }]);
});

test.each([false, true])('repeated recovery failures preserve usage and manual retry obeys a configured provider allowance (last attempt fails: %s)', async failLast => {
  let attempts = 0;
  const { expedition } = expeditionWithService(async (_url, init) => {
    attempts++;
    const input = JSON.parse(init!.body as string).state as ControllerInput;
    if (attempts === 1) return success(input, 'invented');
    if (attempts === 100 && !failLast) return success(input);
    return transient();
  });
  expedition.dispatch({ type: 'set-inference-limits', limits: { providerAttempts: 100, estimatedCost: 0.1 } });
  expedition.dispatch({ type: 'start' });
  await settled(expedition);
  for (let retry = 0; retry < 49; retry++) {
    expedition.dispatch({ type: 'retry-decision' });
    expect(expedition.getSnapshot().decisionPending).toBe(true);
    await settled(expedition);
    expect(expedition.getSnapshot()).toMatchObject({ status: 'paused', controller: 'typesafe', currentAction: null, elapsedMs: 0, inferenceAttempts: 3 + retry * 2 });
  }
  expect(attempts).toBe(99);
  expedition.dispatch({ type: 'retry-decision' });
  await settled(expedition);
  if (!failLast) {
    expect(expedition.getSnapshot().currentAction?.kind).toBe('wait');
  }
  expect(expedition.getSnapshot()).toMatchObject({ status: 'paused', decisionFailure: null, usagePause: { reasons: ['attempt-limit'] }, inferenceAttempts: 100 });
  const exhausted = expedition.getSnapshot();
  expedition.dispatch({ type: 'retry-decision' });
  expedition.dispatch({ type: 'resume' });
  await flush();
  expect(expedition.getSnapshot()).toEqual(exhausted);
  expect(attempts).toBe(100);
  expect(expedition.getRecord().events.filter(event => event.type === 'inference-attempt')).toHaveLength(100);
  expedition.dispatch({ type: 'continue-with-baseline' });
  expect(expedition.getSnapshot()).toMatchObject({ controller: 'baseline', status: 'running', inferenceAttempts: 100 });
  expedition.dispatch({ type: 'stop' });
  expect(expedition.getSnapshot().endingCondition).toBe('manual-stop');
  expedition.dispatch({ type: 'reset' });
  expect(expedition.getSnapshot()).toMatchObject({ status: 'ready', inferenceAttempts: 0, decisionFailure: null });
});

test.each(['retry-decision', 'continue-with-baseline', 'reset', 'stop'] as const)(
  'late output from a timed-out operation cannot execute after %s', async command => {
    const clock = manualClock();
    const pending: { input: ControllerInput; signal: AbortSignal; resolve: (response: Response) => void }[] = [];
    const { expedition } = expeditionWithService((_url, init) => new Promise(resolve => {
      pending.push({ input: JSON.parse(init!.body as string).state, signal: init!.signal!, resolve });
    }), { clock });
    expedition.dispatch({ type: 'start' });
    await flush();
    clock.advance(5_000);
    await flush();
    expect(expedition.getSnapshot().decisionFailure).toBe('deadline');
    expect(pending[0]!.signal.aborted).toBe(true);
    if (command === 'retry-decision') expedition.dispatch({ type: 'acknowledge-usage', attemptIds: expedition.getSnapshot().usagePause!.attemptIds });
    else expedition.dispatch({ type: command });
    if (command === 'reset') expedition.dispatch({ type: 'start' });
    await flush();
    const recovered = expedition.getSnapshot();
    pending[0]!.resolve(success(pending[0]!.input, pending[0]!.input.candidates[0]!.id));
    await flush();
    expect(expedition.getSnapshot()).toEqual(recovered);
    expect(expedition.getRecord().events.filter(event => event.type === 'decision-made' && event.controller === 'typesafe')).toHaveLength(0);
    if (command === 'retry-decision' || command === 'reset') {
      expect(pending).toHaveLength(2);
      pending[1]!.resolve(success(pending[1]!.input));
      await settled(expedition);
      expect(expedition.getSnapshot()).toMatchObject({ controller: 'typesafe', currentAction: { kind: 'wait' }, inferenceAttempts: command === 'reset' ? 1 : 2 });
    } else expect(pending).toHaveLength(1);
    expedition.dispatch({ type: 'stop' });
  },
);


test('the real TypeSafe contract accepts discovered storms and selects a complete detour candidate', async () => {
  const requests: ControllerInput[] = [];
  const { expedition } = expeditionWithService(async (_url, init) => {
    const input: ControllerInput = JSON.parse(init!.body as string).state;
    requests.push(input);
    const detour = input.candidates.find(candidate => candidate.kind === 'inspect' && candidate.routeMode === 'avoid-storm');
    return success(input, detour?.id ?? 'wait:5000');
  }, { scenario: {
    id: 'typesafe-storm', name: 'TypeSafe storm', width: 5, depth: 3, base: { x: 0, z: 1 }, sensorRange: 5,
    obstacles: [], roughTerrain: [],
    dustStorm: { position: { x: 2, z: 1 }, radius: 0.5, durationMs: 90_000, sensorRange: 0.5, movementEnergyMultiplier: 5 },
    samples: [{ id: 'a', label: 'Sample A', position: { x: 4, z: 1 }, properties: ['Private mineral'],
      classifications: { 'past-water': 'unrelated', 'unusual-minerals': 'strong-evidence' } }],
  } });
  expedition.dispatch({ type: 'introduce-storm' });
  expedition.dispatch({ type: 'start' });
  await settled(expedition);
  expect(expedition.getSnapshot()).toMatchObject({ decisionFailure: null, inferenceAttempts: 1,
    currentAction: { kind: 'inspect', routeMode: 'avoid-storm', routeEstimate: { energy: 12 } } });
  expect(requests[0]!.observations.find(item => item.kind === 'dust-storm')).toMatchObject({ radius: 0.5, remainingMs: 90_000 });
  expect(JSON.stringify(requests)).not.toContain('Private mineral');
  expect(JSON.stringify(requests)).not.toContain('classifications');
  expect(expedition.getDecisions()[0]!.probabilities!['inspect:a:avoid-storm']).toBeGreaterThan(0);
  expedition.advanceWallTime(24_000);
  expect(expedition.getSnapshot()).toMatchObject({ energyUsed: 12, rover: { position: { x: 4, z: 1 } } });
});
