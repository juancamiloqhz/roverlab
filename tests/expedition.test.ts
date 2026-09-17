import { expect, test } from 'bun:test';
import { createExpedition } from '../src/simulation/expedition';

test('a baseline expedition explores, waits, and ends after five simulated minutes', () => {
  const expedition = createExpedition();
  const initial = expedition.getSnapshot();
  expect(initial.status).toBe('ready');
  expect(initial.remainingMs).toBe(300_000);
  expedition.dispatch({ type: 'start' });
  expedition.advanceWallTime(4_000);
  expect(expedition.getSnapshot().rover.position).not.toEqual(initial.rover.position);
  expect(expedition.getSnapshot().currentAction?.kind).toBe('explore');
  const obstacles = expedition.getRecord().startingConditions.scenario.obstacles;
  const collisions = [];
  for (let step = 0; step < 2_960; step++) {
    expedition.advanceWallTime(100);
    const position = expedition.getSnapshot().rover.position;
    if (obstacles.some(cell => Math.abs(cell.x - position.x) < 0.5 && Math.abs(cell.z - position.z) < 0.5)) {
      collisions.push(position);
    }
  }
  expect(collisions).toEqual([]);
  expect(expedition.getSnapshot()).toMatchObject({
    status: 'ended', elapsedMs: 300_000, remainingMs: 0, endingCondition: 'timeout', currentAction: null,
  });
  const record = expedition.getRecord();
  expect(record.startingConditions.scenario.base).toEqual(initial.rover.position);
  expect(record.events.slice(0, 5).map(event => event.type)).toEqual(['created', 'discovered', 'started', 'decision-made', 'action-started']);
  expect(record.events.at(-1)).toMatchObject({ type: 'ended', atMs: 300_000, condition: 'timeout' });
  expect(record.events.every((event, index) => event.sequence === index && (index === 0 || event.atMs >= record.events[index - 1]!.atMs))).toBe(true);
  expect(new Set(record.events.flatMap(event => event.type === 'action-started' ? [event.action.kind] : [])))
    .toEqual(new Set(['explore', 'wait', 'inspect', 'collect', 'return-to-base', 'recharge']));
  expect(record.events.some(event => event.type === 'action-completed' && event.action.kind === 'explore')).toBe(true);
  expect(expedition.getSnapshot().discoveryCount).toBeGreaterThan(0);
  expect(expedition.getSnapshot().deliveredSamples).toHaveLength(1);
  expect(expedition.getSnapshot().memory.filter(item => item.kind === 'terrain').length).toBeGreaterThan(200);
  const ended = expedition.getSnapshot();
  expedition.advanceWallTime(50_000);
  expect(expedition.getSnapshot()).toEqual(ended);
});

test('mission control can pause, resume, stop, and reset without consuming paused time', () => {
  const expedition = createExpedition();
  const initial = expedition.getSnapshot();
  expedition.dispatch({ type: 'start' });
  expedition.advanceWallTime(2_050);
  expedition.dispatch({ type: 'pause' });
  const paused = expedition.getSnapshot();
  expect(paused.status).toBe('paused');
  expedition.advanceWallTime(60_000);
  expect(expedition.getSnapshot()).toEqual(paused);
  expedition.dispatch({ type: 'resume' });
  expedition.advanceWallTime(50);
  expect(expedition.getSnapshot().elapsedMs).toBe(2_100);
  const resumed = expedition.getSnapshot();
  expedition.dispatch({ type: 'stop' });
  expect(expedition.getSnapshot()).toMatchObject({ status: 'ended', endingCondition: 'manual-stop', currentAction: null });
  expedition.dispatch({ type: 'start' });
  expect(expedition.getSnapshot().status).toBe('ended');
  expedition.dispatch({ type: 'reset' });
  expect(expedition.getSnapshot()).toEqual(initial);
  expect(expedition.getRecord().events.filter(event => ['paused', 'resumed', 'ended', 'reset'].includes(event.type)).map(event => event.type))
    .toEqual(['paused', 'resumed', 'ended', 'reset']);
  expedition.dispatch({ type: 'start' });
  expedition.advanceWallTime(2_100);
  expect(expedition.getSnapshot()).toEqual(resumed);
});

test('identical commands at expedition times produce identical outcomes at every playback speed', () => {
  const outcomes = ([1, 2, 4] as const).map(speed => {
    const expedition = createExpedition();
    expedition.dispatch({ type: 'set-speed', speed });
    expect(expedition.getSnapshot().speed).toBe(speed);
    expedition.dispatch({ type: 'start' });
    expedition.advanceWallTime(12_000 / speed);
    expect(expedition.getSnapshot().elapsedMs).toBe(12_000);
    expect(expedition.getSnapshot().rover.position).toEqual({ x: 6, z: 13 });
    expect(expedition.getSnapshot().currentAction?.kind).toBe('wait');
    const waiting = expedition.getSnapshot().rover;
    expedition.advanceWallTime(2_000 / speed);
    expect(expedition.getSnapshot().rover).toEqual(waiting);
    expedition.dispatch({ type: 'pause' });
    expedition.advanceWallTime(500_000);
    expedition.dispatch({ type: 'resume' });
    // Speed 1 uses one long scheduler delay; the others use irregular batches.
    if (speed === 1) expedition.advanceWallTime(286_000);
    else {
      let remainingWallMs = 286_000 / speed;
      while (remainingWallMs > 0) {
        const batch = Math.min(remainingWallMs, speed === 2 ? 37 : 61);
        expedition.advanceWallTime(batch);
        remainingWallMs -= batch;
      }
    }
    return {
      state: { ...expedition.getSnapshot(), speed: 1 },
      events: expedition.getRecord().events.filter(event => event.type !== 'speed-changed')
        .map(({ sequence: _sequence, ...event }) => event),
    };
  });
  expect(outcomes[1]).toEqual(outcomes[0]);
  expect(outcomes[2]).toEqual(outcomes[0]);
  expect(outcomes[0]!.state.scienceScore).toBe(10);
  expect(outcomes[0]!.state.cargo).toHaveLength(0);
  expect(outcomes[0]!.events.some(event => event.type === 'action-completed' && event.action.kind === 'recharge')).toBe(true);
});
