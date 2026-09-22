import type { ExpeditionController } from '../../src/simulation/types';

// Deliberately ignores relevance and round-trip feasibility. Physics/scoring
// scenarios use this script to exercise bad trips the live baseline now avoids.
export const greedySurvey: ExpeditionController = { id: 'scripted', decide(input) {
  const { candidates, battery, batteryCapacity, cargo, cargoCapacity, previousAction } = input;
  const wait = candidates.find(action => action.kind === 'wait')!;
  const returnToBase = candidates.find(action => action.kind === 'return-to-base');
  const recharge = candidates.find(action => action.kind === 'recharge');
  if (recharge && battery <= batteryCapacity * 0.9) return recharge.id;
  if (returnToBase && (battery <= returnToBase.routeEstimate.energy + 10 || cargo.length >= cargoCapacity)) return returnToBase.id;
  if (previousAction?.kind === 'explore') return wait.id;
  const science = candidates.filter(action => action.kind === 'inspect' || action.kind === 'collect')
    .sort((a, b) => a.routeEstimate.durationMs - b.routeEstimate.durationMs
      || a.target.id.localeCompare(b.target.id) || Number(b.kind === 'inspect') - Number(a.kind === 'inspect'))[0];
  if (science) return science.id;
  if (cargo.length && returnToBase) return returnToBase.id;
  return candidates.filter(action => action.kind === 'explore').sort((a, b) => a.routeEstimate.durationMs - b.routeEstimate.durationMs
    || b.target.position.x - a.target.position.x || a.target.position.z - b.target.position.z)[0]?.id ?? wait.id;
} };
