import type { ScienceRubric, ScientificObjective } from './types';

export const scientificObjectives: Record<ScientificObjective, string> = {
  'past-water': 'Investigate past water',
  'unusual-minerals': 'Find unusual minerals',
};

export const scienceRubric: ScienceRubric = { unrelated: 0, suggestive: 5, 'strong-evidence': 10 };
