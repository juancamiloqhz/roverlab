import { InferenceAllowances } from './InferenceLimits';
import { UsageSummary } from './InferenceUsage';
import type { ExpeditionSnapshot } from '../simulation/types';
import { scientificObjectives } from '../simulation/science';
import { controllerLabels } from './controllerLabels';
import { formatTime } from './formatTime';

export function ExpeditionResults({ snapshot }: { snapshot: ExpeditionSnapshot }) {
  const knownCells = snapshot.memory.filter(item => item.kind === 'terrain').length;
  const controllerHistoryLabel = snapshot.controllerHistory.map(entry => controllerLabels[entry.controller]).join(' → ');
  const endingLabel = snapshot.endingCondition && { timeout: 'Time budget reached', 'manual-stop': 'Stopped by mission control', stranded: 'Stranded rover' }[snapshot.endingCondition];
  return <section className="result" aria-label="Expedition results" aria-live="polite"><span className="field-label">ENDING CONDITION</span><h3>{endingLabel}</h3>{snapshot.endingCondition === 'stranded' && <p>The battery was exhausted away from base.</p>}<p>{scientificObjectives[snapshot.objective]} · {snapshot.scienceScore} science points from {snapshot.deliveredSamples.length} delivered samples.</p><p>{knownCells} terrain cells and {snapshot.discoveryCount} samples discovered; {snapshot.inspectionCount} inspected in {formatTime(snapshot.elapsedMs)} of expedition time.</p><p>{snapshot.energyUsed.toFixed(1)} energy units used; {snapshot.battery.toFixed(1)} / {snapshot.batteryCapacity} battery remaining.</p><p>Controllers used: {controllerHistoryLabel}.</p><InferenceAllowances snapshot={snapshot} /><UsageSummary usage={snapshot.usage} localSubmissions={snapshot.inferenceAttempts} waitMs={snapshot.inferenceLatencyMs} label="Result inference usage" /><p>{snapshot.cargo.length} samples remain aboard without delivery credit.</p></section>;
}
