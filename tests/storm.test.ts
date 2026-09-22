import { expect, test } from 'bun:test';
import { createFirstPlayableExpedition as createExpedition } from './fixtures/first-playable-session';
import type { ControllerInput, Scenario } from '../src/simulation/types';

const corridor: Scenario = {
  id: 'storm-corridor', name: 'Storm corridor', width: 10, depth: 1,
  base: { x: 0, z: 0 }, sensorRange: 1, obstacles: [], roughTerrain: [], samples: [],
  dustStorm: { position: { x: 5, z: 0 }, radius: 1.5, durationMs: 30_000, sensorRange: 0.5, movementEnergyMultiplier: 3 },
};
const east = (input: ControllerInput) => input.candidates
  .filter(action => action.kind === 'explore')
  .sort((a, b) => b.target.position.x - a.target.position.x)[0]?.id ?? 'wait:5000';

test('a hidden storm changes no controller knowledge until detection, then discloses its region and remaining time at the next waypoint', () => {
  const expedition = createExpedition({ scenario: corridor, controller: { id: 'scripted', decide: east } });
  const clear = createExpedition({ scenario: corridor, controller: { id: 'scripted', decide: east } });
  expedition.dispatch({ type: 'introduce-storm' });
  expect(expedition.getRecord().events.filter(event => event.type === 'storm-introduced')).toMatchObject([
    { atMs: 0, storm: { position: { x: 5, z: 0 }, radius: 1.5, expiresAtMs: 30_000 } },
  ]);
  for (const session of [expedition, clear]) {
    session.dispatch({ type: 'start' });
    session.advanceWallTime(8_000);
  }
  expect(expedition.getDecisions().map(decision => decision.input)).toEqual(clear.getDecisions().map(decision => decision.input));
  expect(expedition.getSnapshot().memory.some(item => item.kind === 'dust-storm')).toBe(false);
  const beforeDetection = expedition.getDecisions().length;
  expedition.advanceWallTime(2_000);
  expect(expedition.getSnapshot().observations.find(item => item.kind === 'dust-storm')).toMatchObject({
    position: { x: 5, z: 0 }, radius: 1.5, remainingMs: 20_000, expiresAtMs: 30_000,
    sensorRange: 0.5, movementEnergyMultiplier: 3, observedAtMs: 10_000,
  });
  expect(expedition.getDecisions()).toHaveLength(beforeDetection);
  expedition.advanceWallTime(2_000);
  expect(expedition.getDecisions().at(-1)).toMatchObject({
    reason: 'storm-detected', input: { position: { x: 3, z: 0 }, atMs: 12_000 },
  });
  expect(expedition.getRecord().events.filter(event => event.type === 'storm-detected')).toHaveLength(1);
  expect(expedition.getDecisions()[0]!.input.memory.some(item => item.kind === 'dust-storm')).toBe(false);
});


test('storm time and effects freeze during manual pause and pending decisions, expire on expedition time, and reset cleanly', async () => {
  const requests: { input: ControllerInput; resolve: (id: string) => void }[] = [];
  const expedition = createExpedition({ scenario: {
    ...corridor, width: 4, sensorRange: 3,
    dustStorm: { ...corridor.dustStorm!, position: { x: 0, z: 0 }, radius: 1, durationMs: 7_500, sensorRange: 1 },
  }, controller: { id: 'scripted', decide: input => new Promise<string>(resolve => requests.push({ input, resolve })) } });
  const initial = expedition.getSnapshot();
  expedition.dispatch({ type: 'introduce-storm' });
  expect(expedition.getSnapshot().sensorRange).toBe(1);
  expedition.dispatch({ type: 'start' });
  const pending = expedition.getSnapshot();
  expedition.advanceWallTime(60_000);
  expect(expedition.getSnapshot()).toEqual(pending);
  expedition.dispatch({ type: 'pause' });
  requests[0]!.resolve('wait:5000');
  await Promise.resolve();
  const paused = expedition.getSnapshot();
  expedition.advanceWallTime(60_000);
  expect(expedition.getSnapshot()).toEqual(paused);
  expedition.dispatch({ type: 'resume' });
  expedition.advanceWallTime(5_000);
  expect(requests[1]!.input.observations.find(item => item.kind === 'dust-storm')).toMatchObject({ remainingMs: 2_500 });
  const pendingAgain = expedition.getSnapshot();
  expedition.advanceWallTime(90_000);
  expect(expedition.getSnapshot()).toEqual(pendingAgain);
  requests[1]!.resolve('wait:5000');
  await Promise.resolve();
  expedition.advanceWallTime(2_500);
  expect(expedition.getSnapshot()).toMatchObject({ elapsedMs: 7_500, sensorRange: 3, battery: 100, energyUsed: 0 });
  expect(expedition.getSnapshot().observations.some(item => item.kind === 'dust-storm')).toBe(false);
  expect(expedition.getSnapshot().memory.find(item => item.kind === 'dust-storm')).toMatchObject({ remainingMs: 0, observedAtMs: 7_400 });
  expect(expedition.getRecord().events.filter(event => event.type === 'storm-expired')).toMatchObject([{ atMs: 7_500, detected: true }]);
  expect(expedition.getRecord().events.filter(event => event.type === 'storm-effects-changed')).toMatchObject([
    { atMs: 0, sensorRange: 1, movementEnergyMultiplier: 3 },
    { atMs: 7_500, sensorRange: 3, movementEnergyMultiplier: 1 },
  ]);
  expedition.dispatch({ type: 'reset' });
  expect(expedition.getSnapshot()).toEqual(initial);
});


const crossing: Scenario = {
  ...corridor, width: 5, sensorRange: 5,
  samples: [{ id: 'a', label: 'Sample A', position: { x: 4, z: 0 }, properties: ['Layered sediment'],
    classifications: { 'past-water': 'strong-evidence', 'unusual-minerals': 'unrelated' } }],
  dustStorm: { ...corridor.dustStorm!, position: { x: 2, z: 0 }, radius: 0.5 },
};

test.each([
  { roughTerrain: [], durationMs: 30_000, travelMs: 16_000, energy: 12 },
  { roughTerrain: [{ x: 2, z: 0 }], durationMs: 30_000, travelMs: 20_000, energy: 16 },
  { roughTerrain: [], durationMs: 7_500, travelMs: 16_000, energy: 9.5 },
])('crossing charges only the distance traveled inside the active storm, including rough terrain and expiry: %j', ({ roughTerrain, durationMs, travelMs, energy }) => {
  const expedition = createExpedition({ scenario: { ...crossing, roughTerrain: [...roughTerrain], dustStorm: { ...crossing.dustStorm!, durationMs } },
    controller: { id: 'scripted', decide: input => input.candidates.find(action => action.kind === 'inspect')?.id ?? 'wait:5000' } });
  expedition.dispatch({ type: 'introduce-storm' });
  expedition.dispatch({ type: 'start' });
  expect(expedition.getSnapshot().currentAction).toMatchObject({ routeEstimate: { energy, distanceCells: 4, durationMs: travelMs } });
  expedition.advanceWallTime(travelMs);
  expect(expedition.getSnapshot().rover.position).toEqual({ x: 4, z: 0 });
  expect(expedition.getSnapshot().energyUsed).toBeCloseTo(energy);
  expect(expedition.getSnapshot().battery).toBeCloseTo(100 - energy);
});


test('known crossing, detour, return, and wait choices expose tradeoffs and execute the selected route', () => {
  const expedition = createExpedition({ scenario: {
    ...crossing, depth: 3, base: { x: 0, z: 1 },
    samples: crossing.samples.map(sample => ({ ...sample, position: { x: 4, z: 1 } })),
    dustStorm: { ...crossing.dustStorm!, position: { x: 2, z: 1 }, durationMs: 90_000, movementEnergyMultiplier: 5 },
  }, controller: { id: 'scripted', decide(input) {
    const kind = input.memory.some(item => item.kind === 'sample' && item.properties) ? 'return-to-base' : 'inspect';
    return input.candidates.find(action => action.kind === kind && action.routeMode === 'avoid-storm')?.id ?? 'wait:5000';
  } } });
  expedition.dispatch({ type: 'introduce-storm' });
  expedition.dispatch({ type: 'start' });
  const candidates = expedition.getDecisions()[0]!.input.candidates;
  expect(candidates.find(action => action.id === 'inspect:a')).toMatchObject({ routeEstimate: { distanceCells: 4, durationMs: 16_000, energy: 16, stormDistanceCells: 1 } });
  expect(candidates.find(action => action.id === 'inspect:a:avoid-storm')).toMatchObject({ routeMode: 'avoid-storm', routeEstimate: { distanceCells: 6, durationMs: 24_000, energy: 12, stormDistanceCells: 0 } });
  expect(candidates.some(action => action.kind === 'wait')).toBe(true);
  expedition.advanceWallTime(30_000);
  expect(expedition.getSnapshot()).toMatchObject({ energyUsed: 12, inspectionCount: 1, rover: { position: { x: 4, z: 1 } }, currentAction: { kind: 'return-to-base', routeMode: 'avoid-storm' } });
  const returns = expedition.getDecisions().at(-1)!.input.candidates.filter(action => action.kind === 'return-to-base');
  expect(returns.map(action => action.routeEstimate.energy)).toEqual([16, 12]);
  expedition.advanceWallTime(24_000);
  expect(expedition.getSnapshot()).toMatchObject({ energyUsed: 24, rover: { position: { x: 0, z: 1 } } });
});


test('the baseline can detour to save energy or wait for a near expiry, while crossing remains selectable', () => {
  const detour = createExpedition({ scenario: {
    ...crossing, depth: 3, base: { x: 0, z: 1 },
    samples: crossing.samples.map(sample => ({ ...sample, position: { x: 4, z: 1 } })),
    dustStorm: { ...crossing.dustStorm!, position: { x: 2, z: 1 }, movementEnergyMultiplier: 5 },
  } });
  detour.dispatch({ type: 'introduce-storm' });
  detour.dispatch({ type: 'start' });
  expect(detour.getSnapshot().currentAction).toMatchObject({ kind: 'inspect', routeMode: 'avoid-storm' });
  detour.advanceWallTime(24_000);
  expect(detour.getSnapshot()).toMatchObject({ energyUsed: 12, rover: { position: { x: 4, z: 1 } } });

  const waiting = createExpedition({ scenario: { ...crossing, dustStorm: { ...crossing.dustStorm!, durationMs: 7_500 } } });
  waiting.dispatch({ type: 'introduce-storm' });
  waiting.dispatch({ type: 'start' });
  expect(waiting.getSnapshot().currentAction).toMatchObject({ kind: 'wait', durationMs: 5_000 });
  waiting.advanceWallTime(5_000);
  expect(waiting.getSnapshot()).toMatchObject({ elapsedMs: 5_000, battery: 100, currentAction: { kind: 'inspect' } });
  waiting.advanceWallTime(16_000);
  expect(waiting.getSnapshot()).toMatchObject({ energyUsed: 8, rover: { position: { x: 4, z: 0 } } });
});


test('entering and leaving the storm reduces sensing without erasing or refreshing out-of-range memory', () => {
  const expedition = createExpedition({ scenario: crossing, controller: { id: 'scripted', decide: input => input.candidates.find(action => action.kind === 'inspect')!.id } });
  expedition.dispatch({ type: 'introduce-storm' });
  expedition.dispatch({ type: 'start' });
  expedition.advanceWallTime(8_000);
  expect(expedition.getSnapshot()).toMatchObject({ sensorRange: 0.5, energyUsed: 6, rover: { position: { x: 2, z: 0 } } });
  expect(expedition.getSnapshot().observations.filter(item => item.kind === 'terrain').map(item => item.id)).toEqual(['cell:2,0']);
  expect(expedition.getSnapshot().memory.find(item => item.id === 'cell:0,0')).toMatchObject({ observedAtMs: 5_900 });
  expedition.advanceWallTime(2_100);
  expect(expedition.getSnapshot().sensorRange).toBe(5);
  expect(expedition.getSnapshot().observations.find(item => item.id === 'cell:0,0')).toMatchObject({ observedAtMs: 10_100 });
});

test('a storm detected during a pending decision discards the obsolete response and freezes until its replacement settles', async () => {
  const requests: { input: ControllerInput; signal: AbortSignal; resolve: (id: string) => void }[] = [];
  const expedition = createExpedition({ scenario: crossing, controller: { id: 'scripted', decide: (input, { signal }) => new Promise<string>(resolve => requests.push({ input, signal, resolve })) } });
  expedition.dispatch({ type: 'start' });
  expedition.dispatch({ type: 'introduce-storm' });
  expect(requests[0]!.signal.aborted).toBe(true);
  expect(expedition.getDecisions()[0]!.status).toBe('discarded');
  expect(requests).toHaveLength(1);
  requests[0]!.resolve('inspect:a');
  await Promise.resolve();
  expect(expedition.getSnapshot().currentAction).toBeNull();
  expect(requests).toHaveLength(2);
  expect(requests[1]!.input.observations.find(item => item.kind === 'dust-storm')).toMatchObject({ remainingMs: 30_000 });
  const pending = expedition.getSnapshot();
  expedition.advanceWallTime(60_000);
  expect(expedition.getSnapshot()).toEqual(pending);
  requests[1]!.resolve('inspect:a');
  await Promise.resolve();
  expect(expedition.getDecisions()[1]).toMatchObject({ input: { decisionBoundary: { triggers: ['start', 'storm-detected'] } }, status: 'applied' });
  expect(expedition.getRecord().events.filter(event => event.type === 'action-started')).toHaveLength(1);
});

test('an undetected storm can expire without changing controller knowledge or invalidating an outstanding choice', async () => {
  let resolve!: (id: string) => void;
  let signal!: AbortSignal;
  const expedition = createExpedition({ scenario: { ...corridor, dustStorm: { ...corridor.dustStorm!, durationMs: 1_000 } }, controller: {
    id: 'scripted', decide(_input, context) { signal = context.signal; return new Promise<string>(done => { resolve = done; }); },
  } });
  expedition.dispatch({ type: 'start' });
  const input = expedition.getDecisions()[0]!.input;
  expedition.dispatch({ type: 'introduce-storm' });
  expect(signal.aborted).toBe(false);
  expect(expedition.getSnapshot().observations).toEqual(input.observations);
  resolve('wait:5000');
  await Promise.resolve();
  expedition.advanceWallTime(1_000);
  expect(expedition.getSnapshot().memory.some(item => item.kind === 'dust-storm')).toBe(false);
  expect(expedition.getSnapshot().reconsiderationReason).toBeNull();
  expect(expedition.getRecord().events.filter(event => event.type === 'storm-expired')).toMatchObject([{ atMs: 1_000, detected: false }]);
});


test('the same storm and choices have identical simulated outcomes across playback speeds and response delays', async () => {
  const run = async (speed: 1 | 4, delayMs: number) => {
    let respond!: () => void;
    const expedition = createExpedition({ scenario: crossing, controller: { id: 'scripted', decide: input => new Promise<string>(resolve => {
      respond = () => resolve(input.candidates.find(action => action.kind === 'inspect')?.id ?? 'wait:5000');
    }) } });
    expedition.dispatch({ type: 'introduce-storm' });
    expedition.dispatch({ type: 'set-speed', speed });
    expedition.dispatch({ type: 'start' });
    while (expedition.getSnapshot().elapsedMs < 32_000) {
      if (expedition.getSnapshot().decisionPending) {
        expedition.advanceWallTime(delayMs);
        respond();
        await Promise.resolve();
      }
      expedition.advanceWallTime(100 / speed);
    }
    return { ...expedition.getSnapshot(), speed: 1 };
  };
  const slow = await run(1, 0);
  expect(slow).toMatchObject({ elapsedMs: 32_000, energyUsed: 12, inspectionCount: 1 });
  expect(await run(4, 60_000)).toEqual(slow);
});


test('remembered storm expiry is predictable out of range without refreshing its last-seen timestamp', () => {
  const expedition = createExpedition({ scenario: {
    ...corridor, sensorRange: 2,
    dustStorm: { ...corridor.dustStorm!, position: { x: 2, z: 0 }, radius: 0.5, sensorRange: 1 },
  }, controller: { id: 'scripted', decide: input => input.position.x >= 5 ? 'wait:5000' : east(input) } });
  expedition.dispatch({ type: 'introduce-storm' });
  expedition.dispatch({ type: 'start' });
  expedition.advanceWallTime(20_000);
  expect(expedition.getSnapshot().observations.some(item => item.kind === 'dust-storm')).toBe(false);
  expect(expedition.getSnapshot().memory.find(item => item.kind === 'dust-storm')).toMatchObject({ observedAtMs: 18_000, remainingMs: 10_000 });
  expedition.advanceWallTime(10_000);
  expect(expedition.getSnapshot().memory.find(item => item.kind === 'dust-storm')).toMatchObject({ observedAtMs: 18_000, remainingMs: 0 });
  expect(expedition.getDecisions().at(-1)!.reason).toBe('storm-expired');
});

test('a storm crossing can exhaust the battery partway through a grid edge without granting free distance', () => {
  const expedition = createExpedition({ scenario: { ...crossing, dustStorm: { ...crossing.dustStorm!, movementEnergyMultiplier: 200 } },
    controller: { id: 'scripted', decide: input => input.candidates.find(action => action.kind === 'inspect')!.id } });
  expedition.dispatch({ type: 'introduce-storm' });
  expedition.dispatch({ type: 'start' });
  expedition.advanceWallTime(16_000);
  expect(expedition.getSnapshot()).toMatchObject({ status: 'ended', endingCondition: 'stranded', battery: 0, energyUsed: 100, elapsedMs: 7_000 });
  expect(expedition.getSnapshot().rover.position.x).toBeCloseTo(1.7425, 6);
  expect(expedition.getSnapshot().rover.distance).toBeCloseTo(1.7425, 6);
});
