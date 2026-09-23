import { InterventionSchedule } from './InterventionSchedule';
import { MissionPreferences } from './MissionPreferences';
import { InferenceAllowances } from './InferenceLimits';
import { UsageSummary } from './InferenceUsage';
import { useState } from 'react';
import type { ExpeditionSession } from '../simulation/expedition';
import { ExpeditionScene } from '../scene/ExpeditionScene';
import { scientificObjectives } from '../simulation/science';
import { DecisionTimeline } from './DecisionTimeline';
import { controllerLabels } from './controllerLabels';
import { formatTime } from './formatTime';
import { useExpedition } from './useExpedition';

export function ExpeditionReplay({ session }: { session: ExpeditionSession }) {
  const { snapshot, decisions, dispatch, getFullWorldView } = useExpedition(() => session);
  const [stopped, setStopped] = useState(false);
  const active = snapshot.status === 'running' || snapshot.status === 'paused';
  const action = snapshot.currentAction;
  const selected = decisions.find(item => item.id === snapshot.inspectionDecisionId);
  const inspect = (decisionId: number) => dispatch({ type: 'inspect-decision', decisionId });
  return <section className="expedition-replay" aria-label="Expedition replay">
    <p className="eyebrow">REPLAY · RECORDED EXPEDITION</p>
    <p className="replay-note">Recorded choices drive this replay. No API key or new inference requests are needed. Inference usage and latency below describe the original expedition.</p>
    <div className="workspace">
      <div className="world-column">
        <div className="world-heading"><span role="status">{stopped ? 'Replay stopped' : snapshot.status === 'ended' ? 'Replay complete' : snapshot.status === 'paused' ? 'Replay paused' : 'Replay running'}</span><span className="world-heading-right">RECORDED PLAYBACK</span></div>
        <ExpeditionScene snapshot={snapshot} getFullWorldView={getFullWorldView} decision={selected ?? decisions.filter(item => item.action).at(-1)} historical={!!selected} onInspect={inspect} />
        <section className="control-bar" aria-label="Replay controls">
          <div className="transport">
            {snapshot.status === 'running' && <button className="primary" onClick={() => dispatch({ type: 'pause' })}>Pause replay</button>}
            {snapshot.status === 'paused' && (selected ? <button className="primary" onClick={() => dispatch({ type: 'end-inspection' })}>Return to replay</button>
              : snapshot.heldDecisionId ? <button className="primary" onClick={() => dispatch({ type: 'continue-choice' })}>Continue recorded action</button>
                : <button className="primary" onClick={() => dispatch({ type: 'resume' })}>Resume replay</button>)}
            <button className="secondary" disabled={!active} onClick={() => { dispatch({ type: 'stop' }); setStopped(true); }}>Stop replay</button>
            <button className="secondary" onClick={() => { dispatch({ type: 'reset' }); dispatch({ type: 'start' }); setStopped(false); }}>Restart replay</button>
          </div>
          <label><input type="checkbox" aria-label="Replay teaching mode" onChange={event => dispatch({ type: 'set-teaching-mode', enabled: event.target.checked })} />Teaching mode</label>
          <div className="speed-control" role="group" aria-label="Replay speed"><span>Playback</span>{([1, 2, 4] as const).map(speed => <button key={speed} aria-pressed={snapshot.speed === speed} disabled={!active} onClick={() => dispatch({ type: 'set-speed', speed })}>{speed}×</button>)}</div>
        </section>
      </div>
      <aside className="telemetry" aria-label="Replay telemetry">
        <div className="panel-title">RECORDED MISSION</div>
        <InferenceAllowances snapshot={snapshot} /><UsageSummary usage={snapshot.usage} localSubmissions={snapshot.inferenceAttempts} waitMs={snapshot.inferenceLatencyMs} label="Historical inference usage" />
        <p>{scientificObjectives[snapshot.objective]}</p>
        <p className="replay-note">{controllerLabels[snapshot.controller]}</p>
        <div className="time-block"><span className="field-label">ELAPSED EXPEDITION TIME</span><div className="timer" aria-label="Replay elapsed time">{formatTime(snapshot.elapsedMs)}</div></div>
        <div className="telemetry-row"><span>Rover coordinates</span><strong aria-label="Replay rover coordinates">{snapshot.rover.position.x.toFixed(2)} / {snapshot.rover.position.z.toFixed(2)}</strong></div>
        <div className="telemetry-row"><span>Battery</span><strong>{snapshot.battery.toFixed(1)} / {snapshot.batteryCapacity}</strong></div>
        <div className="telemetry-row"><span>Energy used</span><strong>{snapshot.energyUsed.toFixed(1)} units</strong></div>
        <div className="telemetry-row"><span>Science score</span><strong aria-label="Replay science score">{snapshot.scienceScore}</strong></div>
        <div className="telemetry-row"><span>Discoveries / inspections</span><strong>{snapshot.discoveryCount} / {snapshot.inspectionCount}</strong></div>
        <div className="action-block"><span className="field-label">RECORDED ACTION</span><strong>{action ? `${action.kind.replaceAll('-', ' ')}${'target' in action ? ` · ${action.target.label}` : ''}` : 'None'}</strong></div>
        <MissionPreferences snapshot={snapshot} />
        <InterventionSchedule snapshot={snapshot} />
      </aside>
    </div>
    <DecisionTimeline decisions={decisions} controllerHistory={snapshot.controllerHistory} selectedDecisionId={snapshot.inspectionDecisionId} onSelect={inspect} />
  </section>;
}
