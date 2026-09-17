import type { Action, ControllerInput } from '../simulation/types';

// The controller sees supplied candidates only; navigation stays in the simulation.
export function chooseBaselineAction({ candidates, previousAction }: ControllerInput): Action {
  const wait = candidates.find(action => action.kind === 'wait')!;
  if (previousAction?.kind === 'explore') return wait;
  return candidates.filter(action => action.kind === 'explore')
    .sort((a, b) => a.routeEstimate.durationMs - b.routeEstimate.durationMs
      || b.target.position.x - a.target.position.x || a.target.position.z - b.target.position.z)[0] ?? wait;
}
