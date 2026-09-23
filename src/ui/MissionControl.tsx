import { InterventionSchedule } from './InterventionSchedule';
import type { ExpeditionCommand, ExpeditionSnapshot, ScientificObjective } from '../simulation/types';
import { scientificObjectives } from '../simulation/science';
import { MissionInstructions } from './MissionInstructions';
import { StormControl } from './StormControl';

export function MissionControl({ snapshot, dispatch }: { snapshot: ExpeditionSnapshot; dispatch: (command: ExpeditionCommand) => void }) {
  const { status } = snapshot;
  return <>
    <p className="memory-note">{snapshot.area.name} · {snapshot.area.width} × {snapshot.area.depth} grid · {snapshot.durationMs / 60_000}-minute expedition</p>
    <section className="objective-block">
      <label className="field-label" htmlFor="expedition-controller">EXPEDITION CONTROLLER</label>
      <select id="expedition-controller" disabled={status !== 'ready'} value={snapshot.controller} onChange={event => dispatch({ type: 'set-controller', controller: event.target.value as 'baseline' | 'typesafe' })}>
        <option value="baseline">Baseline · No key needed</option><option value="typesafe">TypeSafe · Server key required</option>
        {snapshot.controller === 'scripted' && <option value="scripted">Scripted verification</option>}
      </select>
      <p className="memory-note">Select before starting. Reset to change controller.</p>

    </section>
    <section className="objective-block">
      <label className="field-label" htmlFor="scientific-objective">SCIENTIFIC OBJECTIVE</label>
      <select id="scientific-objective" disabled={status !== 'ready'} value={snapshot.objective} onChange={event => dispatch({ type: 'set-objective', objective: event.target.value as ScientificObjective })}>
        {Object.entries(scientificObjectives).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <p className="memory-note">{status === 'ready' ? 'Choose before starting.' : 'Objective locked. Reset to choose a new expedition.'} Delivered samples earn {snapshot.rubric.unrelated} for unrelated, {snapshot.rubric.suggestive} for suggestive, or {snapshot.rubric['strong-evidence']} for strong evidence.</p>
    </section>
    <MissionInstructions snapshot={snapshot} dispatch={dispatch} />

    <InterventionSchedule snapshot={snapshot} dispatch={dispatch} />
    <StormControl snapshot={snapshot} dispatch={dispatch} />
  </>;
}
