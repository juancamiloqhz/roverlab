import { z } from 'zod';
import { missionPreset, type MissionPreferences } from '../../shared/mission';
import { authoredScenario } from './scenario';
import type { InterventionSchedule } from './interventions';
import type { ScientificObjective } from './types';

// Records retain the selected edition and its description alongside the complete
// starting world, preferences, and schedule. Controllers never receive this label.
export const benchmarkReferenceSchema = z.strictObject({
  id: z.string().min(1).max(200), version: z.number().int().positive(),
  name: z.string().min(1).max(200), description: z.string().max(2_000),
});
export type BenchmarkReference = z.infer<typeof benchmarkReferenceSchema>;
export type BenchmarkId = 'evidence-survey' | 'changing-priorities' | 'storm-response';
type Benchmark = {
  benchmark: BenchmarkReference; objective: ScientificObjective;
  mission: MissionPreferences; interventionSchedule: InterventionSchedule;
};
const preset = (id: Parameters<typeof missionPreset>[0]): MissionPreferences => ({ mode: 'preset', preset: missionPreset(id) });
const benchmarks: Record<BenchmarkId, Benchmark> = {
  'evidence-survey': {
    benchmark: { id: 'evidence-survey', version: 1, name: 'Evidence survey',
      description: 'Investigate past water with Balanced priorities. Inspect clear and ambiguous evidence, then choose what merits a cargo slot and a return trip.' },
    objective: 'past-water', mission: preset('balanced'),
    interventionSchedule: { version: 'expedition-time-v1', events: [] },
  },
  'changing-priorities': {
    benchmark: { id: 'changing-priorities', version: 1, name: 'Changing priorities',
      description: 'Investigate past water with Explore more, then request Conserve energy at 06:00. The objective and delivery rubric stay fixed.' },
    objective: 'past-water', mission: preset('explore-more'),
    interventionSchedule: { version: 'expedition-time-v1', events: [
      { id: 'priorities-conserve-v1', atMs: 360_000, kind: 'mission', mission: preset('conserve-energy') },
    ] },
  },
  'storm-response': {
    benchmark: { id: 'storm-response', version: 1, name: 'Storm response',
      description: 'Find unusual minerals with Balanced priorities. At 01:00, introduce a three-minute storm and request Conserve energy. Compare crossing, waiting, and other known opportunities.' },
    objective: 'unusual-minerals', mission: preset('balanced'),
    interventionSchedule: { version: 'expedition-time-v1', events: [
      { id: 'response-storm-v1', atMs: 60_000, kind: 'storm', storm: {
        position: { x: 26, z: 24 }, radius: 5, durationMs: 180_000, sensorRange: 1.5, movementEnergyMultiplier: 3,
      } },
      { id: 'response-conserve-v1', atMs: 60_000, kind: 'mission', mission: preset('conserve-energy') },
    ] },
  },
};
export const benchmarkIds = Object.keys(benchmarks) as BenchmarkId[];
export function benchmarkScenario(id: BenchmarkId) {
  if (!Object.hasOwn(benchmarks, id)) throw new RangeError('Unknown benchmark scenario.');
  return structuredClone({ ...benchmarks[id], scenario: authoredScenario });
}
