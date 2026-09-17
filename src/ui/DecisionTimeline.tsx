import { useState } from 'react';
import { scientificObjectives } from '../simulation/science';
import type { Action, Decision, Observation } from '../simulation/types';

const seconds = (ms: number) => `${(ms / 1_000).toFixed(1)} s`;
const actionName = (action: Action) => 'target' in action
  ? `${action.kind} · ${action.target.label} (${action.target.position.x}, ${action.target.position.z})`
  : `${action.kind} · ${seconds(action.durationMs)}`;
const reasons = { start: 'Expedition started', 'action-completed': 'Action completed', 'instructions-changed': 'Instructions changed', 'new-observations': 'New observations' };

function ObservationTable({ title, observations }: { title: string; observations: Observation[] }) {
  return <div className="decision-table"><table aria-label={title}>
    <caption>{title} · {observations.length}</caption>
    <thead><tr><th>Observation</th><th>Position</th><th>Last seen</th><th>Known details</th></tr></thead>
    <tbody>{observations.map(item => <tr key={item.id}>
      <td>{item.kind === 'terrain' ? item.id : item.kind === 'base' ? 'Base' : item.label}</td>
      <td>{item.position.x}, {item.position.z}</td><td>{seconds(item.observedAtMs)}</td>
      <td>{item.kind === 'terrain' ? `${item.terrain} · ${item.blocked ? 'blocked' : 'traversable'}` : item.kind === 'base' ? 'Charging base' : <>
        {item.status} · {item.properties?.join(' · ') ?? 'Properties unknown'}
        {item.inspectedAtMs !== undefined && ` · Inspected ${seconds(item.inspectedAtMs)}`}
      </>}</td>
    </tr>)}</tbody>
  </table></div>;
}

function DecisionEntry({ decision }: { decision: Decision }) {
  const [open, setOpen] = useState(false);
  const { input } = decision;
  return <li><details onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>Decision {decision.id} · {seconds(input.atMs)} <span>{decision.action ? actionName(decision.action) : decision.status}</span></summary>
    {open && <div className="decision-details" aria-label={`Decision ${decision.id} details`}>
      <p><strong>{decision.controller === 'baseline' ? 'Baseline controller' : 'Scripted verification controller'}</strong> · {reasons[decision.reason]} · {decision.status}</p>
      <p>Selected action: <strong>{decision.action ? actionName(decision.action) : 'None'}</strong></p>
      <p>{scientificObjectives[input.objective]} · Instructions version {input.instructionsVersion}</p>
      <blockquote>{input.instructions || 'No mission instructions supplied.'}</blockquote>
      <p>Battery {input.battery.toFixed(1)} / {input.batteryCapacity} · Energy used {input.energyUsed.toFixed(1)} · Cargo {input.cargo.length} / {input.cargoCapacity} · Remaining {seconds(input.remainingMs)}</p>
      <p>Cargo: {input.cargo.map(sample => sample.label).join(', ') || 'Empty'}. Position: {input.position.x}, {input.position.z} · Sensor range: {input.sensorRange} cells.</p>
      <p>Previous completed action: {input.previousAction ? actionName(input.previousAction) : 'None'}.</p>
      {decision.latencyMs !== undefined && <p>Request latency (wall time): {decision.latencyMs.toFixed(1)} ms</p>}
      <div className="decision-table"><table aria-label="Available actions">
        <caption>Available complete actions · {input.candidates.length}</caption>
        <thead><tr><th>Candidate identity</th><th>Action and target</th><th>Known route estimate</th><th>Selection</th></tr></thead>
        <tbody>{input.candidates.map(candidate => <tr key={candidate.id}>
          <td>{candidate.id}</td><td>{actionName(candidate)}</td>
          <td>{'target' in candidate ? `${candidate.routeEstimate.distanceCells} cells · ${seconds(candidate.routeEstimate.durationMs)} travel · ${candidate.routeEstimate.energy} energy` : 'No travel'}</td>
          <td>{candidate.id === decision.selectedCandidateId ? 'Selected' : '—'}</td>
        </tr>)}</tbody>
      </table></div>
      <ObservationTable title="Observations used" observations={input.observations} />
      <ObservationTable title="Rover memory used" observations={input.memory} />
    </div>}
  </details></li>;
}

export function DecisionTimeline({ decisions }: { decisions: Decision[] }) {
  return <section className="decision-timeline" aria-label="Decision timeline">
    <h3>Decision timeline <span>{decisions.length}</span></h3>
    <p className="memory-note">Baseline decisions use fixed rules. No model probabilities or reasoning are produced. Expand a decision to inspect the information used at that moment.</p>
    {decisions.length ? <ol>{decisions.map(decision => <DecisionEntry key={decision.id} decision={decision} />)}</ol>
      : <p className="memory-note">Decisions will appear when the expedition starts.</p>}
  </section>;
}
