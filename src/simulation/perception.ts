import { findRoute, movementEnergy, neighbors, positionKey, travelTimeMs } from './navigation';
import type { Action, CargoSample, Observation, Position, Scenario, TerrainObservation } from './types';

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
      kind: 'sample', id: `sample:${sample.id}`, sampleId: sample.id, label: sample.label, status: 'available',
      position: { ...sample.position }, observedAtMs: atMs,
    });
  }
  return observations;
}

export function scienceCandidates(memory: Observation[], position: Position, cargo: CargoSample[], cargoCapacity: number): Action[] {
  const terrain = knownTerrain(memory);
  const cells = new Map(terrain.map(cell => [positionKey(cell.position), cell]));
  const candidates: Action[] = [];
  for (const item of memory) {
    if (item.kind === 'terrain' || (item.kind === 'sample' && item.status !== 'available')) continue;
    if (item.kind === 'base' && positionKey(item.position) === positionKey(position) && !cargo.length) continue;
    const route = findRoute(terrain, position, item.position);
    if (!route) continue;
    const target = {
      id: item.kind === 'sample' ? item.sampleId : item.id,
      label: item.kind === 'sample' ? item.label : 'Base', position: { ...item.position },
    };
    const routeEstimate = estimateRoute(route, cells);
    if (item.kind === 'base') candidates.push({ kind: 'return-to-base', target, routeEstimate });
    else {
      if (!item.properties) candidates.push({ kind: 'inspect', target, routeEstimate });
      if (cargo.length < cargoCapacity) candidates.push({ kind: 'collect', target, routeEstimate });
    }
  }
  return candidates;
}

export function knownTerrain(memory: Observation[]): TerrainObservation[] {
  return memory.filter(observation => observation.kind === 'terrain');
}

function estimateRoute(route: Position[], cells: Map<string, TerrainObservation>) {
  return {
    distanceCells: route.length,
    energy: route.reduce((energy, step) => energy + movementEnergy(cells.get(positionKey(step))!.terrain), 0),
    durationMs: route.reduce((duration, step) => duration + travelTimeMs(cells.get(positionKey(step))!.terrain), 0),
  };
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
      routeEstimate: estimateRoute(route, cells),
    });
  }
  return candidates;
}
