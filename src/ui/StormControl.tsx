import type { ExpeditionCommand, ExpeditionSnapshot } from '../simulation/types';

export function StormControl({ snapshot, dispatch }: { snapshot: ExpeditionSnapshot; dispatch(command: ExpeditionCommand): void }) {
  const storm = snapshot.memory.find(item => item.kind === 'dust-storm');
  const visible = storm && snapshot.observations.some(item => item.id === storm.id);
  return <section className="storm-control" aria-label="Dust storm controls">
    <div><span className="field-label">ENVIRONMENT</span><h3>Localized dust storm</h3></div>
    <button className="secondary" disabled={!snapshot.stormAvailable || snapshot.stormIntroduced || snapshot.status === 'ended'} onClick={() => dispatch({ type: 'introduce-storm' })}>Introduce dust storm</button>
    {!snapshot.stormIntroduced && <p>Introduce one temporary storm per expedition. Its region and duration become known after detection.</p>}
    {snapshot.stormIntroduced && !storm && <p>Storm introduced. The rover has not detected it.</p>}
    {storm && (storm.remainingMs > 0 ? <>
      <p><strong>Detected · {visible ? 'In range' : 'Remembered'}</strong> · <span aria-label="Storm time remaining">{(storm.remainingMs / 1_000).toFixed(1)} s</span> remaining</p>
      <p>Center {storm.position.x} / {storm.position.z} · Radius {storm.radius} cells. Inside: sensor range {storm.sensorRange} cells, movement energy ×{storm.movementEnergyMultiplier}.</p>
      <p>Crossing uses extra energy. Detours take longer. Waiting uses expedition time. The storm freezes whenever expedition time pauses.</p>
    </> : <p>Known dust storm expired. Normal sensing and movement costs restored.</p>)}
  </section>;
}
