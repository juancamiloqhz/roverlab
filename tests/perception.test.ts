import { expect, test } from 'bun:test';
import { createExpedition } from '../src/simulation/expedition';
import type { Action, Observation, Scenario } from '../src/simulation/types';

const classifications = { 'past-water': 'unrelated', 'unusual-minerals': 'unrelated' } as const;

test('a controller receives only sensed terrain, objects, and routes through the known map', () => {
  const expedition = createExpedition({ scenario: {
    id: 'sensor-boundary', name: 'Sensor boundary', width: 5, depth: 1,
    base: { x: 0, z: 0 }, sensorRange: 1,
    obstacles: [{ x: 4, z: 0 }], roughTerrain: [{ x: 3, z: 0 }],
    samples: [
      { id: 'visible', label: 'Sample A', position: { x: 1, z: 0 }, properties: ['secret mineral'], classifications },
      { id: 'hidden', label: 'Sample B', position: { x: 3, z: 0 }, properties: ['secret layers'], classifications },
    ],
  } });
  expedition.dispatch({ type: 'start' });
  const decision = expedition.getRecord().events.find(event => event.type === 'decision-made');
  const observations: Observation[] = [
    { kind: 'terrain', id: 'cell:0,0', position: { x: 0, z: 0 }, terrain: 'plain', blocked: false, observedAtMs: 0 },
    { kind: 'terrain', id: 'cell:1,0', position: { x: 1, z: 0 }, terrain: 'plain', blocked: false, observedAtMs: 0 },
    { kind: 'base', id: 'base', position: { x: 0, z: 0 }, observedAtMs: 0 },
    { kind: 'sample', id: 'sample:visible', sampleId: 'visible', label: 'Sample A', position: { x: 1, z: 0 }, observedAtMs: 0, status: 'available' },
  ];
  const explore: Action = {
    kind: 'explore', target: { id: 'frontier:1,0', label: 'Frontier 1 / 0', position: { x: 1, z: 0 } },
    routeEstimate: { distanceCells: 1, durationMs: 4_000, energy: 2 },
  };
  const inspect: Action = {
    kind: 'inspect', target: { id: 'visible', label: 'Sample A', position: { x: 1, z: 0 } },
    routeEstimate: { distanceCells: 1, durationMs: 4_000, energy: 2 },
  };
  expect(decision).toMatchObject({
    type: 'decision-made', controller: 'baseline', action: inspect,
  });
  if (decision?.type !== 'decision-made') throw new Error('Missing controller input');
  expect(decision.input).toEqual({
    mission: { version: 0, preferences: { mode: 'free-text', instructions: '' } },
    instructions: '', instructionsVersion: 0, remainingMs: 300_000, energyUsed: 0,
    battery: 100, batteryCapacity: 100,
    atMs: 0, position: { x: 0, z: 0 }, sensorRange: 1,
    objective: 'past-water', cargo: [], cargoCapacity: 2,
    observations, memory: observations, previousAction: null,
    candidates: [{ ...explore, id: 'explore:frontier:1,0' }, { ...inspect, id: 'inspect:visible' }, { ...inspect, kind: 'collect', id: 'collect:visible' }, { kind: 'wait', durationMs: 5_000, id: 'wait:5000' }],
  });
  expect(expedition.getSnapshot().observations).toEqual(observations);
});

test('sensing during travel retains last-seen times outside range and reset starts fresh', () => {
  const expedition = createExpedition({ scenario: {
    id: 'memory', name: 'Memory corridor', width: 8, depth: 1,
    base: { x: 0, z: 0 }, sensorRange: 1, obstacles: [], roughTerrain: [],
    samples: [],
  } });
  const initial = expedition.getSnapshot();
  expedition.dispatch({ type: 'start' });
  expedition.advanceWallTime(4_000);
  expect(expedition.getSnapshot().observations.find(item => item.id === 'cell:2,0')).toMatchObject({ observedAtMs: 4_000 });
  expedition.advanceWallTime(9_100);
  const moving = expedition.getSnapshot();
  expect(moving.rover.position).toEqual({ x: 2, z: 0 });
  expect(moving.observations.some(item => item.kind === 'base')).toBe(false);
  expect(moving.memory.find(item => item.kind === 'base')).toMatchObject({ observedAtMs: 9_000 });
  expedition.advanceWallTime(8_900);
  const away = expedition.getSnapshot();
  expect(away.observations.some(item => item.kind === 'sample')).toBe(false);
  expect(away.memory.find(item => item.id === 'cell:1,0')).toMatchObject({ observedAtMs: 18_000 });
  expect(away.observations.every(item => item.observedAtMs === 22_000)).toBe(true);
  const discoveries = expedition.getRecord().events.filter(event => event.type === 'discovered');
  expect(discoveries.flatMap(event => event.observations).filter(item => item.id === 'cell:2,0'))
    .toEqual([{ kind: 'terrain', id: 'cell:2,0', position: { x: 2, z: 0 }, terrain: 'plain', blocked: false, observedAtMs: 4_000 }]);
  expedition.dispatch({ type: 'reset' });
  expect(expedition.getSnapshot()).toEqual(initial);
  expedition.dispatch({ type: 'start' });
  expedition.advanceWallTime(22_000);
  expect(expedition.getSnapshot()).toEqual(away);
});

test('known rough terrain affects both the route estimate and executed travel time', () => {
  const expedition = createExpedition({ scenario: {
    id: 'rough', name: 'Rough corridor', width: 5, depth: 1,
    base: { x: 0, z: 0 }, sensorRange: 1, obstacles: [],
    roughTerrain: [{ x: 1, z: 0 }], samples: [],
  } });
  expedition.dispatch({ type: 'start' });
  expect(expedition.getSnapshot().currentAction).toMatchObject({ routeEstimate: { distanceCells: 1, durationMs: 8_000 } });
  expedition.advanceWallTime(4_000);
  expect(expedition.getSnapshot().rover.position).toEqual({ x: 0.5, z: 0 });
  expect(expedition.getSnapshot().rover.distance).toBeCloseTo(0.5);
  expedition.advanceWallTime(4_000);
  expect(expedition.getSnapshot().rover.position).toEqual({ x: 1, z: 0 });
  expect(expedition.getSnapshot().currentAction?.kind).toBe('wait');
});

test('a newly detected wall blocks exploration without revealing or entering its far side', () => {
  const expedition = createExpedition({ scenario: {
    id: 'wall', name: 'Blocked area', width: 7, depth: 3, base: { x: 1, z: 1 }, sensorRange: 1,
    obstacles: [{ x: 3, z: 0 }, { x: 3, z: 1 }, { x: 3, z: 2 }], roughTerrain: [],
    samples: [{ id: 'hidden', label: 'Hidden sample', position: { x: 6, z: 1 }, properties: ['hidden'], classifications }],
  } });
  // A diagonal cell is outside a radius of one; all four cardinal neighbors are sensed.
  expect(expedition.getSnapshot().observations.filter(item => item.kind === 'terrain').map(item => item.position))
    .toEqual([{ x: 1, z: 0 }, { x: 0, z: 1 }, { x: 1, z: 1 }, { x: 2, z: 1 }, { x: 1, z: 2 }]);
  expedition.dispatch({ type: 'start' });
  const invalidPositions = [];
  for (let step = 0; step < 3_000; step++) {
    expedition.advanceWallTime(100);
    const { rover } = expedition.getSnapshot();
    if (rover.position.x > 2 || rover.position.x < 0 || rover.position.z < 0 || rover.position.z > 2) invalidPositions.push(rover.position);
  }
  expect(invalidPositions).toEqual([]);
  const record = expedition.getRecord();
  expect(record.events.filter(event => event.type === 'discovered').flatMap(event => event.observations))
    .toContainEqual({ kind: 'terrain', id: 'cell:3,1', position: { x: 3, z: 1 }, blocked: true, terrain: 'plain', observedAtMs: 4_000 });
  const decisions = record.events.filter(event => event.type === 'decision-made');
  expect(expedition.getSnapshot().rover.position).toEqual({ x: 1, z: 1 });
  expect(decisions.at(-1)?.input.candidates.map(action => action.kind)).toEqual(['wait']);
  expect(decisions.flatMap(event => event.input.candidates).filter(action => action.kind === 'explore').every(action => action.target.position.x < 3)).toBe(true);
  expect(expedition.getSnapshot().memory.some(item => item.kind === 'sample')).toBe(false);
});

test('changing hidden world truth cannot change controller inputs or route availability', () => {
  const scenario: Scenario = {
    id: 'hidden-world', name: 'Hidden world', width: 7, depth: 1,
    base: { x: 0, z: 0 }, sensorRange: 1, obstacles: [], roughTerrain: [],
    samples: [{ id: 'a', label: 'Sample A', position: { x: 1, z: 0 }, properties: ['secret'], classifications }],
  };
  const changed = structuredClone(scenario);
  changed.obstacles = [{ x: 4, z: 0 }];
  changed.roughTerrain = [{ x: 5, z: 0 }];
  changed.samples[0]!.properties = ['different secret'];
  changed.samples[0]!.classifications['past-water'] = 'strong-evidence';
  changed.samples.push({ id: 'hidden', label: 'Hidden sample', position: { x: 6, z: 0 }, properties: ['hidden'], classifications });
  const run = (world: Scenario) => {
    const expedition = createExpedition({ scenario: world });
    expedition.dispatch({ type: 'start' });
    expedition.advanceWallTime(9_000);
    return expedition;
  };
  const first = run(scenario);
  const second = run(changed);
  expect(first.getRecord().startingConditions).not.toEqual(second.getRecord().startingConditions);
  expect(first.getSnapshot()).toEqual(second.getSnapshot());
  expect(first.getRecord().events).toEqual(second.getRecord().events);
  // Both reading and mutating detached records must leave future sensing and decisions alone.
  const record = second.getRecord();
  record.startingConditions.scenario.obstacles.push({ x: 2, z: 0 });
  record.events.length = 0;
  const snapshot = second.getSnapshot();
  snapshot.memory.length = 0;
  changed.obstacles.push({ x: 2, z: 0 });
  first.advanceWallTime(900);
  second.advanceWallTime(900);
  expect(first.getSnapshot()).toEqual(second.getSnapshot());
  expect(first.getRecord().events).toEqual(second.getRecord().events);
});
