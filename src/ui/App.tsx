import { ExpeditionScene } from '../scene/ExpeditionScene';
import { scientificObjectives } from '../simulation/science';
import type { Action, ExpeditionSnapshot, ScientificObjective } from '../simulation/types';
import { useExpedition } from './useExpedition';
import './styles.css';

const formatTime = (ms: number) => {
  const seconds = Math.ceil(ms / 1_000);
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
};

function describeAction(action: Action | null, status: ExpeditionSnapshot['status']) {
  switch (action?.kind) {
    case 'explore': return {
      label: `Explore · ${action.target.label}`, description: 'Following a grid route to the next target.',
    };
    case 'inspect': return {
      label: `Inspect · ${action.target.label}`, description: 'Travel to the sample, then examine it for six seconds to reveal its properties.',
    };
    case 'collect': return {
      label: `Collect · ${action.target.label}`, description: 'Travel to the sample, then spend four seconds collecting it into cargo.',
    };
    case 'return-to-base': return {
      label: 'Return to base', description: 'Return with cargo. Samples unload and earn science points at base.',
    };
    case 'wait': return {
      label: `Wait · ${action.durationMs / 1_000} seconds`, description: 'A bounded pause. Expedition time continues.',
    };
    default: return status === 'ended'
      ? { label: 'Expedition ended', description: 'Reset to explore the same starting area again.' }
      : { label: 'Awaiting start', description: 'Start when you’re ready. No API key needed.' };
  }
}

export function App() {
  const { snapshot, dispatch } = useExpedition();
  const { status, currentAction, rover } = snapshot;
  const knownCells = snapshot.memory.filter(item => item.kind === 'terrain').length;
  const samples = snapshot.memory.filter(item => item.kind === 'sample');
  const currentIds = new Set(snapshot.observations.map(item => item.id));
  const active = status === 'running' || status === 'paused';
  const statusLabel = { ready: 'Ready to explore', running: 'Expedition running', paused: 'Expedition paused', ended: 'Expedition complete' }[status];
  const { label: actionLabel, description: actionDescription } = describeAction(currentAction, status);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand"><span className="brand-mark" aria-hidden="true">↗</span><h1>RoverLab</h1><span className="brand-divider" /><span className="brand-subtitle">Planetary exploration sandbox</span></div>
        <span className="local-tag"><i /> Local expedition</span>
      </header>
      <main>
        <div className="page-heading">
          <div><p className="eyebrow">BASELINE EXPEDITION</p><h2>{snapshot.area.name}<span className="title-dot">.</span></h2><p className="page-description">An unknown world. An autonomous rover. Discover it together.</p></div>
          <div className="scenario-info"><span>AUTHORED SCENARIO</span><strong>{snapshot.area.width} × {snapshot.area.depth} <span>grid</span></strong><small>{snapshot.durationMs / 60_000}-minute expedition</small></div>
        </div>
        <div className="workspace">
          <div className="world-column">
            <div className="world-heading"><span><i className={`status-dot ${status}`} />{statusLabel}</span><span className="world-heading-right">ORBIT CAMERA</span></div>
            <ExpeditionScene snapshot={snapshot} />
            <section className="control-bar" aria-label="Expedition controls">
              <div className="transport">
                {status === 'ready' && <button className="primary" onClick={() => dispatch({ type: 'start' })}><span aria-hidden="true">▶</span> Start expedition</button>}
                {status === 'running' && <button className="primary" onClick={() => dispatch({ type: 'pause' })}><span aria-hidden="true">Ⅱ</span> Pause expedition</button>}
                {status === 'paused' && <button className="primary" onClick={() => dispatch({ type: 'resume' })}><span aria-hidden="true">▶</span> Resume expedition</button>}
                {status === 'ended' && <span className="complete-label">Expedition complete</span>}
                <button className="secondary" aria-label="Stop expedition" disabled={!active} onClick={() => dispatch({ type: 'stop' })}>Stop</button>
                <button className="secondary" aria-label="Reset expedition" onClick={() => dispatch({ type: 'reset' })}><span aria-hidden="true">↻</span> Reset</button>
              </div>
              <div className="speed-control" role="group" aria-label="Playback speed"><span>Playback</span>{([1, 2, 4] as const).map(speed => <button key={speed} aria-pressed={snapshot.speed === speed} disabled={status === 'ended'} onClick={() => dispatch({ type: 'set-speed', speed })}>{speed}×</button>)}</div>
            </section>
            <p className="world-note"><span aria-hidden="true">↳</span> You set the pace. The rover chooses its own targets and routes.</p>
          </div>
          <aside className="telemetry" aria-label="Expedition telemetry">
            <div className="panel-title"><span>MISSION CONTROL</span><span className="connection-dot" /></div>
            <div className="controller-card"><span className="controller-icon" aria-hidden="true">⌘</span><div><strong>Baseline controller</strong><p>Rule-based autonomy</p></div><span className="controller-tag">LOCAL</span></div>
            <section className="objective-block">
              <label className="field-label" htmlFor="scientific-objective">SCIENTIFIC OBJECTIVE</label>
              <select id="scientific-objective" disabled={status !== 'ready'} value={snapshot.objective} onChange={event => dispatch({ type: 'set-objective', objective: event.target.value as ScientificObjective })}>
                {Object.entries(scientificObjectives).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <p className="memory-note">{status === 'ready' ? 'Choose before starting.' : 'Objective locked. Reset to choose a new expedition.'} Delivered samples earn {snapshot.rubric.unrelated} for unrelated, {snapshot.rubric.suggestive} for suggestive, or {snapshot.rubric['strong-evidence']} for strong evidence.</p>
            </section>
            <div className="time-block"><span className="field-label">TIME REMAINING</span><div className="timer" aria-label="Remaining expedition time">{formatTime(snapshot.remainingMs)}</div><div className="time-track"><div style={{ width: `${snapshot.remainingMs / snapshot.durationMs * 100}%` }} /></div><div className="time-caption"><span>Expedition time</span><span>{formatTime(snapshot.durationMs)} budget</span></div></div>
            <div className="action-block"><span className="field-label">CURRENT ACTION</span><strong aria-label="Current action">{actionLabel}</strong><p>{actionDescription}</p></div>
            <div className="telemetry-row"><span>Rover coordinates</span><strong aria-label="Rover coordinates">{rover.position.x.toFixed(2)} / {rover.position.z.toFixed(2)}</strong></div>
            <div className="telemetry-row"><span>Distance traveled</span><strong>{rover.distance.toFixed(1)} <span>cells</span></strong></div>
            <section className="science-block" aria-label="Science progress">
              <div className="telemetry-row"><span>Cargo</span><strong aria-label="Cargo capacity">{snapshot.cargo.length} / {snapshot.cargoCapacity}</strong></div>
              <p className="memory-note">{snapshot.cargo.length ? snapshot.cargo.map(sample => sample.label).join(' · ') : 'Cargo empty'}</p>
              <div className="telemetry-row"><span>Science score</span><strong aria-label="Science score">{snapshot.scienceScore}</strong></div>
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
            {status === 'ended' && <section className="result" aria-label="Expedition results" aria-live="polite"><span className="field-label">ENDING CONDITION</span><h3>{snapshot.endingCondition === 'timeout' ? 'Time budget reached' : 'Stopped by mission control'}</h3><p>{scientificObjectives[snapshot.objective]} · {snapshot.scienceScore} science points from {snapshot.deliveredSamples.length} delivered samples.</p><p>{knownCells} terrain cells and {snapshot.discoveryCount} samples discovered; {snapshot.inspectionCount} inspected in {formatTime(snapshot.elapsedMs)} of expedition time.</p><p>{snapshot.cargo.length} samples remain aboard without delivery credit.</p></section>}
          </aside>
        </div>
        <footer><span>ROVERLAB <span className="footer-separator">/</span> AUTONOMOUS EXPLORATION</span><span>Baseline expedition · {snapshot.area.id}</span></footer>
      </main>
    </div>
  );
}
