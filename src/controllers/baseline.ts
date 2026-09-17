import { knownStorm } from '../simulation/storm';
import type { ActionCandidate, ControllerInput } from '../simulation/types';

// The controller sees supplied candidates only; navigation stays in the simulation.
function chooseBaselinePriority({ candidates, previousAction, cargo, cargoCapacity, battery, batteryCapacity }: ControllerInput): ActionCandidate {
  const wait = candidates.find(action => action.kind === 'wait')!;
  const returnToBase = candidates.find(action => action.kind === 'return-to-base');
  const recharge = candidates.find(action => action.kind === 'recharge');
  // Small top-ups can be skipped; larger deficits justify spending time at base.
  if (recharge && battery <= batteryCapacity * 0.9) return recharge;
  // A strategy using the known return route, never a simulation safety constraint.
  if (returnToBase && battery <= returnToBase.routeEstimate.energy + 10) return returnToBase;
  if (cargo.length >= cargoCapacity && returnToBase) return returnToBase;
  if (previousAction?.kind === 'explore') return wait;
  const science = candidates.filter(action => action.kind === 'inspect' || action.kind === 'collect')
    .sort((a, b) => a.routeEstimate.durationMs - b.routeEstimate.durationMs
      || a.target.id.localeCompare(b.target.id) || (a.kind === 'inspect' ? -1 : 1))[0];
  if (science) return science;
  if (cargo.length && returnToBase) return returnToBase;
  return candidates.filter(action => action.kind === 'explore')
    .sort((a, b) => a.routeEstimate.durationMs - b.routeEstimate.durationMs
      || b.target.position.x - a.target.position.x || a.target.position.z - b.target.position.z)[0] ?? wait;
}


export function chooseBaselineAction(input: ControllerInput): ActionCandidate {
  const selected = chooseBaselinePriority(input);
  if (!('target' in selected) || !(selected.routeEstimate.stormDistanceCells ?? 0)) return selected;
  const detour = input.candidates.find(candidate => 'target' in candidate
    && candidate.kind === selected.kind && candidate.target.id === selected.target.id && candidate.routeMode === 'avoid-storm');
  if (detour && 'target' in detour && detour.routeEstimate.energy < selected.routeEstimate.energy
    && detour.routeEstimate.durationMs < input.remainingMs) return detour;
  const storm = knownStorm(input.memory);
  if (storm && storm.remainingMs <= 10_000 && storm.remainingMs + selected.routeEstimate.durationMs < input.remainingMs) {
    return input.candidates.find(candidate => candidate.kind === 'wait')!;
  }
  return selected;
}
