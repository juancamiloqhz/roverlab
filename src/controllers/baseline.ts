import type { Action } from '../simulation/types';

// The controller sees supplied candidates only; navigation stays in the simulation.
export function chooseBaselineAction(candidates: Action[], previousAction: Action | null): Action {
  const wait = candidates.find(action => action.kind === 'wait')!;
  if (previousAction?.kind === 'explore') return wait;
  return candidates.find(action => action.kind === 'explore') ?? wait;
}
