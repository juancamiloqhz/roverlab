import { findRoute, neighbors, positionKey, travelTimeMs } from './navigation';
import type { Action, Observation, Position, Scenario, TerrainObservation } from './types';

// Explicitly project sensed facts; sample properties and world metadata never cross this boundary.
export function observe(scenario: Scenario, position: Position, atMs: number): Observation[] {
  const inRange = (other: Position) => Math.hypot(other.x - position.x, other.z - position.z) <= scenario.sensorRange;
  const blocked = new Set(scenario.obstacles.map(positionKey));
  const rough = new Set(scenario.roughTerrain.map(positionKey));
  const observations: Observation[] = [];
  for (let z = 0; z < scenario.depth; z++) {
    for (let x = 0; x < scenario.width; x++) {
      if (!inRange({ x, z })) continue;
      const key = positionKey({ x, z });
      observations.push({
        kind: 'terrain', id: `cell:${key}`, position: { x, z }, observedAtMs: atMs,
        terrain: rough.has(key) ? 'rough' : 'plain', blocked: blocked.has(key),
      });
    }
  }
  if (inRange(scenario.base)) observations.push({ kind: 'base', id: 'base', position: { ...scenario.base }, observedAtMs: atMs });
  for (const sample of scenario.samples) {
    if (inRange(sample.position)) observations.push({
      kind: 'sample', id: `sample:${sample.id}`, sampleId: sample.id, label: sample.label,
      position: { ...sample.position }, observedAtMs: atMs,
    });
  }
  return observations;
}

export function knownTerrain(memory: Observation[]): TerrainObservation[] {
  return memory.filter(observation => observation.kind === 'terrain');
}

export function explorationCandidates(
  memory: Observation[], position: Position, area: { width: number; depth: number },
): Action[] {
  const terrain = knownTerrain(memory);
  const cells = new Map(terrain.map(cell => [positionKey(cell.position), cell]));
  const candidates: Action[] = [];
  for (const cell of terrain) {
    if (cell.blocked || positionKey(cell.position) === positionKey(position)) continue;
    const bordersUnknown = neighbors(cell.position).some(next =>
      next.x >= 0 && next.z >= 0 && next.x < area.width && next.z < area.depth && !cells.has(positionKey(next)));
    if (!bordersUnknown) continue;
    const route = findRoute(terrain, position, cell.position);
    if (!route) continue;
    candidates.push({
      kind: 'explore',
      target: { id: `frontier:${positionKey(cell.position)}`, label: `Frontier ${cell.position.x} / ${cell.position.z}`, position: { ...cell.position } },
      routeEstimate: {
        distanceCells: route.length,
        durationMs: route.reduce((duration, step) => duration + travelTimeMs(cells.get(positionKey(step))!.terrain), 0),
      },
    });
  }
  return candidates;
}
