import { findRoute, neighbors, positionKey, travelCost } from './navigation';
import { knownStorm } from './storm';
import type { Action, DustStorm, CargoSample, Observation, Position, Scenario, TerrainObservation } from './types';

// Explicitly project sensed facts; sample properties and world metadata never cross this boundary.
export function observe(scenario: Scenario, position: Position, atMs: number, sensorRange = scenario.sensorRange): Observation[] {
  const inRange = (other: Position) => Math.hypot(other.x - position.x, other.z - position.z) <= sensorRange;
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

export function scienceCandidates(memory: Observation[], position: Position, cargo: CargoSample[], cargoCapacity: number, atMs: number): Action[] {
  const terrain = knownTerrain(memory);
  const cells = new Map(terrain.map(cell => [positionKey(cell.position), cell]));
  const candidates: Action[] = [];
  for (const item of memory) {
    if ((item.kind !== 'base' && item.kind !== 'sample') || (item.kind === 'sample' && item.status !== 'available')) continue;
    if (item.kind === 'base' && positionKey(item.position) === positionKey(position) && !cargo.length) continue;

    const target = {
      id: item.kind === 'sample' ? item.sampleId : item.id,
      label: item.kind === 'sample' ? item.label : 'Base', position: { ...item.position },
    };
    for (const choice of routeChoices(terrain, cells, position, item.position, atMs, knownStorm(memory))) {
      if (item.kind === 'base') candidates.push({ kind: 'return-to-base', target, ...choice });
      else {
        if (!item.properties) candidates.push({ kind: 'inspect', target, ...choice });
        if (cargo.length < cargoCapacity) candidates.push({ kind: 'collect', target, ...choice });
      }
    }
  }
  return candidates;
}

export function knownTerrain(memory: Observation[]): TerrainObservation[] {
  return memory.filter(observation => observation.kind === 'terrain');
}

function estimateRoute(route: Position[], cells: Map<string, TerrainObservation>, start: Position, atMs: number, storm?: DustStorm) {
  let position = start;
  const estimate = { distanceCells: route.length, energy: 0, durationMs: 0, ...(storm ? { stormDistanceCells: 0 } : {}) };
  for (const step of route) {
    const cost = travelCost(position, step, cells.get(positionKey(step))!.terrain, atMs + estimate.durationMs, storm);
    estimate.energy += cost.energy;
    if (estimate.stormDistanceCells !== undefined) estimate.stormDistanceCells += cost.stormDistanceCells;
    estimate.durationMs += cost.durationMs;
    position = step;
  }
  return estimate;
}

function routeChoices(terrain: TerrainObservation[], cells: Map<string, TerrainObservation>, start: Position, target: Position, atMs: number, storm?: DustStorm) {
  const route = findRoute(terrain, start, target);
  if (!route) return [];
  const routeEstimate = estimateRoute(route, cells, start, atMs, storm);
  const choices: { routeEstimate: typeof routeEstimate; routeMode?: 'avoid-storm' }[] = [{ routeEstimate }];
  if (storm && (routeEstimate.stormDistanceCells ?? 0) > 0) {
    const detour = findRoute(terrain, start, target, storm);
    if (detour) choices.push({ routeMode: 'avoid-storm', routeEstimate: estimateRoute(detour, cells, start, atMs, storm) });
  }
  return choices;
}

export function explorationCandidates(
  memory: Observation[], position: Position, area: { width: number; depth: number }, atMs: number,
): Action[] {
  const terrain = knownTerrain(memory);
  const cells = new Map(terrain.map(cell => [positionKey(cell.position), cell]));
  const candidates: Action[] = [];
  for (const cell of terrain) {
    if (cell.blocked || positionKey(cell.position) === positionKey(position)) continue;
    const bordersUnknown = neighbors(cell.position).some(next =>
      next.x >= 0 && next.z >= 0 && next.x < area.width && next.z < area.depth && !cells.has(positionKey(next)));
    if (!bordersUnknown) continue;
    for (const choice of routeChoices(terrain, cells, position, cell.position, atMs, knownStorm(memory))) {
      candidates.push({
        kind: 'explore',
        target: { id: `frontier:${positionKey(cell.position)}`, label: `Frontier ${cell.position.x} / ${cell.position.z}`, position: { ...cell.position } },
        ...choice,
      });
    }
  }
  return candidates;
}
