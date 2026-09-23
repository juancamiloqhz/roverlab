import { z } from 'zod';
import { missionPreferencesSchema } from '../../shared/mission';

const number = z.number().finite().nonnegative();
const fields = { id: z.string().min(1).max(200), atMs: number.int().multipleOf(100),
  phase: z.enum(['setup', 'before-choice', 'after-step']).optional() };
export const interventionSchema = z.discriminatedUnion('kind', [
  z.strictObject({ ...fields, kind: z.literal('mission'), mission: missionPreferencesSchema }),
  z.strictObject({ ...fields, kind: z.literal('storm'), storm: z.strictObject({
    position: z.strictObject({ x: number, z: number }), radius: number.positive(), durationMs: number.positive(),
    sensorRange: number, movementEnergyMultiplier: number.min(1),
  }) }),
]);
export type Intervention = z.infer<typeof interventionSchema>;
export const interventionPhase = (event: Intervention) => event.phase ?? 'before-choice';
const phaseOrder = { setup: 0, 'before-choice': 1, 'after-step': 2 };
export const compareInterventions = (a: Intervention, b: Intervention) => a.atMs - b.atMs
  || phaseOrder[interventionPhase(a)] - phaseOrder[interventionPhase(b)];
// Array order breaks ties within each clock phase. Times use the simulator's 100 ms clock.
export const interventionScheduleSchema = z.strictObject({
  version: z.literal('expedition-time-v1'), events: z.array(interventionSchema).max(10_000),
}).refine(schedule => new Set(schedule.events.map(event => event.id)).size === schedule.events.length
  && schedule.events.filter(event => event.kind === 'storm').length <= 1
  && schedule.events.every((event, index) => (event.phase !== 'setup' || event.atMs === 0)
    && (index === 0 || compareInterventions(schedule.events[index - 1]!, event) <= 0)));
export type InterventionSchedule = z.infer<typeof interventionScheduleSchema>;
export const interventionOccurrenceSchema = z.strictObject({
  id: z.string().min(1).max(200), source: z.enum(['scheduled', 'manual']), requestedAtMs: number,
  missionVersion: number.int().optional(),
});
export type InterventionOccurrence = z.infer<typeof interventionOccurrenceSchema>;
export const interventionStateSchema = z.strictObject({
  schedule: interventionScheduleSchema, history: z.array(interventionOccurrenceSchema).max(10_000),
});
export type InterventionState = z.infer<typeof interventionStateSchema>;
export const emptyInterventionSchedule = (): InterventionSchedule => ({ version: 'expedition-time-v1', events: [] });

export function captureIntervention(state: InterventionState, intervention: Intervention) {
  // A manual request precedes any pending request at the same time and phase.
  const index = state.schedule.events.findIndex(event => compareInterventions(event, intervention) > 0
    || (compareInterventions(event, intervention) === 0 && !state.history.some(item => item.id === event.id)));
  state.schedule.events.splice(index < 0 ? state.schedule.events.length : index, 0, structuredClone(intervention));
}
