import { expect, test } from 'bun:test';
import { createExpedition, createReplay } from '../src/simulation/expedition';
import { exportExpeditionRecord, importExpeditionRecord } from '../src/records/contract';
import { createDecisionHandler } from '../server/decisions';
import { createTypeSafeController } from '../src/controllers/typesafe';
import type { ControllerInput } from '../src/simulation/types';

test('mission setup selects exclusive, versioned presets without changing science or physical rules', () => {
  const session = createExpedition();
  session.dispatch({ type: 'set-instructions', instructions: 'Favor unusual minerals.' });
  session.dispatch({ type: 'set-mission-preset', preset: 'conserve-energy' });
  session.dispatch({ type: 'start' });
  const input = session.getDecisions()[0]!.input;
  expect(input.instructions).toBe('');
  expect(input.mission).toMatchObject({ version: 2, preferences: { mode: 'preset', preset: {
    id: 'conserve-energy', version: 1, settings: { energyWeight: 5, returnReserveEnergy: 20 },
    adherence: { version: 1 },
  } } });
  expect(input.mission!.preferences).not.toHaveProperty('instructions');
  session.dispatch({ type: 'set-objective', objective: 'unusual-minerals' });
  expect(session.getSnapshot()).toMatchObject({ objective: 'past-water', durationMs: 300_000,
    rubric: { unrelated: 0, suggestive: 5, 'strong-evidence': 10 } });
  session.dispatch({ type: 'set-instructions', instructions: 'Study the nearest evidence.' });
  expect(session.getSnapshot().mission!.requested.preferences).toEqual({ mode: 'free-text', instructions: 'Study the nearest evidence.' });
});

test('requested priorities apply at the next waypoint and replay preserves both times', () => {
  const session = createExpedition({ controller: { id: 'scripted', decide: input =>
    input.candidates.find(action => action.kind === 'explore' && action.target.position.x === 6 && action.target.position.z === 13)?.id ?? 'wait:5000',
  } });
  session.dispatch({ type: 'start' });
  session.advanceWallTime(1_000);
  session.dispatch({ type: 'set-mission-preset', preset: 'balanced' });
  session.advanceWallTime(1_000);
  session.dispatch({ type: 'set-mission-preset', preset: 'explore-more' });
  expect(session.getSnapshot().mission).toMatchObject({ requested: { version: 2 }, effective: { version: 0 } });
  session.advanceWallTime(2_000);
  expect(session.getSnapshot().mission!.history).toMatchObject([
    { version: 0, requestedAtMs: 0, appliedAtMs: 0 },
    { version: 1, requestedAtMs: 1_000, appliedAtMs: null },
    { version: 2, requestedAtMs: 2_000, appliedAtMs: 4_000 },
  ]);
  expect(session.getDecisions()[1]!.input.mission).toMatchObject({ version: 2, preferences: { mode: 'preset', preset: { id: 'explore-more' } } });
  session.dispatch({ type: 'stop' });
  roundTrip(session);
});

function roundTrip(session: ReturnType<typeof createExpedition>) {
  const record = session.getCompletedRecords().at(-1)!;
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


test.each(['balanced', 'conserve-energy', 'explore-more', 'free-text'] as const)('%s reaches Jev through the real SDK with the same evidence as baseline', async preset => {
  let received: { state: ControllerInput; questions: { action: { instructions: string } } } | undefined;
  const handler = createDecisionHandler({ apiKey: 'scripted-key', fetch: async (_url, init) => {
    received = JSON.parse(init!.body as string);
    const input = received!.state;
    return Response.json({ model: 'jev-1.13.0', usage: { input_tokens: 1_000, output_tokens: 40 },
      answers: { action: { type: 'choice', choice: 'wait:5000', confidence: 0,
        probabilities: Object.fromEntries(input.candidates.map(candidate => [candidate.id, 1 / input.candidates.length])) } } });
  } });
  const jev = createExpedition({ controller: createTypeSafeController({
    fetch: (url, init) => handler(new Request(new URL(url, 'http://localhost'), init)),
  }) });
  const baseline = createExpedition();
  for (const session of [baseline, jev]) {
    if (preset === 'free-text') {
      session.dispatch({ type: 'set-mission-preset', preset: 'balanced' });
      session.dispatch({ type: 'set-instructions', instructions: 'Study the nearest evidence.' });
    } else session.dispatch({ type: 'set-mission-preset', preset });
    session.dispatch({ type: 'start' });
  }
  await new Promise<void>(resolve => jev.onDecisionSettled(resolve));
  expect(received!.state).toEqual(JSON.parse(JSON.stringify(baseline.getDecisions()[0]!.input)));
  expect(received!.questions.action.instructions).toContain('mission.preferences');
  expect(JSON.stringify(received)).not.toContain('classifications');
  expect(JSON.stringify(received)).not.toContain('Sample B');
  expect(jev.getDecisions()[0]!.accounting!.attempts[0]!.evidence!.promptVersion).toBe('rover-action-v3');
  jev.dispatch({ type: 'stop' });
  roundTrip(jev);
});

test('preset edits discard obsolete choices, freeze time and preserve the discarded history without inference on replay', async () => {
  const responses: { input: ControllerInput; resolve: (id: string) => void; signal: AbortSignal }[] = [];
  const session = createExpedition({ controller: { id: 'scripted', decide: (input, { signal }) => new Promise<string>(resolve => {
    responses.push({ input, resolve, signal });
  }) } });
  session.dispatch({ type: 'start' });
  session.dispatch({ type: 'set-mission-preset', preset: 'balanced' });
  session.dispatch({ type: 'set-mission-preset', preset: 'conserve-energy' });
  expect(responses[0]!.signal.aborted).toBe(true);
  session.advanceWallTime(60_000);
  expect(session.getSnapshot().elapsedMs).toBe(0);
  expect(responses).toHaveLength(1);
  responses[0]!.resolve('wait:5000');
  await Promise.resolve();
  expect(responses).toHaveLength(2);
  expect(responses[1]!.input.mission!.preferences).toMatchObject({ mode: 'preset', preset: { id: 'conserve-energy' } });
  expect(session.getSnapshot().currentAction).toBeNull();
  responses[1]!.resolve('wait:5000');
  await Promise.resolve();
  session.advanceWallTime(1000);
  session.dispatch({ type: 'stop' });
  expect(session.getDecisions()[0]!.status).toBe('discarded');
  roundTrip(session);
});

test('inspection finishes before priorities apply, and reset starts a separate mission history', () => {
  const session = createExpedition({ scenario: { id: 'inspection', name: 'Inspection', width: 1, depth: 1,
    base: { x: 0, z: 0 }, sensorRange: 1, obstacles: [], roughTerrain: [],
    samples: [{ id: 'a', label: 'Sample A', position: { x: 0, z: 0 }, properties: ['Layered sediment'],
      classifications: { 'past-water': 'strong-evidence', 'unusual-minerals': 'unrelated' } }],
  } });
  session.dispatch({ type: 'start' });
  session.advanceWallTime(1000);
  session.dispatch({ type: 'set-mission-preset', preset: 'conserve-energy' });
  session.advanceWallTime(4900);
  expect(session.getSnapshot().mission!.effective.version).toBe(0);
  session.advanceWallTime(100);
  expect(session.getSnapshot()).toMatchObject({ inspectionCount: 1, mission: { effective: { version: 1 } } });
  expect(session.getSnapshot().mission!.history[1]!.appliedAtMs).toBe(6000);
  session.dispatch({ type: 'stop' });
  roundTrip(session);
  session.dispatch({ type: 'reset' });
  expect(session.getSnapshot().mission!.history).toHaveLength(1);
  expect(session.getSnapshot().mission!.effective).toMatchObject({ version: 0, preferences: { mode: 'preset', preset: { id: 'conserve-energy' } } });
  session.dispatch({ type: 'start' });
  session.advanceWallTime(1000);
  session.dispatch({ type: 'set-instructions', instructions: 'Return soon.' });
  session.dispatch({ type: 'stop' });
  const record = roundTrip(session);
  expect(record.results.mission!.history.at(-1)!.appliedAtMs).toBeNull();
});

test('mission records reject invented settings, application times and mismatched versions', () => {
  const session = createExpedition();
  session.dispatch({ type: 'set-mission-preset', preset: 'balanced' });
  session.dispatch({ type: 'start' });
  session.advanceWallTime(1000);
  session.dispatch({ type: 'stop' });
  const record = session.getCompletedRecords()[0]!;
  const mutations = [
    (value: any) => { value.results.mission.effective.preferences.preset.settings.energyWeight = 999; },
    (value: any) => { value.results.mission.history[1].appliedAtMs = 1000; },
    (value: any) => { value.decisions[0].input.mission.preferences.instructions = 'Conflicting text'; },
    (value: any) => { value.decisions[0].input.mission.version = 9; },
    (value: any) => { value.version = 4; },
    (value: any) => { delete value.results.mission; },
  ];
  for (const mutate of mutations) {
    const changed = structuredClone(record);
    mutate(changed);
    expect(() => importExpeditionRecord(JSON.stringify(changed))).toThrow('Invalid expedition record');
  }
});

test.each([1, 2, 3, 4])('legacy version %s remains free text and replays without adding a preset or mutating its source', async version => {
  const name = version === 4 ? 'legacy-mission-v4' : `legacy-usage-v${version}`;
  const record = importExpeditionRecord(await Bun.file(new URL(`./fixtures/${name}.json`, import.meta.url)).text());
  const before = exportExpeditionRecord(record);
  expect(record.startingConditions.mission).toBeUndefined();
  const replay = createReplay(record);
  replay.dispatch({ type: 'start' });
  replay.advanceWallTime(300_000);
  expect(replay.getSnapshot()).toEqual(record.results);
  expect(replay.getSnapshot().mission).toBeUndefined();
  expect(exportExpeditionRecord(record)).toBe(before);
});

test.each(['conflicting-text', 'invented-definition', 'missing-preferences'] as const)('backend rejects %s before any provider dispatch', async corruption => {
  let outbound = 0;
  const handler = createDecisionHandler({ apiKey: 'scripted-key', fetch: async () => {
    outbound++;
    throw new Error('Invalid preferences must never reach the provider.');
  } });
  const session = createExpedition({ controller: createTypeSafeController({ fetch: (url, init) => {
    const body = JSON.parse(init!.body as string);
    if (corruption === 'conflicting-text') body.input.instructions = 'Competing instructions';
    else if (corruption === 'invented-definition') body.input.mission.preferences.preset.settings.energyWeight = 99;
    else delete body.input.mission.preferences;
    return handler(new Request(new URL(url, 'http://localhost'), { ...init, body: JSON.stringify(body) }));
  } }) });
  session.dispatch({ type: 'set-mission-preset', preset: 'balanced' });
  session.dispatch({ type: 'start' });
  await new Promise<void>(resolve => session.onDecisionSettled(resolve));
  expect(outbound).toBe(0);
  expect(session.getSnapshot()).toMatchObject({ decisionFailure: 'invalid-request', usage: { providerAttempts: 0 }, currentAction: null });
});

test('a preset selected after reset applies independently of the previous expedition pending cancellation', async () => {
  const responses: ((id: string) => void)[] = [];
  const session = createExpedition({ controller: { id: 'scripted', decide: () => new Promise<string>(resolve => responses.push(resolve)) } });
  session.dispatch({ type: 'start' });
  session.dispatch({ type: 'reset' });
  session.dispatch({ type: 'set-mission-preset', preset: 'conserve-energy' });
  expect(session.getSnapshot().mission!.effective).toMatchObject({ version: 1, preferences: { mode: 'preset', preset: { id: 'conserve-energy' } } });
  expect(session.getSnapshot().mission!.history[1]!.appliedAtMs).toBe(0);
  responses[0]!('wait:5000');
  await Promise.resolve();
  session.dispatch({ type: 'start' });
  responses[1]!('wait:5000');
  await Promise.resolve();
  session.dispatch({ type: 'stop' });
  roundTrip(session);
});
