import { UsageSummary } from './InferenceUsage';
import { useState } from 'react';
import { ExpeditionResults } from './ExpeditionResults';
import { ExpeditionComparison } from './ExpeditionComparison';
import { SavedExpeditions, SavedExpeditionView } from './SavedExpeditions';
import { formatTime } from './formatTime';
import type { ExpeditionSession } from '../simulation/expedition';
import { ExpeditionScene } from '../scene/ExpeditionScene';
import { scientificObjectives } from '../simulation/science';
import type { Action, ExpeditionSnapshot, ExpeditionRecord, ScientificObjective } from '../simulation/types';
import { DecisionTimeline } from './DecisionTimeline';
import { StormControl } from './StormControl';
import { MissionInstructions } from './MissionInstructions';
import { useExpedition } from './useExpedition';
import './styles.css';
import { failureMessages, INFERENCE_LIMIT } from '../../shared/decisions';
import { controllerLabels } from './controllerLabels';

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
      label: 'Return to base', description: 'Travel to base. Cargo unloads automatically; recharging is a separate action.',
    };
    case 'recharge': return {
      label: 'Recharge at base', description: 'Replenishing the battery. Expedition time continues; accumulated energy use is preserved.',
    };
    case 'wait': return {
      label: `Wait · ${action.durationMs / 1_000} seconds`, description: 'A bounded pause. Expedition time continues.',
    };
    default: return status === 'ended'
      ? { label: 'Expedition ended', description: 'Reset to explore the same starting area again.' }
      : { label: 'Awaiting start', description: 'Start when you’re ready. The baseline needs no API key.' };
  }
}

export function App({ createSession }: { createSession?: () => ExpeditionSession } = {}) {
  const { snapshot, decisions, completedRecords, pauseForInspection, dispatch, getFullWorldView } = useExpedition(createSession);
  const [selectedRecord, setSelectedRecord] = useState<ExpeditionRecord | null>(null);
  const [comparison, setComparison] = useState<[ExpeditionRecord, ExpeditionRecord] | null>(null);
  const openRecord = (record: ExpeditionRecord) => { pauseForInspection(); setComparison(null); setSelectedRecord(record); window.scrollTo({ top: 0, behavior: 'instant' }); };
  const compareRecords = (records: [ExpeditionRecord, ExpeditionRecord]) => { pauseForInspection(); setSelectedRecord(null); setComparison(records); window.scrollTo({ top: 0, behavior: 'instant' }); };
  const { status, currentAction, rover } = snapshot;
  const controllerLabel = controllerLabels[snapshot.controller];
  const knownCells = snapshot.memory.filter(item => item.kind === 'terrain').length;
  const samples = snapshot.memory.filter(item => item.kind === 'sample');
  const currentIds = new Set(snapshot.observations.map(item => item.id));
  const active = status === 'running' || status === 'paused';
  const statusLabel = snapshot.decisionPending && active ? 'Decision pending · Expedition time frozen' : { ready: 'Ready to explore', running: 'Expedition running', paused: 'Expedition paused', ended: 'Expedition complete' }[status];
  const { label: actionLabel, description: actionDescription } = snapshot.decisionPending && active
    ? { label: 'Awaiting decision', description: 'Expedition time and resources are frozen. Camera and mission controls remain available.' }
    : snapshot.decisionFailure && active ? { label: 'Decision paused', description: failureMessages[snapshot.decisionFailure] } : describeAction(currentAction, status);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand"><span className="brand-mark" aria-hidden="true">↗</span><h1>RoverLab</h1><span className="brand-divider" /><span className="brand-subtitle">Planetary exploration sandbox</span></div>
        <a className="records-link" href="#saved-expeditions">Saved expeditions</a><span className="local-tag"><i /> {comparison ? 'Expedition comparison' : selectedRecord ? 'Saved expedition' : 'Local expedition'}</span>
      </header>
      <main>
        {comparison ? <ExpeditionComparison records={comparison} onClose={() => setComparison(null)} onOpen={openRecord} />
          : selectedRecord ? <SavedExpeditionView key={selectedRecord.id} record={selectedRecord} onClose={() => setSelectedRecord(null)} /> : <>
        <div className="page-heading">
          <div><p className="eyebrow">{snapshot.controllerHistory.map(entry => entry.controller.toUpperCase()).join(' → ')} EXPEDITION</p><h2>{snapshot.area.name}<span className="title-dot">.</span></h2><p className="page-description">An unknown world. An autonomous rover. Discover it together.</p></div>
          <div className="scenario-info"><span>AUTHORED SCENARIO</span><strong>{snapshot.area.width} × {snapshot.area.depth} <span>grid</span></strong><small>{snapshot.durationMs / 60_000}-minute expedition</small></div>
        </div>
        <div className="workspace">
          <div className="world-column">
            <div className="world-heading"><span><i className={`status-dot ${status}`} />{snapshot.endingCondition === 'stranded' ? 'Rover stranded' : statusLabel}</span><span className="world-heading-right">OBSERVATION VIEW</span></div>
            <ExpeditionScene snapshot={snapshot} getFullWorldView={getFullWorldView} />
            <section className="control-bar" aria-label="Expedition controls">
              <div className="transport">
                {status === 'ready' && <button className="primary" onClick={() => dispatch({ type: 'start' })}><span aria-hidden="true">▶</span> Start expedition</button>}
                {status === 'running' && <button className="primary" onClick={() => dispatch({ type: 'pause' })}><span aria-hidden="true">Ⅱ</span> Pause expedition</button>}
                {status === 'paused' && <button className="primary" disabled={!!snapshot.decisionFailure} onClick={() => dispatch({ type: 'resume' })}><span aria-hidden="true">▶</span> Resume expedition</button>}
                {status === 'ended' && <span className="complete-label">Expedition complete</span>}
                <button className="secondary" aria-label="Stop expedition" disabled={!active} onClick={() => dispatch({ type: 'stop' })}>Stop</button>
                <button className="secondary" aria-label="Reset expedition" onClick={() => dispatch({ type: 'reset' })}><span aria-hidden="true">↻</span> Reset</button>
              </div>
              <div className="speed-control" role="group" aria-label="Playback speed"><span>Playback</span>{([1, 2, 4] as const).map(speed => <button key={speed} aria-pressed={snapshot.speed === speed} disabled={status === 'ended'} onClick={() => dispatch({ type: 'set-speed', speed })}>{speed}×</button>)}</div>
            </section>
            {snapshot.decisionFailure && status === 'paused' && <section className="recovery-panel" aria-label="Inference recovery">
              <p role="status">{failureMessages[snapshot.decisionFailure]}</p>
              {snapshot.controller === 'typesafe' && <>
                <p>Expedition time and resources remain paused. Retry uses the current mission instructions and remaining inference budget. Continuing with baseline resumes this expedition and records the controller change.</p>
                <div className="recovery-actions">
                  <button className="primary" disabled={snapshot.inferenceAttempts >= INFERENCE_LIMIT || snapshot.decisionPending} onClick={() => dispatch({ type: 'retry-decision' })}>Retry</button>
                  <button className="secondary" disabled={snapshot.decisionPending} onClick={() => dispatch({ type: 'continue-with-baseline' })}>Continue with the baseline controller</button>
                </div>
                {snapshot.inferenceAttempts >= INFERENCE_LIMIT && <p>Retry unavailable: all {INFERENCE_LIMIT} local submissions have been used. Continue with baseline, stop, or reset for a new expedition.</p>}
              </>}
            </section>}
            <p className="world-note"><span aria-hidden="true">↳</span> You set the pace. The rover chooses its own targets and routes.</p>
            <StormControl snapshot={snapshot} dispatch={dispatch} />
            <DecisionTimeline decisions={decisions} controllerHistory={snapshot.controllerHistory} />
          </div>
          <aside className="telemetry" aria-label="Expedition telemetry">
            <div className="panel-title"><span>MISSION CONTROL</span><span className="connection-dot" /></div>
            <div className="controller-card"><span className="controller-icon" aria-hidden="true">⌘</span><div><strong>{controllerLabel}</strong><p>{snapshot.controller === 'typesafe' ? 'Bounded TypeSafe choices' : 'Rule-based autonomy'}</p></div><span className="controller-tag">LOCAL</span></div>
            <section className="objective-block">
              <label className="field-label" htmlFor="expedition-controller">EXPEDITION CONTROLLER</label>
              <select id="expedition-controller" disabled={status !== 'ready'} value={snapshot.controller} onChange={event => dispatch({ type: 'set-controller', controller: event.target.value as 'baseline' | 'typesafe' })}>
                <option value="baseline">Baseline · No key needed</option><option value="typesafe">TypeSafe · Server key required</option>
                {snapshot.controller === 'scripted' && <option value="scripted">Scripted verification</option>}
              </select>
              <p className="memory-note">Select before starting. Reset to change controller.</p>
              <UsageSummary usage={snapshot.usage} localSubmissions={snapshot.inferenceAttempts} waitMs={snapshot.inferenceLatencyMs} limit={INFERENCE_LIMIT} />
            </section>
            <section className="objective-block">
              <label className="field-label" htmlFor="scientific-objective">SCIENTIFIC OBJECTIVE</label>
              <select id="scientific-objective" disabled={status !== 'ready'} value={snapshot.objective} onChange={event => dispatch({ type: 'set-objective', objective: event.target.value as ScientificObjective })}>
                {Object.entries(scientificObjectives).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <p className="memory-note">{status === 'ready' ? 'Choose before starting.' : 'Objective locked. Reset to choose a new expedition.'} Delivered samples earn {snapshot.rubric.unrelated} for unrelated, {snapshot.rubric.suggestive} for suggestive, or {snapshot.rubric['strong-evidence']} for strong evidence.</p>
            </section>
            <MissionInstructions snapshot={snapshot} dispatch={dispatch} />
            <div className="time-block"><span className="field-label">TIME REMAINING</span><div className="timer" aria-label="Remaining expedition time">{formatTime(snapshot.remainingMs)}</div><div className="time-track"><div style={{ width: `${snapshot.remainingMs / snapshot.durationMs * 100}%` }} /></div><div className="time-caption"><span>Expedition time</span><span>{formatTime(snapshot.durationMs)} budget</span></div></div>
            <section className="energy-block" aria-label="Energy resources">
              <div className="telemetry-row"><span>Battery</span><strong aria-label="Battery charge">{snapshot.battery.toFixed(1)} / {snapshot.batteryCapacity}</strong></div>
              <meter aria-label="Battery level" min={0} max={snapshot.batteryCapacity} low={snapshot.batteryCapacity * 0.25} high={snapshot.batteryCapacity * 0.75} optimum={snapshot.batteryCapacity} value={snapshot.battery} />
              <div className="telemetry-row"><span>Energy used</span><strong aria-label="Energy used">{snapshot.energyUsed.toFixed(1)} units</strong></div>
              <p className="memory-note">Movement uses energy; rough terrain costs more. Recharge at base uses expedition time.</p>
            </section>
            <div className="action-block"><span className="field-label">CURRENT ACTION</span><strong aria-label="Current action">{actionLabel}</strong><p>{actionDescription}{currentAction && 'target' in currentAction && currentAction.routeMode === 'avoid-storm' && ' Taking a known route around the dust storm.'}</p></div>
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
            {status === 'ended' && <ExpeditionResults snapshot={snapshot} />}
          </aside>
        </div>
        </>}
        <SavedExpeditions completedRecords={completedRecords} onOpen={openRecord} onCompare={compareRecords} />
        <footer><span>ROVERLAB <span className="footer-separator">/</span> AUTONOMOUS EXPLORATION</span><span>{comparison ? 'Saved expedition comparison' : <>{selectedRecord ? selectedRecord.results.controllerHistory.map(entry => controllerLabels[entry.controller]).join(' → ') : controllerLabel} · {selectedRecord?.results.area.id ?? snapshot.area.id}</>}</span></footer>
      </main>
    </div>
  );
}
