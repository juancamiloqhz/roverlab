import type { ExpeditionCommand, ExpeditionSnapshot } from '../simulation/types';
import { interventionPhase, emptyInterventionSchedule, type Intervention } from '../simulation/interventions';
import { exampleSchedule } from '../simulation/example-schedule';
import { formatTime } from './formatTime';

const time = (atMs: number) => `${formatTime(Math.floor(atMs / 1_000) * 1_000)}.${Math.floor(atMs % 1_000 / 100)}`;
const label = (event: Intervention) => event.kind === 'storm' ? 'Dust storm' : event.mission.mode === 'preset'
  ? event.mission.preset.label : 'Free-text instructions';

function EventData({ event }: { event: Intervention }) {
  if (event.kind === 'storm') return <p>Center {event.storm.position.x} / {event.storm.position.z} · Radius {event.storm.radius} cells · Duration {event.storm.durationMs / 1_000} s.<br />
    Inside: sensor range {event.storm.sensorRange} cells, movement energy ×{event.storm.movementEnergyMultiplier}.</p>;
  if (event.mission.mode === 'free-text') return <blockquote>{event.mission.instructions || 'No mission instructions supplied.'}</blockquote>;
  const { preset } = event.mission;
  return <details><summary>Preset definition version {preset.version}</summary>
    <p>Science weight {preset.settings.scienceWeight} · Delivery weight {preset.settings.deliveryWeight} · Energy weight {preset.settings.energyWeight} · Exploration weight {preset.settings.explorationWeight}.</p>
    <p>Return reserve {preset.settings.returnReserveEnergy} energy units. The scientific objective stays fixed.</p>
  </details>;
}

export function InterventionSchedule({ snapshot, dispatch }: { snapshot: ExpeditionSnapshot; dispatch?: (command: ExpeditionCommand) => void }) {
  const interventions = snapshot.interventions;
  if (!interventions) return <section className="intervention-schedule" aria-label="Intervention schedule">
    <h3>Intervention schedule</h3><p>Unavailable in this older record. Replay retains its original mission and storm events.</p>
  </section>;
  const { schedule, history } = interventions;
  const capturedStorm = history.some(item => schedule.events.some(event => event.id === item.id && event.kind === 'storm'));
  const exampleSelected = exampleSchedule.events.every(example => schedule.events.some(event => event.id === example.id));
  return <section className="intervention-schedule" aria-label="Intervention schedule">
    <h3>Intervention schedule</h3>
    <p>{dispatch ? 'Live expedition' : 'Recorded expedition'} · {history.length} of {schedule.events.length} requests issued.</p>
    {dispatch && snapshot.status === 'ready' && <>
      <p>The example selects Explore more at 01:00, then introduces a dust storm and selects Conserve energy at 06:00.</p>
      <div className="record-toolbar">
        <button className="secondary" disabled={capturedStorm || exampleSelected}
          onClick={() => dispatch({ type: 'set-intervention-schedule', schedule: exampleSchedule })}>Use example schedule</button>
        <button className="secondary" disabled={schedule.events.length === history.length}
          onClick={() => dispatch({ type: 'set-intervention-schedule', schedule: emptyInterventionSchedule() })}>Clear scheduled events</button>
      </div>
      <p>Choose before starting. Manual requests stay in the captured schedule. One storm is available per expedition.</p>
    </>}
    <p>Times use expedition time. Pauses also pause future events and storm duration. A storm reaches rover knowledge only after detection.</p>
    {!schedule.events.length && <p>No interventions recorded or scheduled.</p>}
    <ol>{schedule.events.map(event => {
      const occurrence = history.find(item => item.id === event.id);
      const revision = occurrence?.missionVersion === undefined ? undefined : snapshot.mission?.history.find(item => item.version === occurrence.missionVersion);
      return <li key={event.id}>
        <strong>{time(event.atMs)} · {label(event)}</strong>
        <p>{occurrence ? `${occurrence.source === 'manual' ? 'Manual' : 'Scheduled'} · Requested at ${time(occurrence.requestedAtMs)}`
          : snapshot.status === 'ended' ? 'Not reached before expedition ended' : 'Scheduled · Awaiting expedition time'}</p>
        {event.kind === 'mission' && occurrence && <p>{revision ? `Mission version ${revision.version} · ${revision.appliedAtMs !== null
          ? `Applied at ${time(revision.appliedAtMs)}` : revision.version < snapshot.mission!.requested.version ? 'Superseded before application'
            : snapshot.status === 'ended' ? 'Not applied before expedition ended' : 'Waiting for a safe action boundary'}` : 'Preferences already current; no mission change needed.'}</p>}
        <p>Request placement · {{ setup: 'Before start', 'before-choice': 'Before the next choice', 'after-step': 'After the current step' }[interventionPhase(event)]}</p>
        <EventData event={event} />
      </li>;
    })}</ol>
    <details><summary>Schedule rules and provenance</summary>
      <p>{schedule.version}. Requests use the 100 ms simulation clock. The example issues requests after the preceding action step and before the next controller choice. Requests at the same time and placement follow listed order. Mission changes apply at safe action boundaries. The last pending mission request supersedes earlier ones.</p>
      <p>Captured manual requests retain their placement before start or after the current step, including any choice already issued at that time. Each retains its own safe-boundary check. Replay uses recorded history without new inference.</p>
    </details>
  </section>;
}
