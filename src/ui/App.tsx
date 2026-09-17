import { ExpeditionScene } from '../scene/ExpeditionScene';
import { authoredScenario } from '../simulation/scenario';
import { useExpedition } from './useExpedition';
import './styles.css';

const formatTime = (ms: number) => {
  const seconds = Math.ceil(ms / 1_000);
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
};

export function App() {
  const { snapshot, dispatch } = useExpedition();
  const { status, currentAction, rover } = snapshot;
  const active = status === 'running' || status === 'paused';
  const statusLabel = { ready: 'Ready to explore', running: 'Expedition running', paused: 'Expedition paused', ended: 'Expedition complete' }[status];
  const actionLabel = currentAction?.kind === 'explore' ? `Explore · ${currentAction.target.label}`
    : currentAction?.kind === 'wait' ? `Wait · ${currentAction.durationMs / 1_000} seconds` : status === 'ended' ? 'Expedition ended' : 'Awaiting start';

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand"><span className="brand-mark" aria-hidden="true">↗</span><h1>RoverLab</h1><span className="brand-divider" /><span className="brand-subtitle">Planetary exploration sandbox</span></div>
        <span className="local-tag"><i /> Local expedition</span>
      </header>
      <main>
        <div className="page-heading">
          <div><p className="eyebrow">BASELINE EXPEDITION</p><h2>Ochre Basin<span className="title-dot">.</span></h2><p className="page-description">A small world. An autonomous rover. See where it goes.</p></div>
          <div className="scenario-info"><span>AUTHORED SCENARIO</span><strong>21 × 19 <span>grid</span></strong><small>{snapshot.durationMs / 60_000}-minute expedition</small></div>
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
            <div className="time-block"><span className="field-label">TIME REMAINING</span><div className="timer" aria-label="Remaining expedition time">{formatTime(snapshot.remainingMs)}</div><div className="time-track"><div style={{ width: `${snapshot.remainingMs / snapshot.durationMs * 100}%` }} /></div><div className="time-caption"><span>Expedition time</span><span>{formatTime(snapshot.durationMs)} budget</span></div></div>
            <div className="action-block"><span className="field-label">CURRENT ACTION</span><strong aria-label="Current action">{actionLabel}</strong><p>{currentAction?.kind === 'explore' ? 'Following a grid route to the next target.' : currentAction?.kind === 'wait' ? 'A bounded pause. Expedition time continues.' : status === 'ended' ? 'Reset to explore the same starting area again.' : 'Start when you’re ready. No API key needed.'}</p></div>
            <div className="telemetry-row"><span>Rover coordinates</span><strong aria-label="Rover coordinates">{rover.position.x.toFixed(2)} / {rover.position.z.toFixed(2)}</strong></div>
            <div className="telemetry-row"><span>Distance traveled</span><strong>{rover.distance.toFixed(1)} <span>cells</span></strong></div>
            <div className="targets-block"><span className="field-label">EXPLORATION TARGETS</span>{authoredScenario.explorationTargets.map((target, index) => <div className="target-row" key={target.id}><span className={snapshot.exploredTargetIds.includes(target.id) ? 'target-number reached' : 'target-number'}>{snapshot.exploredTargetIds.includes(target.id) ? '✓' : `0${index + 1}`}</span><span>{target.label}</span><span className="target-state">{snapshot.exploredTargetIds.includes(target.id) ? 'Reached' : currentAction?.kind === 'explore' && currentAction.target.id === target.id ? 'En route' : 'Pending'}</span></div>)}</div>
            {status === 'ended' && <section className="result" aria-live="polite"><span className="field-label">ENDING CONDITION</span><h3>{snapshot.endingCondition === 'timeout' ? 'Time budget reached' : 'Stopped by mission control'}</h3><p>{snapshot.exploredTargetIds.length} targets reached in {formatTime(snapshot.elapsedMs)} of expedition time.</p></section>}
          </aside>
        </div>
        <footer><span>ROVERLAB <span className="footer-separator">/</span> AUTONOMOUS EXPLORATION</span><span>Baseline expedition · {authoredScenario.id}</span></footer>
      </main>
    </div>
  );
}
