import type { Scenario } from './types';

export const authoredScenario: Scenario = {
  id: 'ochre-basin-v6',
  name: 'Ochre Basin',
  width: 42,
  depth: 38,
  durationMs: 1_080_000,
  batteryCapacity: 160,
  base: { x: 16, z: 24 },
  sensorRange: 3,
  regions: [
    { name: 'Western delta', min: { x: 0, z: 18 }, max: { x: 24, z: 37 } },
    { name: 'Northern highlands', min: { x: 0, z: 0 }, max: { x: 24, z: 17 } },
    { name: 'Eastern volcanic field', min: { x: 25, z: 0 }, max: { x: 41, z: 37 } },
  ],
  dustStorm: { position: { x: 28, z: 24 }, radius: 4.5, durationMs: 45_000, sensorRange: 1.5, movementEnergyMultiplier: 3 },
  obstacles: [
    { x: 8, z: 27 }, { x: 8, z: 28 }, { x: 8, z: 29 }, { x: 8, z: 30 },
    { x: 6, z: 8 }, { x: 7, z: 8 }, { x: 8, z: 8 }, { x: 9, z: 8 },
    { x: 16, z: 7 }, { x: 17, z: 7 }, { x: 18, z: 7 },
    { x: 34, z: 28 }, { x: 35, z: 28 }, { x: 36, z: 28 },
    { x: 34, z: 7 }, { x: 34, z: 8 }, { x: 34, z: 9 },
    { x: 19, z: 21 }, { x: 19, z: 22 }, { x: 19, z: 23 },
    { x: 24, z: 16 }, { x: 24, z: 17 }, { x: 24, z: 18 }, { x: 25, z: 18 },
    { x: 27, z: 22 }, { x: 28, z: 22 }, { x: 29, z: 22 },
    { x: 16, z: 15 }, { x: 17, z: 15 }, { x: 31, z: 27 },
  ],
  roughTerrain: [
    { x: 4, z: 27 }, { x: 4, z: 28 }, { x: 5, z: 28 }, { x: 7, z: 33 }, { x: 7, z: 34 },
    { x: 5, z: 4 }, { x: 5, z: 5 }, { x: 14, z: 3 }, { x: 14, z: 4 }, { x: 22, z: 5 },
    { x: 11, z: 9 }, { x: 11, z: 10 }, { x: 38, z: 30 }, { x: 35, z: 9 }, { x: 35, z: 10 },
    { x: 21, z: 23 }, { x: 21, z: 24 }, { x: 21, z: 25 },
    { x: 22, z: 23 }, { x: 22, z: 24 }, { x: 22, z: 25 },
    { x: 28, z: 16 }, { x: 29, z: 16 }, { x: 30, z: 16 },
  ],
  samples: [
    {
      id: 'a', label: 'Sample A', position: { x: 20, z: 24 },
      properties: ['Layered sediment', 'Rounded grains deposited by flowing water'],
      classifications: { 'past-water': 'strong-evidence', 'unusual-minerals': 'unrelated' },
    },
    // Tempting site at the storm center; properties stay private until inspection.
    {
      id: 'b', label: 'Sample B', position: { x: 28, z: 24 },
      properties: ['Crystalline inclusions', 'Rare mineral intergrowths in dry volcanic rock'],
      classifications: { 'past-water': 'unrelated', 'unusual-minerals': 'strong-evidence' },
    },
    {
      id: 'c', label: 'Sample C', position: { x: 30, z: 16 },
      properties: ['Veined rock', 'Possible fluid alteration and uncommon mineral traces'],
      classifications: { 'past-water': 'suggestive', 'unusual-minerals': 'suggestive' },
    },
    {
      id: 'd', label: 'Sample D', position: { x: 38, z: 30 },
      properties: ['Vesicular basalt', 'Common iron-rich grains in dry volcanic rock'],
      classifications: { 'past-water': 'unrelated', 'unusual-minerals': 'unrelated' },
    },
    {
      id: 'e', label: 'Sample E', position: { x: 4, z: 28 },
      properties: ['Cross-bedded sediment', 'Rounded grains deposited by flowing water'],
      classifications: { 'past-water': 'strong-evidence', 'unusual-minerals': 'unrelated' },
    },
    {
      id: 'f', label: 'Sample F', position: { x: 7, z: 34 },
      properties: ['Fine layered sediment', 'Possible fluid alteration; wind deposition remains plausible'],
      classifications: { 'past-water': 'suggestive', 'unusual-minerals': 'unrelated' },
    },
    {
      id: 'g', label: 'Sample G', position: { x: 9, z: 19 },
      properties: ['Veined rock', 'Possible fluid alteration and uncommon mineral traces'],
      classifications: { 'past-water': 'suggestive', 'unusual-minerals': 'suggestive' },
    },
    {
      id: 'h', label: 'Sample H', position: { x: 5, z: 4 },
      properties: ['Hydrated minerals', 'Rounded grains deposited by flowing water', 'Rare mineral intergrowths'],
      classifications: { 'past-water': 'strong-evidence', 'unusual-minerals': 'strong-evidence' },
    },
    {
      id: 'i', label: 'Sample I', position: { x: 14, z: 3 },
      properties: ['Crystalline inclusions', 'Rare mineral intergrowths in dry volcanic rock'],
      classifications: { 'past-water': 'unrelated', 'unusual-minerals': 'strong-evidence' },
    },
    {
      id: 'j', label: 'Sample J', position: { x: 22, z: 5 },
      properties: ['Fractured breccia', 'Uncommon mineral traces with possible fluid alteration'],
      classifications: { 'past-water': 'suggestive', 'unusual-minerals': 'suggestive' },
    },
    {
      id: 'k', label: 'Sample K', position: { x: 11, z: 10 },
      properties: ['Dry impact glass', 'Common silicate grains; no diagnostic alteration'],
      classifications: { 'past-water': 'unrelated', 'unusual-minerals': 'unrelated' },
    },
    {
      id: 'l', label: 'Sample L', position: { x: 35, z: 9 },
      properties: ['Crystalline inclusions', 'Rare mineral intergrowths', 'Possible fluid alteration'],
      classifications: { 'past-water': 'suggestive', 'unusual-minerals': 'strong-evidence' },
    },
  ],
};
