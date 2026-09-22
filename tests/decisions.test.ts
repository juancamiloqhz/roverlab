import { expect, test } from 'bun:test';
import { chooseBaselineAction } from '../src/controllers/baseline';
import type { ControllerInput } from '../src/simulation/types';
import { createExpedition } from '../src/simulation/expedition';

test('mission instructions enter baseline context and recorded edits without changing the objective or rubric', () => {
  const expedition = createExpedition();
  expedition.dispatch({ type: 'set-instructions', instructions: 'Prioritize evidence of past water.' });
  expedition.dispatch({ type: 'start' });
  const decision = expedition.getRecord().events.find(event => event.type === 'decision-made')!;
  expect(decision.input).toMatchObject({ instructions: 'Prioritize evidence of past water.', instructionsVersion: 1, objective: 'past-water' });
  expect(expedition.getDecisions()[0]).toMatchObject({ controller: 'baseline', status: 'applied', input: decision.input, action: decision.action });
  expedition.dispatch({ type: 'set-instructions', instructions: 'Preserve energy.' });
  expect(expedition.getSnapshot()).toMatchObject({ instructions: 'Preserve energy.', instructionsVersion: 2, objective: 'past-water', rubric: { unrelated: 0, suggestive: 5, 'strong-evidence': 10 } });
  expect(expedition.getRecord().events.filter(event => event.type === 'instructions-changed')).toMatchObject([
    { instructions: 'Prioritize evidence of past water.', version: 1, atMs: 0 },
    { instructions: 'Preserve energy.', version: 2, atMs: 0 },
  ]);
});

test('a delayed decision freezes modeled evolution and resumes with its supplied candidate despite rendering and speed changes', async () => {
  let resolve!: (id: string) => void;
  let candidateId = '';
  const expedition = createExpedition({ controller: {
    id: 'scripted',
    decide(input) {
      candidateId = input.candidates.find(action => action.kind === 'explore')!.id;
      return new Promise<string>(done => { resolve = done; });
    },
  } });
  expedition.dispatch({ type: 'start' });
  const pending = expedition.getSnapshot();
  expect(pending.decisionPending).toBe(true);
  expedition.advanceWallTime(60_000);
  expect(expedition.getSnapshot()).toEqual(pending);
  expedition.dispatch({ type: 'set-speed', speed: 2 });
  expedition.getSnapshot().memory.length = 0;
  resolve(candidateId);
  await Promise.resolve();
  expect(expedition.getSnapshot().decisionPending).toBe(false);
  expect(expedition.getSnapshot().currentAction?.kind).toBe('explore');
  expect(expedition.getDecisions()[0]).toMatchObject({ controller: 'scripted', status: 'applied', selectedCandidateId: candidateId });
  expedition.advanceWallTime(500);
  expect(expedition.getSnapshot()).toMatchObject({ elapsedMs: 1_000, battery: 99.5, energyUsed: 0.5 });
});

test('instruction edits interrupt travel at its next waypoint and the replacement decision sees the latest instructions', async () => {
  let resolve!: (id: string) => void;
  const expedition = createExpedition({ controller: {
    id: 'scripted',
    decide(input) {
      if (input.instructionsVersion === 0) return input.candidates.find(action => action.kind === 'explore' && action.target.position.x === 6 && action.target.position.z === 13)!.id;
      return new Promise<string>(done => { resolve = done; });
    },
  } });
  expedition.dispatch({ type: 'start' });
  expedition.advanceWallTime(1_000);
  const action = expedition.getSnapshot().currentAction;
  expedition.dispatch({ type: 'set-instructions', instructions: 'Return conservatively.' });
  expedition.advanceWallTime(2_900);
  expect(expedition.getSnapshot().currentAction).toEqual(action);
  expect(expedition.getDecisions()).toHaveLength(1);
  expedition.advanceWallTime(100);
  expect(expedition.getSnapshot()).toMatchObject({ decisionPending: true, currentAction: null, elapsedMs: 4_000, rover: { position: { x: 4, z: 13 } } });
  const decision = expedition.getDecisions()[1]!;
  expect(decision.input.instructions).toBe('Return conservatively.');
  expect(expedition.getRecord().events.filter(event => event.type === 'action-cancelled')).toMatchObject([{ atMs: 4_000, action }]);
  resolve(decision.input.candidates.find(candidate => candidate.kind === 'return-to-base')!.id);
  await Promise.resolve();
  expedition.advanceWallTime(4_000);
  expect(expedition.getSnapshot().rover.position).toEqual({ x: 3, z: 13 });
});

test('new samples prompt a decision at the next waypoint while routine terrain and refreshed observations do not', () => {
  const scenario = { id: 'decisions', name: 'Decision corridor', width: 8, depth: 1, base: { x: 0, z: 0 }, sensorRange: 2, obstacles: [], roughTerrain: [], samples: [{ id: 'new', label: 'New sample', position: { x: 3, z: 0 }, properties: ['Layered sediment'], classifications: { 'past-water': 'strong-evidence' as const, 'unusual-minerals': 'unrelated' as const } }] };
  const expedition = createExpedition({ scenario });
  expedition.dispatch({ type: 'start' });
  expedition.advanceWallTime(3_900);
  expect(expedition.getDecisions()).toHaveLength(1);
  expedition.advanceWallTime(100);
  const decisions = expedition.getDecisions();
  expect(decisions).toHaveLength(2);
  expect(decisions[1]!.input.decisionBoundary?.triggers).toEqual(['sample-discovered']);
  expect(decisions[1]!.input.position).toEqual({ x: 1, z: 0 });
  expect(decisions[1]!.input.memory.find(item => item.id === 'cell:3,0')?.observedAtMs).toBe(4_000);

  const known = createExpedition({ scenario: { ...scenario, sensorRange: 8, samples: [{ id: 'a', label: 'Sample A', position: { x: 7, z: 0 }, properties: ['Layered sediment'], classifications: { 'past-water': 'strong-evidence', 'unusual-minerals': 'unrelated' } }] } });
  known.dispatch({ type: 'start' });
  known.advanceWallTime(12_000);
  expect(known.getDecisions()).toHaveLength(1);
  expect(known.getSnapshot().rover.position).toEqual({ x: 3, z: 0 });
});

test.each(['set-instructions', 'reset', 'stop'] as const)('%s discards a pending result and never overlaps controller requests', async command => {
  const responses: { input: ControllerInput; resolve: (id: string) => void }[] = [];
  const expedition = createExpedition({ controller: { id: 'scripted', decide: input => new Promise<string>(resolve => { responses.push({ input, resolve }); }) } });
  expedition.dispatch({ type: 'start' });
  if (command === 'set-instructions') {
    expedition.dispatch({ type: command, instructions: 'First edit' });
    expedition.dispatch({ type: command, instructions: 'Latest edit' });
  } else {
    expedition.dispatch({ type: command });
    if (command === 'reset') expedition.dispatch({ type: 'start' });
  }
  expedition.advanceWallTime(90_000);
  expect(responses).toHaveLength(1);
  responses[0]!.resolve(responses[0]!.input.candidates[0]!.id);
  await Promise.resolve();
  expect(expedition.getSnapshot().currentAction).toBeNull();
  expect(expedition.getRecord().events.filter(event => event.type === 'action-started')).toHaveLength(0);
  expect(expedition.getRecord().events.filter(event => event.type === 'decision-discarded')).toHaveLength(1);
  if (command === 'stop') {
    expect(responses).toHaveLength(1);
    expect(expedition.getSnapshot().status).toBe('ended');
  } else {
    expect(responses).toHaveLength(2);
    expect(responses[1]!.input.instructions).toBe(command === 'reset' ? '' : 'Latest edit');
    responses[1]!.resolve(responses[1]!.input.candidates.find(action => action.kind === 'wait')!.id);
    await Promise.resolve();
    expedition.advanceWallTime(1_000);
    expect(expedition.getSnapshot().elapsedMs).toBe(1_000);
    expect(expedition.getSnapshot().currentAction?.kind).toBe('wait');
  }
});

test('instruction changes during inspection finish the short interaction before reconsidering, and reset retains instructions', () => {
  const expedition = createExpedition({ scenario: {
    id: 'inspection', name: 'Inspection', width: 1, depth: 1, base: { x: 0, z: 0 }, sensorRange: 1, obstacles: [], roughTerrain: [],
    samples: [{ id: 'a', label: 'Sample A', position: { x: 0, z: 0 }, properties: ['Layered sediment'], classifications: { 'past-water': 'strong-evidence', 'unusual-minerals': 'unrelated' } }],
  } });
  expedition.dispatch({ type: 'start' });
  expedition.advanceWallTime(1_000);
  expedition.dispatch({ type: 'set-instructions', instructions: 'Save this sample.' });
  expedition.advanceWallTime(4_900);
  expect(expedition.getDecisions()).toHaveLength(1);
  expect(expedition.getSnapshot().inspectionCount).toBe(0);
  expedition.advanceWallTime(100);
  const snapshot = expedition.getSnapshot();
  expect(snapshot.inspectionCount).toBe(1);
  expect(expedition.getDecisions()[1]!.input.instructions).toBe('Save this sample.');
  expect(expedition.getDecisions()[1]!.input.memory.find(item => item.kind === 'sample')).toMatchObject({ properties: ['Layered sediment'], inspectedAtMs: 6_000 });
  expect(expedition.getDecisions()[0]!.input.memory.find(item => item.kind === 'sample')).not.toHaveProperty('properties');
  expedition.dispatch({ type: 'reset' });
  expect(expedition.getSnapshot().instructions).toBe('Save this sample.');
  expect(expedition.getDecisions()).toHaveLength(0);
  expect(expedition.getRecord().events.filter(event => event.type === 'reset').at(-1)).toMatchObject({ instructions: 'Save this sample.', expedition: 2 });
});

test('an invented candidate is rejected and a controller cannot modify its offered action or recorded input', () => {
  const expedition = createExpedition({ controller: { id: 'scripted', decide(input) {
    const action = input.candidates.find(action => action.kind === 'explore')!;
    action.id = 'invented';
    action.target.position = { x: 999, z: 999 };
    input.memory.length = 0;
    return action.id;
  } } });
  expedition.dispatch({ type: 'start' });
  expect(expedition.getSnapshot().status).toBe('paused');
  expect(expedition.getSnapshot().currentAction).toBeNull();
  expect(expedition.getDecisions()[0]!.status).toBe('invalid');
  expect(expedition.getDecisions()[0]!.input.memory.length).toBeGreaterThan(0);
  expedition.advanceWallTime(5_000);
  expect(expedition.getSnapshot().elapsedMs).toBe(0);
  expect(expedition.getRecord().events.some(event => event.type === 'action-started')).toBe(false);
});

test('a valid response received during manual pause does not resume expedition time', async () => {
  let resolve!: (id: string) => void;
  const expedition = createExpedition({ controller: { id: 'scripted', decide: () => new Promise<string>(done => { resolve = done; }) } });
  expedition.dispatch({ type: 'start' });
  expedition.dispatch({ type: 'pause' });
  resolve('wait:5000');
  await Promise.resolve();
  expedition.advanceWallTime(20_000);
  expect(expedition.getSnapshot()).toMatchObject({ status: 'paused', elapsedMs: 0, currentAction: { kind: 'wait' } });
  expedition.dispatch({ type: 'resume' });
  expedition.advanceWallTime(1_000);
  expect(expedition.getSnapshot().elapsedMs).toBe(1_000);
});


test('identical selections preserve resources and science across response delays and playback speeds', async () => {
  const run = async (speed: 1 | 4, delayMs: number) => {
    let respond!: () => void;
    const expedition = createExpedition({ scenario: {
      id: 'delay-comparison', name: 'Delay comparison', width: 4, depth: 1, base: { x: 0, z: 0 }, sensorRange: 4, obstacles: [], roughTerrain: [],
      samples: [{ id: 'a', label: 'Sample A', position: { x: 3, z: 0 }, properties: ['Layered sediment'], classifications: { 'past-water': 'strong-evidence', 'unusual-minerals': 'unrelated' } }],
    }, controller: { id: 'scripted', decide: input => new Promise<string>(resolve => { respond = () => resolve(chooseBaselineAction(input).id); }) } });
    expedition.dispatch({ type: 'set-speed', speed });
    expedition.dispatch({ type: 'start' });
    while (expedition.getSnapshot().elapsedMs < 60_000) {
      if (expedition.getSnapshot().decisionPending) {
        const frozen = expedition.getSnapshot();
        expedition.advanceWallTime(delayMs);
        expect(expedition.getSnapshot()).toEqual(frozen);
        respond();
        await Promise.resolve();
      }
      expedition.advanceWallTime(100 / speed);
    }
    const snapshot = expedition.getSnapshot();
    expect(snapshot.scienceScore).toBe(10);
    expect(snapshot.energyUsed).toBe(12);
    expect(snapshot.battery).toBe(100);
    return { ...snapshot, speed: 1 };
  };
  expect(await run(4, 60_000)).toEqual(await run(1, 0));
});
