import { z } from 'zod';

export const MAX_MISSION_INSTRUCTIONS_LENGTH = 20_000;
export const presetIdSchema = z.enum(['balanced', 'conserve-energy', 'explore-more']);
export type MissionPresetId = z.infer<typeof presetIdSchema>;
const number = z.number().finite().nonnegative();
const integer = number.int();
const text = z.string().max(2_000);
const settingsSchema = z.strictObject({
  scienceWeight: number, deliveryWeight: number, energyWeight: number, explorationWeight: number,
  returnReserveEnergy: number,
});
const adherenceSchema = z.strictObject({
  version: z.literal(1),
  measures: z.array(z.strictObject({ id: text, unit: text, definition: text, limitation: text })).length(5),
});
const presetSchema = z.strictObject({
  id: presetIdSchema, label: text, version: z.literal(1), settings: settingsSchema, adherence: adherenceSchema,
});
export type MissionPreset = z.infer<typeof presetSchema>;
const adherence: MissionPreset['adherence'] = {
  version: 1,
  measures: [
    { id: 'energy-used', unit: 'energy units', definition: 'Accumulated movement energy used during the expedition.', limitation: 'Low consumption can also mean inactivity or early termination.' },
    { id: 'return-margin', unit: 'energy units', definition: 'At each decision with a known return route, battery minus the cheapest offered return-route energy estimate. Compare with returnReserveEnergy.', limitation: 'Unavailable without a known return route. Estimates assume immediate departure and currently known hazards; this is not a safety guarantee.' },
    { id: 'knowledge-rate', unit: 'new terrain cells per simulated minute', definition: 'Distinct terrain cells first observed after start divided by elapsed expedition minutes.', limitation: 'Unavailable at zero elapsed time. Depends on sensor range and terrain, and does not measure scientific value.' },
    { id: 'delivery-fraction', unit: 'fraction from 0 to 1', definition: 'Delivered sample count divided by delivered plus onboard sample count.', limitation: 'Unavailable before any collection. Ignores sample relevance and uncollected opportunities.' },
    { id: 'delivered-science', unit: 'science points', definition: 'Science score credited at base under the fixed objective and rubric.', limitation: 'Depends on the objective and discovered opportunities. Undelivered cargo earns no credit; this is an outcome, not model confidence.' },
  ],
};
const presets: Record<MissionPresetId, MissionPreset> = {
  balanced: { id: 'balanced', label: 'Balanced', version: 1,
    settings: { scienceWeight: 3, deliveryWeight: 2, energyWeight: 2, explorationWeight: 2, returnReserveEnergy: 10 }, adherence },
  'conserve-energy': { id: 'conserve-energy', label: 'Conserve energy', version: 1,
    settings: { scienceWeight: 2, deliveryWeight: 2, energyWeight: 5, explorationWeight: 1, returnReserveEnergy: 20 }, adherence },
  'explore-more': { id: 'explore-more', label: 'Explore more', version: 1,
    settings: { scienceWeight: 2, deliveryWeight: 1, energyWeight: 1, explorationWeight: 5, returnReserveEnergy: 10 }, adherence },
};
export function missionPreset(id: MissionPresetId): MissionPreset {
  return structuredClone(presets[presetIdSchema.parse(id)]);
}
// The schema orders fields before this comparison. Version 1 definitions are
// immutable historical data; future tuning needs another supported version.
const definedPresetSchema = presetSchema.refine(value => JSON.stringify(value) === JSON.stringify(presets[value.id]));
export const missionPreferencesSchema = z.discriminatedUnion('mode', [
  z.strictObject({ mode: z.literal('preset'), preset: definedPresetSchema }),
  z.strictObject({ mode: z.literal('free-text'), instructions: z.string().max(MAX_MISSION_INSTRUCTIONS_LENGTH) }),
]);
export type MissionPreferences = z.infer<typeof missionPreferencesSchema>;
export const missionRevisionSchema = z.strictObject({ version: integer, preferences: missionPreferencesSchema });
export type MissionRevision = z.infer<typeof missionRevisionSchema>;
export const missionStateSchema = z.strictObject({
  requested: missionRevisionSchema, effective: missionRevisionSchema,
  history: z.array(missionRevisionSchema.extend({ requestedAtMs: number, appliedAtMs: number.nullable() })).min(1).max(10_000),
});
export type MissionState = z.infer<typeof missionStateSchema>;
export function missionInstructions(preferences: MissionPreferences): string {
  return preferences.mode === 'free-text' ? preferences.instructions : '';
}
