import type { ControllerInput } from '../src/simulation/types';

// Column labels carry the meaning once per kind. recordIndex preserves list
// ordering; absent optional fields are null, never substituted observations.
function tables(entries: { kind: string; fields: Record<string, unknown> }[]) {
  const groups = new Map<string, Record<string, unknown>[]>();
  entries.forEach(({ kind, fields }, recordIndex) => {
    const rows = groups.get(kind) ?? [];
    rows.push({ recordIndex, ...fields });
    groups.set(kind, rows);
  });
  return Object.fromEntries([...groups].map(([kind, records]) => {
    const columns = [...new Set(records.flatMap(record => Object.keys(record)))];
    return [kind, { columns, rows: records.map(record => columns.map(column => record[column] ?? null)) }];
  }));
}

export function decisionState(input: ControllerInput): string {
  const observations = (items: ControllerInput['observations']) => tables(items.map(({ kind, position, ...fields }) =>
    ({ kind, fields: { x: position.x, z: position.z, ...fields } })));
  const candidates = tables(input.candidates.map(candidate => ({ kind: candidate.kind, fields: 'target' in candidate ? {
    id: candidate.id, targetId: candidate.target.id, targetLabel: candidate.target.label,
    targetX: candidate.target.position.x, targetZ: candidate.target.position.z,
    routeDistanceCells: candidate.routeEstimate.distanceCells, routeDurationMs: candidate.routeEstimate.durationMs,
    routeEnergy: candidate.routeEstimate.energy,
    ...(candidate.routeMode === undefined ? {} : { routeMode: candidate.routeMode }),
    ...(candidate.routeEstimate.stormDistanceCells === undefined ? {} : { routeStormDistanceCells: candidate.routeEstimate.stormDistanceCells }),
  } : { id: candidate.id, durationMs: candidate.durationMs } })));
  return JSON.stringify({ ...input, observations: observations(input.observations), memory: observations(input.memory), candidates });
}

export const observationInstructions = 'State is compact JSON. `observations`, `memory`, and `candidates` are tables grouped by kind. Each table has `columns` and matching `rows`; null means an absent field. x and z are observation coordinates. Candidate targetId, targetLabel, targetX and targetZ describe its target; routeDistanceCells, routeDurationMs, routeEnergy and optional routeStormDistanceCells describe its route estimate. recordIndex preserves original list order. Match each Choice option ID to its complete candidate row. ';
