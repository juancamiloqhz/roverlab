import { exportExpeditionRecord, importExpeditionRecord } from '../src/records/contract';
import { expect, test } from 'bun:test';
import { createDecisionHandler } from '../server/decisions';
import { createTypeSafeController } from '../src/controllers/typesafe';
import { createExpedition, createReplay } from '../src/simulation/expedition';
import type { ControllerInput, Scenario } from '../src/simulation/types';

const corridor: Scenario = {
  id: 'cadence', name: 'Decision cadence corridor', width: 16, depth: 1,
  base: { x: 0, z: 0 }, sensorRange: 5, obstacles: [], roughTerrain: [], samples: [],
};
function serviceRun(scenario = corridor, choose: (input: ControllerInput) => string = input =>
  input.candidates.find(candidate => candidate.kind === 'explore')?.id ?? 'wait:5000') {
  const inputs: ControllerInput[] = [];
  const handler = createDecisionHandler({ apiKey: 'scripted-test-key', fetch: async (_url, init) => {
    const input: ControllerInput = JSON.parse(init!.body as string).state;
    inputs.push(input);
    return Response.json({ model: 'jev-1.13.0', usage: { input_tokens: 100, output_tokens: 10 },
      answers: { action: { type: 'choice', choice: choose(input), confidence: 0,
        probabilities: Object.fromEntries(input.candidates.map(candidate => [candidate.id, 1 / input.candidates.length])) } } });
  } });
  const controller = createTypeSafeController({ fetch: (url, init) => handler(new Request(new URL(url, 'http://localhost'), init)) });
  return { inputs, expedition: createExpedition({ scenario, controller }) };
}
async function settle(expedition: ReturnType<typeof createExpedition>) {
  if (!expedition.getSnapshot().decisionPending) return;
  await new Promise<void>(resolve => {
    const unsubscribe = expedition.onDecisionSettled(() => { unsubscribe(); resolve(); });
  });
}

test('routine multi-cell travel preserves observations without repeated provider requests', async () => {
  const { expedition, inputs } = serviceRun();
  expedition.dispatch({ type: 'start' });
  await settle(expedition);
  const initialMemory = expedition.getSnapshot().memory.length;
  for (let step = 0; step < 3; step++) {
    expedition.advanceWallTime(4_000);
    await settle(expedition);
  }
  expect(expedition.getSnapshot().rover.position).toEqual({ x: 3, z: 0 });
  expect(expedition.getSnapshot().memory.length).toBeGreaterThan(initialMemory);
  expect(inputs).toHaveLength(1);
  expect(expedition.getSnapshot().inferenceAttempts).toBe(1);
  expedition.dispatch({ type: 'stop' });
});

test('inspection completion coalesces mission edits, evidence and hazard changes into one provider context', async () => {
  const scenario: Scenario = { ...corridor, width: 1,
    dustStorm: { position: { x: 0, z: 0 }, radius: 1, durationMs: 5_000, sensorRange: 1, movementEnergyMultiplier: 3 },
    samples: [{ id: 'a', label: 'Specimen', position: { x: 0, z: 0 }, properties: ['Layered sediment'],
      classifications: { 'past-water': 'strong-evidence', 'unusual-minerals': 'unrelated' } }],
  };
  const { expedition, inputs } = serviceRun(scenario, input => input.candidates.find(candidate => candidate.kind === 'inspect')?.id ?? 'wait:5000');
  expedition.dispatch({ type: 'start' });
  await settle(expedition);
  expedition.advanceWallTime(1_000);
  expedition.dispatch({ type: 'set-instructions', instructions: 'Read the new evidence.' });
  expedition.dispatch({ type: 'introduce-storm' });
  expedition.dispatch({ type: 'set-mission-preset', preset: 'conserve-energy' });
  expedition.advanceWallTime(4_900);
  expect(inputs).toHaveLength(1);
  expedition.advanceWallTime(100);
  await settle(expedition);
  expect(inputs).toHaveLength(2);
  expect(inputs[1]).toMatchObject({ atMs: 6_000, sensorRange: 5, instructions: '',
    mission: { preferences: { mode: 'preset', preset: { id: 'conserve-energy' } } },
    decisionBoundary: { version: 'meaningful-boundaries-v1', triggers: [
      'instructions-changed', 'storm-effects-changed', 'storm-detected', 'mission-changed',
      'sample-inspected', 'storm-expired', 'action-completed',
    ] },
  });
  expect(inputs[1]!.memory.find(item => item.kind === 'sample')).toMatchObject({ properties: ['Layered sediment'], inspectedAtMs: 6_000 });
  expect(inputs[0]!.memory.find(item => item.kind === 'sample')).not.toHaveProperty('properties');
  expedition.dispatch({ type: 'stop' });
});

test.each(['balanced', 'conserve-energy'] as const)('crossing the %s return reserve requests once at a waypoint without forcing the choice', async preset => {
  const scenario: Scenario = { ...corridor, width: 35, sensorRange: 31, samples: [
    { id: 'far', label: 'Distant sample', position: { x: 30, z: 0 }, properties: ['Layered sediment'],
      classifications: { 'past-water': 'strong-evidence', 'unusual-minerals': 'unrelated' } },
  ] };
  const { expedition, inputs } = serviceRun(scenario, input => input.candidates.find(candidate => candidate.kind === 'inspect')?.id ?? 'wait:5000');
  expedition.dispatch({ type: 'set-mission-preset', preset });
  expedition.dispatch({ type: 'start' });
  await settle(expedition);
  const crossingMs = preset === 'balanced' ? 92_000 : 80_000;
  expedition.advanceWallTime(crossingMs - 100);
  expect(inputs).toHaveLength(1);
  expedition.advanceWallTime(100);
  await settle(expedition);
  expect(inputs).toHaveLength(2);
  expect(inputs[1]).toMatchObject({ atMs: crossingMs, decisionBoundary: { triggers: ['battery-reserve'] } });
  expect(expedition.getSnapshot().currentAction?.kind).toBe('inspect');
  expedition.advanceWallTime(8_000);
  await settle(expedition);
  expect(inputs).toHaveLength(2);
  expedition.dispatch({ type: 'stop' });
});

test('full cargo and the delivery time threshold are recorded once with completed actions', async () => {
  const scenario: Scenario = { ...corridor, width: 2, samples: ['a', 'b'].map(id => ({
    id, label: id, position: { x: 1, z: 0 }, properties: ['Layered sediment'],
    classifications: { 'past-water': 'strong-evidence', 'unusual-minerals': 'unrelated' },
  })) };
  const { expedition, inputs } = serviceRun(scenario, input => input.candidates.find(candidate => candidate.kind === 'collect')?.id ?? 'wait:5000');
  expedition.dispatch({ type: 'start' });
  await settle(expedition);
  while (expedition.getSnapshot().elapsedMs < 292_000) {
    expedition.advanceWallTime(1_000);
    await settle(expedition);
  }
  const full = inputs.filter(input => input.decisionBoundary?.triggers.includes('cargo-full'));
  expect(full).toHaveLength(1);
  expect(full[0]).toMatchObject({ atMs: 12_000, cargo: [{ sampleId: 'a' }, { sampleId: 'b' }] });
  const returning = inputs.filter(input => input.decisionBoundary?.triggers.includes('return-time'));
  expect(returning).toHaveLength(1);
  expect(returning[0]).toMatchObject({ atMs: 282_000, remainingMs: 18_000,
    decisionBoundary: { triggers: ['return-time', 'action-completed'] } });
  expect(expedition.getSnapshot().inferenceAttempts).toBe(inputs.length);
  expedition.dispatch({ type: 'stop' });
});

test('pending changes retain every trigger, reject obsolete actions and discard frozen wall time', async () => {
  let now = 0;
  const requests: { input: ControllerInput; signal: AbortSignal; resolve: (id: string) => void }[] = [];
  const expedition = createExpedition({ wallNow: () => now, scenario: { ...corridor,
    dustStorm: { position: { x: 0, z: 0 }, radius: 1, durationMs: 5_000, sensorRange: 1, movementEnergyMultiplier: 3 },
  }, controller: { id: 'scripted', decide: (input, { signal }) => new Promise<string>(resolve => { requests.push({ input, signal, resolve }); }) } });
  expedition.dispatch({ type: 'start' });
  expedition.dispatch({ type: 'set-instructions', instructions: 'First edit' });
  expedition.dispatch({ type: 'set-instructions', instructions: 'Latest edit' });
  expedition.dispatch({ type: 'set-mission-preset', preset: 'conserve-energy' });
  expedition.dispatch({ type: 'introduce-storm' });
  const frozen = expedition.getSnapshot();
  now = 4_000;
  expedition.advanceWallTime(60_000);
  expect(expedition.getSnapshot()).toEqual(frozen);
  expect(requests).toHaveLength(1);
  expect(requests[0]!.signal.aborted).toBe(true);
  requests[0]!.resolve('wait:5000');
  await Promise.resolve();
  expect(requests).toHaveLength(2);
  expect(expedition.getSnapshot().currentAction).toBeNull();
  expect(requests[1]!.input.decisionBoundary?.triggers).toEqual([
    'start', 'instructions-changed', 'mission-changed', 'storm-effects-changed', 'storm-detected',
  ]);
  expect(requests[1]!.input).toMatchObject({ atMs: 0, sensorRange: 1, mission: { version: 3 } });
  expedition.dispatch({ type: 'pause' });
  now = 4_800;
  requests[1]!.resolve('wait:5000');
  await Promise.resolve();
  expedition.advanceWallTime(60_000);
  expect(expedition.getSnapshot()).toMatchObject({ elapsedMs: 0, status: 'paused', battery: 100 });
  expedition.dispatch({ type: 'resume' });
  expedition.advanceWallTime(100);
  expect(expedition.getSnapshot().elapsedMs).toBe(100);
  expect(expedition.getDecisions().map(decision => [decision.status, decision.latencyMs])).toEqual([
    ['discarded', 4_000], ['applied', 800],
  ]);
  expedition.dispatch({ type: 'stop' });
});

test('sample discovery interrupts routine travel at the next waypoint with only observed science', async () => {
  const scenario: Scenario = { ...corridor, samples: [{ id: 'new', label: 'New specimen', position: { x: 6, z: 0 },
    properties: ['Hidden property'], classifications: { 'past-water': 'strong-evidence', 'unusual-minerals': 'unrelated' } }] };
  const { expedition, inputs } = serviceRun(scenario);
  expedition.dispatch({ type: 'start' });
  await settle(expedition);
  expedition.advanceWallTime(3_900);
  expect(inputs).toHaveLength(1);
  expedition.advanceWallTime(100);
  await settle(expedition);
  expect(inputs).toHaveLength(2);
  expect(inputs[1]).toMatchObject({ atMs: 4_000, position: { x: 1, z: 0 }, decisionBoundary: { triggers: ['sample-discovered'] } });
  expect(inputs[1]!.memory.find(item => item.kind === 'sample')).toMatchObject({ sampleId: 'new', status: 'available' });
  expect(JSON.stringify(inputs)).not.toContain('Hidden property');
  expect(JSON.stringify(inputs)).not.toContain('classifications');
  expedition.dispatch({ type: 'stop' });
});

test('coalesced provider inputs round-trip and replay without another request', async () => {
  const { expedition, inputs } = serviceRun();
  expedition.dispatch({ type: 'start' });
  await settle(expedition);
  expedition.advanceWallTime(1_000);
  expedition.dispatch({ type: 'set-instructions', instructions: 'New instructions' });
  expedition.dispatch({ type: 'set-mission-preset', preset: 'explore-more' });
  expedition.advanceWallTime(3_000);
  await settle(expedition);
  expedition.dispatch({ type: 'stop' });
  const source = expedition.getCompletedRecords()[0]!;
  const json = exportExpeditionRecord(source);
  const imported = importExpeditionRecord(json);
  expect(imported.version).toBe(9);
  expect(imported.startingConditions.decisionCadence).toBe('meaningful-boundaries-v1');
  expect(imported.decisions[1]!.input.decisionBoundary?.triggers).toEqual(['instructions-changed', 'mission-changed']);
  for (const speed of [1, 2, 4] as const) {
    const replay = createReplay(imported);
    replay.dispatch({ type: 'set-speed', speed });
    replay.dispatch({ type: 'start' });
    replay.advanceWallTime(60_000);
    expect(replay.getSnapshot()).toEqual({ ...imported.results, speed });
    expect(replay.getDecisions()).toEqual(imported.decisions);
    expect(replay.getRecord().events).toEqual(imported.events);
  }
  expect(inputs).toHaveLength(2);
  expect(exportExpeditionRecord(imported)).toBe(json);
  for (const mutate of [
    (record: typeof imported) => { delete record.startingConditions.decisionCadence; },
    (record: typeof imported) => { delete record.decisions[0]!.input.decisionBoundary; },
    (record: typeof imported) => { record.decisions[0]!.input.decisionBoundary!.triggers = []; },
    (record: typeof imported) => { record.decisions[0]!.input.decisionBoundary!.triggers.push('start'); },
    (record: typeof imported) => { record.decisions[0]!.reason = 'sample-inspected'; },
    (record: typeof imported) => { record.version = 6; },
  ]) {
    const invalid = structuredClone(imported);
    mutate(invalid);
    expect(() => importExpeditionRecord(JSON.stringify(invalid))).toThrow('Invalid expedition record');
  }
});

test('version 6 keeps its original terrain-discovery cadence and trigger meaning during replay', async () => {
  // Captured from ticket 05 HEAD 0d0081e before changing the simulator.
  const record = importExpeditionRecord(await Bun.file(new URL('./fixtures/legacy-cadence-v6.json', import.meta.url)).text());
  const json = exportExpeditionRecord(record);
  expect(record.version).toBe(6);
  expect(record.decisions.some(decision => decision.reason === 'new-observations')).toBe(true);
  expect(record.decisions.every(decision => !decision.input.decisionBoundary)).toBe(true);
  const replay = createReplay(record);
  replay.dispatch({ type: 'start' });
  replay.advanceWallTime(300_000);
  expect(replay.getSnapshot()).toEqual(record.results);
  expect(replay.getDecisions()).toEqual(record.decisions);
  expect(exportExpeditionRecord(record)).toBe(json);
});

test('entering and leaving a known storm each request one choice with the changed effects', async () => {
  const scenario: Scenario = { ...corridor, width: 10, sensorRange: 10,
    dustStorm: { position: { x: 4, z: 0 }, radius: 1, durationMs: 60_000, sensorRange: 1, movementEnergyMultiplier: 3 },
    samples: [{ id: 'a', label: 'Specimen', position: { x: 8, z: 0 }, properties: ['Layered sediment'],
      classifications: { 'past-water': 'strong-evidence', 'unusual-minerals': 'unrelated' } }],
  };
  const { expedition, inputs } = serviceRun(scenario, input => input.candidates.find(candidate => candidate.kind === 'inspect')!.id);
  expedition.dispatch({ type: 'introduce-storm' });
  expedition.dispatch({ type: 'start' });
  await settle(expedition);
  expedition.advanceWallTime(12_000);
  await settle(expedition);
  expect(inputs).toHaveLength(2);
  expect(inputs[1]).toMatchObject({ atMs: 12_000, sensorRange: 1, position: { x: 3, z: 0 },
    decisionBoundary: { triggers: ['storm-effects-changed'] } });
  expedition.advanceWallTime(12_000);
  await settle(expedition);
  expect(inputs).toHaveLength(3);
  expect(inputs[2]).toMatchObject({ atMs: 24_000, sensorRange: 10, position: { x: 6, z: 0 },
    decisionBoundary: { triggers: ['storm-effects-changed'] } });
  expect(expedition.getSnapshot().inferenceAttempts).toBe(3);
  expedition.dispatch({ type: 'stop' });
});

test('a pending start remains the first trigger when an introduced storm immediately changes effects', async () => {
  const requests: { input: ControllerInput; resolve: (id: string) => void }[] = [];
  const expedition = createExpedition({ scenario: { ...corridor,
    dustStorm: { position: { x: 0, z: 0 }, radius: 1, durationMs: 5_000, sensorRange: 1, movementEnergyMultiplier: 3 },
  }, controller: { id: 'scripted', decide: input => new Promise<string>(resolve => { requests.push({ input, resolve }); }) } });
  expedition.dispatch({ type: 'start' });
  expedition.dispatch({ type: 'introduce-storm' });
  requests[0]!.resolve('wait:5000');
  await Promise.resolve();
  expect(requests).toHaveLength(2);
  expect(requests[1]!.input.decisionBoundary?.triggers).toEqual(['start', 'storm-effects-changed', 'storm-detected']);
  requests[1]!.resolve('wait:5000');
  await Promise.resolve();
  expedition.dispatch({ type: 'stop' });
  expect(() => createReplay(expedition.getCompletedRecords()[0]!)).not.toThrow();
});
