import type { ControllerInput, Observation } from '../../src/simulation/types';

// The scripted provider interprets the documented wire format independently of
// the server encoder. Legacy fixtures still carry their original object state.
export function readProviderInput(state: unknown): ControllerInput {
  if (typeof state !== 'string') return state as ControllerInput;
  const input = JSON.parse(state);
  for (const key of ['observations', 'memory', 'candidates']) {
    const observations: unknown[] = [];
    for (const [kind, table] of Object.entries(input[key]) as [string, { columns: string[]; rows: unknown[][] }][]) {
      for (const row of table.rows) {
        const fields = Object.fromEntries(table.columns.map((column, index) => [column, row[index]]).filter(([, value]) => value !== null));
        const { recordIndex, x, z, ...details } = fields;
        if (key !== 'candidates') observations[recordIndex as number] = { ...details, kind, position: { x, z } } as Observation;
        else if ('targetId' in details) {
          const { targetId, targetLabel, targetX, targetZ, routeDistanceCells, routeDurationMs, routeEnergy, routeStormDistanceCells, ...action } = details;
          observations[recordIndex as number] = { ...action, kind, target: { id: targetId, label: targetLabel, position: { x: targetX, z: targetZ } },
            routeEstimate: { distanceCells: routeDistanceCells, durationMs: routeDurationMs, energy: routeEnergy,
              ...(routeStormDistanceCells === undefined ? {} : { stormDistanceCells: routeStormDistanceCells }) } };
        } else observations[recordIndex as number] = { ...details, kind };
      }
    }
    input[key] = observations;
  }
  return input;
}
