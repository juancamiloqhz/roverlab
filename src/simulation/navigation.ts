import type { Position, Scenario } from './types';

const key = ({ x, z }: Position) => `${x},${z}`;

// Stable neighbor order breaks ties deterministically on the four-connected grid.
export function findRoute(scenario: Scenario, start: Position, target: Position): Position[] | null {
  const blocked = new Set(scenario.obstacles.map(key));
  const frontier = [start];
  const previous = new Map<string, Position | null>([[key(start), null]]);
  for (let cursor = 0; cursor < frontier.length; cursor++) {
    const current = frontier[cursor]!;
    if (key(current) === key(target)) {
      const route: Position[] = [];
      let step = current;
      while (previous.get(key(step))) {
        route.unshift(step);
        step = previous.get(key(step))!;
      }
      return route;
    }
    for (const next of [
      { x: current.x + 1, z: current.z }, { x: current.x, z: current.z - 1 },
      { x: current.x - 1, z: current.z }, { x: current.x, z: current.z + 1 },
    ]) {
      if (next.x < 0 || next.z < 0 || next.x >= scenario.width || next.z >= scenario.depth
        || blocked.has(key(next)) || previous.has(key(next))) continue;
      previous.set(key(next), current);
      frontier.push(next);
    }
  }
  return null;
}
