import type { Scenario } from './types';

export const authoredScenario: Scenario = {
  id: 'ochre-basin-v1',
  name: 'Ochre Basin',
  width: 21,
  depth: 19,
  base: { x: 3, z: 13 },
  obstacles: [
    { x: 6, z: 10 }, { x: 6, z: 11 }, { x: 6, z: 12 },
    { x: 11, z: 5 }, { x: 11, z: 6 }, { x: 11, z: 7 }, { x: 12, z: 7 },
    { x: 14, z: 11 }, { x: 15, z: 11 }, { x: 16, z: 11 },
    { x: 3, z: 4 }, { x: 4, z: 4 }, { x: 18, z: 16 },
  ],
  explorationTargets: [
    { id: 'near-ridge', label: 'Near ridge', position: { x: 8, z: 12 } },
    { id: 'north-basin', label: 'North basin', position: { x: 8, z: 3 } },
    { id: 'east-rim', label: 'East rim', position: { x: 17, z: 5 } },
    { id: 'south-flats', label: 'South flats', position: { x: 16, z: 14 } },
  ],
};
