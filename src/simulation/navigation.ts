import type { Position, Terrain, TerrainObservation } from './types';

export const positionKey = ({ x, z }: Position) => `${x},${z}`;
export const travelTimeMs = (terrain: Terrain) => terrain === 'rough' ? 8_000 : 4_000;
export const neighbors = ({ x, z }: Position): Position[] => [
  { x: x + 1, z }, { x, z: z - 1 }, { x: x - 1, z }, { x, z: z + 1 },
];

// Dijkstra over observed cells only. Unknown cells are never assumed traversable.
// Stable neighbor order breaks ties on the four-connected grid.
export function findRoute(terrain: TerrainObservation[], start: Position, target: Position): Position[] | null {
  const cells = new Map(terrain.filter(cell => !cell.blocked).map(cell => [positionKey(cell.position), cell]));
  const frontier = [{ position: start, cost: 0 }];
  const costs = new Map([[positionKey(start), 0]]);
  const previous = new Map<string, Position | null>([[positionKey(start), null]]);
  while (frontier.length) {
    frontier.sort((a, b) => a.cost - b.cost);
    const { position: current, cost } = frontier.shift()!;
    if (cost !== costs.get(positionKey(current))) continue;
    if (positionKey(current) === positionKey(target)) {
      const route: Position[] = [];
      let step = current;
      while (previous.get(positionKey(step))) {
        route.unshift(step);
        step = previous.get(positionKey(step))!;
      }
      return route;
    }
    for (const next of neighbors(current)) {
      const cell = cells.get(positionKey(next));
      if (!cell) continue;
      const nextCost = cost + travelTimeMs(cell.terrain);
      if (nextCost >= (costs.get(positionKey(next)) ?? Infinity)) continue;
      costs.set(positionKey(next), nextCost);
      previous.set(positionKey(next), current);
      frontier.push({ position: next, cost: nextCost });
    }
  }
  return null;
}
