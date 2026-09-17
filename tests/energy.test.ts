import { expect, test } from 'bun:test';
import { createExpedition } from '../src/simulation/expedition';
import type { Scenario } from '../src/simulation/types';

const corridor: Scenario = {
  id: 'energy-corridor', name: 'Energy corridor', width: 5, depth: 1,
  base: { x: 0, z: 0 }, sensorRange: 1, obstacles: [], roughTerrain: [], samples: [],
};

test('movement consumes energy by distance and terrain while waiting consumes only time', () => {
  for (const [roughTerrain, travelMs, cost] of [[[], 4_000, 2], [[{ x: 1, z: 0 }], 8_000, 4]] as const) {
    const expedition = createExpedition({ scenario: { ...corridor, roughTerrain: [...roughTerrain] } });
    expect(expedition.getSnapshot()).toMatchObject({ battery: 100, batteryCapacity: 100, energyUsed: 0 });
    expedition.dispatch({ type: 'start' });
    expect(expedition.getSnapshot().currentAction).toMatchObject({ routeEstimate: { energy: cost } });
    expedition.advanceWallTime(travelMs / 2);
    expect(expedition.getSnapshot().battery).toBeCloseTo(100 - cost / 2);
    expect(expedition.getSnapshot().energyUsed).toBeCloseTo(cost / 2);
    expect(expedition.getSnapshot().rover.distance).toBeCloseTo(0.5);
    expedition.advanceWallTime(travelMs / 2);
    const arrived = expedition.getSnapshot();
    expect(arrived).toMatchObject({ battery: 100 - cost, energyUsed: cost, currentAction: { kind: 'wait' } });
    expedition.advanceWallTime(4_900);
    expect(expedition.getSnapshot()).toMatchObject({ battery: arrived.battery, energyUsed: arrived.energyUsed, rover: arrived.rover });
    const energyEvents = expedition.getRecord().events.filter(event => event.type === 'energy-changed');
    expect(energyEvents.at(-1)).toMatchObject({ atMs: travelMs, source: 'movement', battery: 100 - cost, energyUsed: cost });
  }
});

const deliveryScenario: Scenario = {
  ...corridor, width: 9, sensorRange: 8,
  samples: [3, 6, 8].map((x, index) => ({
    id: String(index), label: `Sample ${index}`, position: { x, z: 0 }, properties: ['Layered sediment'],
    classifications: { 'past-water': 'strong-evidence', 'unusual-minerals': 'unrelated' },
  })),
};

test('a baseline expedition unloads, recharges separately, and makes another delivery', () => {
  const expedition = createExpedition({ scenario: deliveryScenario });
  expedition.dispatch({ type: 'start' });
  expedition.advanceWallTime(68_000);
  expect(expedition.getSnapshot()).toMatchObject({
    battery: 76, energyUsed: 24, cargo: [], scienceScore: 20,
    currentAction: { kind: 'recharge', durationMs: 4_800 }, rover: { position: { x: 0, z: 0 } },
  });
  expedition.advanceWallTime(4_700);
  expect(expedition.getSnapshot()).toMatchObject({ battery: 99.5, energyUsed: 24, currentAction: { kind: 'recharge' } });
  expedition.dispatch({ type: 'pause' });
  const paused = expedition.getSnapshot();
  expedition.advanceWallTime(60_000);
  expect(expedition.getSnapshot()).toEqual(paused);
  expedition.dispatch({ type: 'resume' });
  expedition.advanceWallTime(100);
  expect(expedition.getSnapshot()).toMatchObject({ battery: 100, energyUsed: 24, currentAction: { kind: 'inspect', target: { id: '2' } } });
  expedition.advanceWallTime(227_200);
  expect(expedition.getSnapshot()).toMatchObject({
    status: 'ended', endingCondition: 'timeout', battery: 100, energyUsed: 56,
    scienceScore: 30, discoveryCount: 3, inspectionCount: 3, cargo: [],
  });
  const record = expedition.getRecord();
  expect(record.events.filter(event => event.type === 'samples-delivered')).toMatchObject([
    { atMs: 68_000, scienceScore: 20 }, { atMs: 146_800, scienceScore: 30 },
  ]);
  const decisions = record.events.filter(event => event.type === 'decision-made');
  expect(decisions.every(event => event.controller === 'baseline')).toBe(true);
  for (const decision of decisions) {
    expect(decision.input.candidates.some(action => action.kind === 'recharge'))
      .toBe(decision.input.position.x === 0 && decision.input.battery < 100);
  }
  const resources = record.events.filter(event => event.type === 'energy-changed');
  expect(resources.every(event => event.battery >= 0 && event.battery <= 100)).toBe(true);
  expect(record.startingConditions).toMatchObject({ batteryCapacity: 100, initialBattery: 100, rechargePerSecond: 5 });
  expedition.dispatch({ type: 'reset' });
  expect(expedition.getSnapshot()).toEqual(createExpedition({ scenario: deliveryScenario }).getSnapshot());
});

test('an unaffordable route remains a choice and strands the rover with uncredited cargo', () => {
  const expedition = createExpedition({ scenario: {
    ...deliveryScenario, width: 54, sensorRange: 53,
    samples: deliveryScenario.samples.slice(0, 2).map((sample, index) => ({ ...sample, position: { x: index ? 52 : 1, z: 0 } })),
  } });
  expedition.dispatch({ type: 'start' });
  expedition.advanceWallTime(14_000);
  const decision = expedition.getRecord().events.filter(event => event.type === 'decision-made').at(-1)!;
  expect(decision.input).toMatchObject({ battery: 98, cargo: [{ sampleId: '0' }] });
  expect(decision.action).toMatchObject({ kind: 'inspect', target: { id: '1' }, routeEstimate: { energy: 102 } });
  expedition.advanceWallTime(300_000);
  expect(expedition.getSnapshot()).toMatchObject({
    status: 'ended', endingCondition: 'stranded', elapsedMs: 210_000,
    battery: 0, energyUsed: 100, currentAction: null, rover: { position: { x: 50, z: 0 } },
    cargo: [{ sampleId: '0' }], scienceScore: 0, inspectionCount: 1, deliveredSamples: [],
  });
  const events = expedition.getRecord().events;
  expect(events.slice(-2)).toMatchObject([
    { type: 'action-cancelled', action: { kind: 'inspect', target: { id: '1' } }, controller: 'baseline' },
    { type: 'ended', condition: 'stranded' },
  ]);
  expect(events.filter(event => event.type === 'energy-changed').every(event => event.battery >= 0)).toBe(true);
  const ended = expedition.getSnapshot();
  expedition.advanceWallTime(300_000);
  expect(expedition.getSnapshot()).toEqual(ended);
  expedition.dispatch({ type: 'reset' });
  expect(expedition.getSnapshot()).toMatchObject({ status: 'ready', battery: 100, energyUsed: 0, cargo: [], endingCondition: null });
});

test('the baseline chooses an energy return and an empty battery can recharge at base', () => {
  const expedition = createExpedition({ scenario: {
    ...deliveryScenario, width: 26, sensorRange: 25,
    samples: [{ ...deliveryScenario.samples[0]!, position: { x: 25, z: 0 } }],
  } });
  expedition.dispatch({ type: 'start' });
  expedition.advanceWallTime(106_000);
  expect(expedition.getSnapshot()).toMatchObject({
    battery: 50, inspectionCount: 1, cargo: [], currentAction: { kind: 'return-to-base' },
  });
  expedition.advanceWallTime(100_000);
  expect(expedition.getSnapshot()).toMatchObject({
    status: 'running', battery: 0, energyUsed: 100, rover: { position: { x: 0, z: 0 } },
    currentAction: { kind: 'recharge', durationMs: 20_000 },
  });
  const emptyDecision = expedition.getRecord().events.filter(event => event.type === 'decision-made').at(-1)!;
  expect(emptyDecision.input.candidates.some(action => 'target' in action && action.routeEstimate.energy > 0)).toBe(false);
  expedition.advanceWallTime(19_900);
  expect(expedition.getSnapshot().battery).toBe(99.5);
  expedition.advanceWallTime(100);
  expect(expedition.getSnapshot()).toMatchObject({ battery: 100, energyUsed: 100, currentAction: { kind: 'collect' } });
});

test('timeout cancels an unfinished inspection without revealing properties or earning more science', () => {
  const expedition = createExpedition({ scenario: {
    ...deliveryScenario, width: 50, sensorRange: 49,
    samples: deliveryScenario.samples.map((sample, index) => ({ ...sample, position: { x: [7, 9, 49][index]!, z: 0 } })),
  } });
  expedition.dispatch({ type: 'start' });
  expedition.advanceWallTime(295_200);
  expect(expedition.getSnapshot()).toMatchObject({
    battery: 2, scienceScore: 20, inspectionCount: 2, currentAction: { kind: 'inspect', target: { id: '2' } },
    rover: { position: { x: 49, z: 0 } },
  });
  expedition.advanceWallTime(4_800);
  expect(expedition.getSnapshot()).toMatchObject({
    status: 'ended', endingCondition: 'timeout', battery: 2, energyUsed: 134, inspectionCount: 2, scienceScore: 20,
  });
  expect(expedition.getSnapshot().memory.find(item => item.kind === 'sample' && item.sampleId === '2')).not.toHaveProperty('properties');
  expect(expedition.getRecord().events.at(-2)).toMatchObject({ type: 'action-cancelled', action: { kind: 'inspect' } });
});

test('timeout retains only energy actually recharged, and reset during recharge restores resources', () => {
  const scenario = { ...corridor, width: 26, samples: [{ ...deliveryScenario.samples[0]!, position: { x: 22, z: 0 } }] };
  const expedition = createExpedition({ scenario });
  expedition.dispatch({ type: 'start' });
  expedition.advanceWallTime(291_000);
  expect(expedition.getSnapshot()).toMatchObject({ battery: 12, scienceScore: 10, currentAction: { kind: 'recharge' } });
  expedition.advanceWallTime(9_000);
  expect(expedition.getSnapshot()).toMatchObject({
    status: 'ended', endingCondition: 'timeout', battery: 57, energyUsed: 88, scienceScore: 10,
  });
  expect(expedition.getRecord().events.at(-2)).toMatchObject({ type: 'action-cancelled', action: { kind: 'recharge' } });
  expedition.dispatch({ type: 'reset' });
  expedition.dispatch({ type: 'start' });
  expedition.advanceWallTime(295_000);
  expect(expedition.getSnapshot().battery).toBe(32);
  expedition.dispatch({ type: 'reset' });
  expect(expedition.getSnapshot()).toEqual(createExpedition({ scenario }).getSnapshot());
});
