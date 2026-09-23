import type { Decision } from '../simulation/types';
import { describeAction } from './describeAction';

export function DecisionExecution({ decision }: { decision: Decision }) {
  const action = decision.action;
  if (!action) return <p>No executable choice was recorded.</p>;
  return <div className="code-execution">
    <p>Code plan for this choice: {describeAction(action, 'running').description}</p>
    {'target' in action && <p>Recorded route estimate: {action.routeEstimate.distanceCells} cells, {action.routeEstimate.durationMs / 1000} seconds, {action.routeEstimate.energy.toFixed(2)} energy.
      {' '}Battery after estimated travel: {(decision.input.battery - action.routeEstimate.energy).toFixed(2)}.
      {action.routeMode === 'avoid-storm' && ' Use the known storm detour.'}</p>}
    <p>This describes planned execution, not a completed outcome or the controller's reasoning.</p>
  </div>;
}
