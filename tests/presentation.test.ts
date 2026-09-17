import { expect, test } from 'bun:test';
import { createExpedition } from '../src/simulation/expedition';

test('a detached full-world view reveals hidden conditions without changing knowledge, decisions, or outcomes', () => {
  const watched = createExpedition();
  const reference = createExpedition();
  const initial = watched.getSnapshot();
  const world = watched.getFullWorldView();
  expect(world.terrain).toHaveLength(399);
  expect(world.terrain.find(cell => cell.id === 'cell:15,5')).toMatchObject({ terrain: 'rough' });
  expect(world.terrain.find(cell => cell.id === 'cell:11,5')).toMatchObject({ blocked: true });
  expect(world.samples.map(sample => sample.label)).toEqual(['Sample A', 'Sample B', 'Sample C']);
  expect(world.storm).toBeNull();
  expect(initial.memory.filter(item => item.kind === 'terrain')).toHaveLength(29);
  expect(initial.discoveryCount).toBe(0);
  expect(watched.getSnapshot()).toEqual(initial);

  // Neither the caller nor the scene can write through the debug projection.
  world.terrain[0]!.position.x = 999;
  world.terrain.length = 0;
  world.samples[0]!.position.x = 999;
  world.samples.length = 0;
  world.base.x = 999;
  expect(watched.getFullWorldView()).toEqual(reference.getFullWorldView());
  for (const session of [watched, reference]) session.dispatch({ type: 'start' });
  for (let second = 0; second < 300; second++) {
    if (second === 0) {
      for (const session of [watched, reference]) session.dispatch({ type: 'introduce-storm' });
      const storm = watched.getFullWorldView().storm!;
      expect(storm.position).toEqual({ x: 15, z: 13 });
      expect(watched.getSnapshot().memory.some(item => item.kind === 'dust-storm')).toBe(false);
      storm.position.x = 999;
      storm.expiresAtMs = 0;
    }
    watched.getFullWorldView();
    watched.advanceWallTime(1_000);
    reference.advanceWallTime(1_000);
    expect(watched.getSnapshot()).toEqual(reference.getSnapshot());
    if (second === 26) expect(watched.getFullWorldView().samples.map(sample => sample.label)).not.toContain('Sample A');
    if (second === 44) expect(watched.getFullWorldView().storm).toBeNull();
  }
  expect(watched.getSnapshot().endingCondition).toBe('timeout');
  expect(watched.getDecisions()).toEqual(reference.getDecisions());
  expect(watched.getRecord()).toEqual(reference.getRecord());
  watched.dispatch({ type: 'reset' });
  expect(watched.getSnapshot()).toEqual(initial);
  expect(watched.getFullWorldView().samples).toHaveLength(3);
  expect(watched.getFullWorldView().storm).toBeNull();
});
