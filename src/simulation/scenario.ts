import type { Scenario } from './types';

export const authoredScenario: Scenario = {
  id: 'ochre-basin-v5',
  name: 'Ochre Basin',
  width: 21,
  depth: 19,
  base: { x: 3, z: 13 },
  sensorRange: 3,
  dustStorm: { position: { x: 15, z: 13 }, radius: 4.5, durationMs: 45_000, sensorRange: 1.5, movementEnergyMultiplier: 3 },
  obstacles: [
    { x: 6, z: 10 }, { x: 6, z: 11 }, { x: 6, z: 12 },
    { x: 11, z: 5 }, { x: 11, z: 6 }, { x: 11, z: 7 }, { x: 12, z: 7 },
    { x: 14, z: 11 }, { x: 15, z: 11 }, { x: 16, z: 11 },
    { x: 3, z: 4 }, { x: 4, z: 4 }, { x: 18, z: 16 },
  ],
  roughTerrain: [
    { x: 8, z: 12 }, { x: 8, z: 13 }, { x: 8, z: 14 },
    { x: 9, z: 12 }, { x: 9, z: 13 }, { x: 9, z: 14 },
    { x: 15, z: 5 }, { x: 16, z: 5 }, { x: 17, z: 5 },
  ],
  samples: [
    {
      id: 'a', label: 'Sample A', position: { x: 7, z: 13 },
      properties: ['Layered sediment', 'Rounded grains deposited by flowing water'],
      classifications: { 'past-water': 'strong-evidence', 'unusual-minerals': 'unrelated' },
    },
    // Tempting site at the storm center; properties stay private until inspection.
    {
      id: 'b', label: 'Sample B', position: { x: 15, z: 13 },
      properties: ['Crystalline inclusions', 'Rare mineral intergrowths in dry volcanic rock'],
      classifications: { 'past-water': 'unrelated', 'unusual-minerals': 'strong-evidence' },
    },
    {
      id: 'c', label: 'Sample C', position: { x: 17, z: 5 },
      properties: ['Veined rock', 'Possible fluid alteration and uncommon mineral traces'],
      classifications: { 'past-water': 'suggestive', 'unusual-minerals': 'suggestive' },
    },
  ],
};
