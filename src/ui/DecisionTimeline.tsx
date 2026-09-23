import { describeAction } from './describeAction';
import { MissionEvidence } from './MissionPreferences';
import { BaselineRuleEvidence } from './BaselineRuleEvidence';
import { DecisionUsage } from './InferenceUsage';
import { Fragment, useState } from 'react';
import { scientificObjectives } from '../simulation/science';
import type { Action, ControllerHistoryEntry, Decision, Observation } from '../simulation/types';
import { failureMessages } from '../../shared/decisions';
import { controllerLabels } from './controllerLabels';

const seconds = (ms: number) => `${(ms / 1_000).toFixed(1)} s`;
const actionName = (action: Action) => 'target' in action
  ? `${action.kind} · ${action.target.label} (${action.target.position.x}, ${action.target.position.z})${action.routeMode === 'avoid-storm' ? ' · Storm detour' : ''}`
  : `${action.kind} · ${seconds(action.durationMs)}`;
const reasons = { 'sample-discovered': 'Sample discovered', 'sample-inspected': 'Sample properties revealed', 'storm-effects-changed': 'Dust storm effects changed', 'battery-reserve': 'Return energy reserve reached', 'return-time': 'Cargo return time reached', 'cargo-full': 'Cargo capacity reached', 'mission-changed': 'Mission priorities changed', start: 'Expedition started', 'action-completed': 'Action completed', 'instructions-changed': 'Instructions changed', 'new-observations': 'New observations', 'storm-detected': 'Dust storm detected', 'storm-expired': 'Known dust storm expired', retry: 'Retry requested by mission control', 'controller-changed': 'Controller changed by mission control' };

export function decisionTriggers(decision: Decision) {
  return (decision.input.decisionBoundary?.triggers ?? [decision.reason]).map(reason => reasons[reason]).join(' · ');
}

export function ObservationTable({ title, observations }: { title: string; observations: Observation[] }) {
  return <div className="decision-table"><table aria-label={title}>
    <caption>{title} · {observations.length}</caption>
    <thead><tr><th>Observation</th><th>Position</th><th>Last seen</th><th>Known details</th></tr></thead>
    <tbody>{observations.map(item => <tr key={item.id}>
      <td>{item.kind === 'terrain' ? item.id : item.kind === 'base' ? 'Base' : item.kind === 'dust-storm' ? 'Dust storm' : item.label}</td>
      <td>{item.position.x}, {item.position.z}</td><td>{seconds(item.observedAtMs)}</td>
      <td>{item.kind === 'terrain' ? `${item.terrain} · ${item.blocked ? 'blocked' : 'traversable'}` : item.kind === 'base' ? 'Charging base' : item.kind === 'dust-storm' ? `Radius ${item.radius} cells · ${seconds(item.remainingMs)} remaining · Sensor range ${item.sensorRange} · Movement energy ×${item.movementEnergyMultiplier}` : <>
        {item.status} · {item.properties?.join(' · ') ?? 'Properties unknown'}
        {item.inspectedAtMs !== undefined && ` · Inspected ${seconds(item.inspectedAtMs)}`}
      </>}</td>
    </tr>)}</tbody>
  </table></div>;
}

function DecisionEntry({ decision }: { decision: Decision }) {
  const [open, setOpen] = useState(false);
  const { input } = decision;
  const triggers = decisionTriggers(decision);
  return <li><details onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>Decision {decision.id} · {seconds(input.atMs)} · {controllerLabels[decision.controller]} <span>{decision.action ? actionName(decision.action) : decision.status}</span><span>{triggers}</span></summary>
    {open && <div className="decision-details" aria-label={`Decision ${decision.id} details`}>
      <p><strong>{controllerLabels[decision.controller]}</strong> · {triggers} · {decision.status}</p>
      {input.decisionBoundary && <p>Decision cadence: {input.decisionBoundary.version}</p>}
      {decision.failure && <p>{failureMessages[decision.failure]}</p>}
      <DecisionUsage decision={decision} />
      <p>Selected action: <strong>{decision.action ? actionName(decision.action) : 'None'}</strong></p>
      {decision.action && <p>Code execution: {describeAction(decision.action, 'running').description}</p>}
      <BaselineRuleEvidence decision={decision} />
      <p>{scientificObjectives[input.objective]} · Instructions version {input.instructionsVersion}</p>
      {input.mission ? <MissionEvidence mission={input.mission} /> : <blockquote>{input.instructions || 'No mission instructions supplied.'}</blockquote>}
      <p>Battery {input.battery.toFixed(1)} / {input.batteryCapacity} · Energy used {input.energyUsed.toFixed(1)} · Cargo {input.cargo.length} / {input.cargoCapacity} · Remaining {seconds(input.remainingMs)}</p>
      <p>Cargo: {input.cargo.map(sample => sample.label).join(', ') || 'Empty'}. Position: {input.position.x}, {input.position.z} · Sensor range: {input.sensorRange} cells.</p>
      <p>Previous completed action: {input.previousAction ? actionName(input.previousAction) : 'None'}.</p>
      {decision.latencyMs !== undefined && <p>Decision latency (wall time): {decision.latencyMs.toFixed(1)} ms</p>}
      <div className="decision-table"><table aria-label="Available actions">
        <caption>Available complete actions · {input.candidates.length}</caption>
        <thead><tr><th>Candidate identity</th><th>Action and target</th><th>Known route estimate</th><th>Selection</th>{decision.probabilities && <th>Returned probability</th>}</tr></thead>
        <tbody>{input.candidates.map(candidate => <tr key={candidate.id}>
          <td>{candidate.id}</td><td>{actionName(candidate)}</td>
          <td>{'target' in candidate ? `${candidate.routeEstimate.distanceCells} cells · ${seconds(candidate.routeEstimate.durationMs)} travel · ${candidate.routeEstimate.energy.toFixed(2)} energy${candidate.routeEstimate.stormDistanceCells !== undefined ? ` · ${candidate.routeEstimate.stormDistanceCells.toFixed(2)} cells in active storm` : ''}` : 'No travel'}</td>
          <td>{candidate.id === decision.selectedCandidateId ? 'Selected' : '—'}</td>
          {decision.probabilities && <td>{(decision.probabilities[candidate.id]! * 100).toFixed(2)}%</td>}
        </tr>)}</tbody>
      </table></div>
      <ObservationTable title="Observations used" observations={input.observations} />
      <ObservationTable title="Rover memory used" observations={input.memory} />
    </div>}
  </details></li>;
}

export function DecisionTimeline({ decisions, controllerHistory }: { decisions: Decision[]; controllerHistory: ControllerHistoryEntry[] }) {
  return <section className="decision-timeline" aria-label="Decision timeline">
    <h3>Decision timeline <span>{decisions.length}</span></h3>
    <p className="memory-note">Baseline decisions use fixed rules. No model probabilities or reasoning are produced for baseline decisions. TypeSafe probabilities compare the offered choices; they are not utility, science score, a guarantee of correctness, or generated reasoning. A valid uncertain choice continues autonomously.</p>
    {decisions.length ? <ol>{decisions.map(decision => {
      const transitionIndex = controllerHistory.findIndex((entry, index) => index > 0 && entry.firstDecisionId === decision.id);
      const transition = transitionIndex > 0 ? controllerHistory[transitionIndex] : undefined;
      return <Fragment key={decision.id}>
        {transition && <li className="controller-transition">
          <strong>{controllerLabels[controllerHistory[transitionIndex - 1]!.controller]} → {controllerLabels[transition.controller]}</strong>
          <p>{seconds(transition.atMs)} · Mission control explicitly continued after an inference failure or usage pause.</p>
        </li>}
        <DecisionEntry decision={decision} />
      </Fragment>;
    })}</ol>
      : <p className="memory-note">Decisions will appear when the expedition starts.</p>}
  </section>;
}
