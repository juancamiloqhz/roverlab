import { missionPreset } from '../../shared/mission';
import type { InterventionSchedule } from './interventions';
import { authoredScenario } from './scenario';

// A scheduling example on the existing world, not a tuned benchmark scenario.
export const exampleSchedule: InterventionSchedule = {
  version: 'expedition-time-v1', events: [
    { id: 'example-explore-v1', atMs: 60_000, kind: 'mission', mission: { mode: 'preset', preset: missionPreset('explore-more') } },
    { id: 'example-storm-v1', atMs: 360_000, kind: 'storm', storm: structuredClone(authoredScenario.dustStorm!) },
    { id: 'example-conserve-v1', atMs: 360_000, kind: 'mission', mission: { mode: 'preset', preset: missionPreset('conserve-energy') } },
  ],
};
