import type { ExpeditionSnapshot } from '../simulation/types';
import { ObservationTable } from './DecisionTimeline';
import { formatTime } from './formatTime';

export function RoverEvidence({ snapshot }: { snapshot: ExpeditionSnapshot }) {
  const { rover } = snapshot;
  const knownCells = snapshot.memory.filter(item => item.kind === 'terrain').length;
  const samples = snapshot.memory.filter(item => item.kind === 'sample');
  const currentIds = new Set(snapshot.observations.map(item => item.id));
  return <>
    <section className="energy-block" aria-label="Energy resources">
      <div className="telemetry-row"><span>Battery</span><strong>{snapshot.battery.toFixed(1)} / {snapshot.batteryCapacity}</strong></div>
      <meter aria-label="Battery level" min={0} max={snapshot.batteryCapacity} low={snapshot.batteryCapacity * 0.25} high={snapshot.batteryCapacity * 0.75} optimum={snapshot.batteryCapacity} value={snapshot.battery} />
      <div className="telemetry-row"><span>Energy used</span><strong aria-label="Energy used">{snapshot.energyUsed.toFixed(1)} units</strong></div>
      <p className="memory-note">Movement uses energy; rough terrain costs more. Recharge at base uses expedition time.</p>
    </section>

    <div className="telemetry-row"><span>Rover coordinates</span><strong aria-label="Rover coordinates">{rover.position.x.toFixed(2)} / {rover.position.z.toFixed(2)}</strong></div>
    <div className="telemetry-row"><span>Distance traveled</span><strong>{rover.distance.toFixed(1)} <span>cells</span></strong></div>
    <section className="science-block" aria-label="Science progress">
      <div className="telemetry-row"><span>Cargo</span><strong>{snapshot.cargo.length} / {snapshot.cargoCapacity}</strong></div>
      <p className="memory-note">{snapshot.cargo.length ? snapshot.cargo.map(sample => sample.label).join(' · ') : 'Cargo empty'}</p>
      <div className="telemetry-row"><span>Science score</span><strong>{snapshot.scienceScore}</strong></div>
      <div className="telemetry-row"><span>Samples delivered</span><strong aria-label="Samples delivered">{snapshot.deliveredSamples.length}</strong></div>
      <div className="telemetry-row"><span>Samples inspected</span><strong aria-label="Samples inspected">{snapshot.inspectionCount}</strong></div>
    </section>
    <section className="discovery-block" aria-label="Discovery progress">
      <span className="field-label">DISCOVERY</span>
      <div className="telemetry-row"><span>Terrain discovered</span><strong aria-label="Terrain discovered">{knownCells} / {snapshot.area.width * snapshot.area.depth} cells</strong></div>
      <div className="telemetry-row"><span>Samples discovered</span><strong aria-label="Samples discovered">{snapshot.discoveryCount}</strong></div>
      <p className="memory-note">Sensors reach {snapshot.sensorRange} cells. Dim terrain is remembered; its conditions may have changed. Diamonds mark rough terrain.</p>
      {samples.length === 0 && <p className="memory-note">No samples discovered yet.</p>}
      {samples.map(sample => {
        const delivery = snapshot.deliveredSamples.find(item => item.sampleId === sample.sampleId);
        return <div className="sample-row" key={sample.id}>
        <strong>{sample.label}</strong>
        <span aria-label={`${sample.label} observation`}>{sample.status === 'delivered' ? 'Delivered' : sample.status === 'cargo' ? 'Aboard rover' : currentIds.has(sample.id) ? 'In range' : 'Remembered'} · Last seen {formatTime(Math.floor(sample.observedAtMs / 1_000) * 1_000)}.{Math.floor(sample.observedAtMs % 1_000 / 100)}</span>
        <small>{sample.properties ? sample.properties.join(' · ') : 'Properties unknown · Inspection required'}</small>
        {sample.inspectedAtMs !== undefined && <small>Inspected at {formatTime(sample.inspectedAtMs)}</small>}
        {delivery && <small>{delivery.classification === 'strong-evidence' ? 'Strong evidence' : delivery.classification === 'suggestive' ? 'Suggestive' : 'Unrelated'} · {delivery.score} science points</small>}
      </div>; })}
    </section>

    <ObservationTable title="Current observations" observations={snapshot.observations} />
    <ObservationTable title="Rover memory" observations={snapshot.memory} />
  </>;
}
