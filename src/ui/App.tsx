import { useEffect, useRef, useState } from 'react';
import type { ExpeditionSession } from '../simulation/expedition';
import type { ExpeditionRecord } from '../simulation/types';
import { ExpeditionScene } from '../scene/ExpeditionScene';
import { failureMessages } from '../../shared/decisions';
import { InferenceLimitSetup, InferenceUsagePause } from './InferenceLimits';
import { formatInferenceCost, UsageSummary } from './InferenceUsage';
import { ExpeditionResults } from './ExpeditionResults';
import { ExpeditionComparison } from './ExpeditionComparison';
import { SavedExpeditions, SavedExpeditionView } from './SavedExpeditions';
import { DecisionTimeline } from './DecisionTimeline';
import { FullscreenButton } from './FullscreenButton';
import { LatestDecision } from './LatestDecision';
import { MissionControl } from './MissionControl';
import { RoverEvidence } from './RoverEvidence';
import { describeAction } from './describeAction';
import { formatTime } from './formatTime';
import { useExpedition } from './useExpedition';
import { controllerLabels } from './controllerLabels';
import './styles.css';
import './expedition-layout.css';

const panels = { mission: 'Mission', evidence: 'Evidence', usage: 'Usage & recovery', records: 'Saved expeditions', results: 'Results' };
type Panel = keyof typeof panels;

export function App({ createSession }: { createSession?: () => ExpeditionSession } = {}) {
  const { snapshot, decisions, completedRecords, refreshingUsage, usageRefreshMessage, refreshInferenceUsage, pauseForInspection, dispatch, startMatchedBaseline, getFullWorldView } = useExpedition(createSession);
  const [matchedSource, setMatchedSource] = useState<ExpeditionRecord | null>(null);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<ExpeditionRecord | null>(null);
  const [comparison, setComparison] = useState<[ExpeditionRecord, ExpeditionRecord] | null>(null);
  const invoker = useRef<HTMLElement | null>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const panelBody = useRef<HTMLDivElement>(null);
  function openPanel(next: Panel) {
    invoker.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (next !== 'records') { setSelectedRecord(null); setComparison(null); }
    setPanel(next);
  }
  function closePanel() {
    dispatch({ type: 'end-inspection' });
    setPanel(null);
    setSelectedRecord(null);
    setComparison(null);
    const target = invoker.current;
    if (target?.isConnected && !target.closest('.expedition-panel')) target.focus();
    else document.getElementById('panel-mission-button')?.focus();
  }
  useEffect(() => {
    if (panel) {
      closeButton.current?.focus();
      panelBody.current?.scrollTo({ top: 0 });
    }
  }, [panel, selectedRecord, comparison]);
  const { status, currentAction, usage } = snapshot;
  const selectedDecision = decisions.find(item => item.id === snapshot.inspectionDecisionId);
  const mapDecision = selectedDecision ?? [...decisions].reverse().find(item => item.status === 'applied');
  function inspectDecision(id?: number) {
    const decisionId = id ?? decisions.at(-1)?.id;
    if (decisionId) dispatch({ type: 'inspect-decision', decisionId });
    else pauseForInspection();
    openPanel('evidence');
  }
  const active = status === 'running' || status === 'paused';
  const needsRecovery = active && !!(snapshot.usagePause || snapshot.decisionFailure);
  // Open once for each new guard/failure. Closing the panel never acknowledges it.
  const recoveryKey = needsRecovery ? JSON.stringify([snapshot.usagePause, snapshot.decisionFailure, decisions.at(-1)?.id]) : '';
  useEffect(() => { if (recoveryKey) setPanel('usage'); }, [recoveryKey]);
  useEffect(() => { if (status === 'ended') setPanel('results'); }, [status]);
  const decisionPhase = status === 'ended' ? 'Ended' : snapshot.usagePause ? 'Usage paused' : snapshot.decisionFailure ? 'Failed'
    : selectedDecision ? 'Manual inspection' : snapshot.teachingMode && snapshot.heldDecisionId ? 'Teaching pause'
    : status === 'paused' ? 'Paused' : snapshot.decisionPending ? (snapshot.controller === 'typesafe' ? 'Jev choosing' : 'Controller choosing')
      : currentAction ? 'Code executing' : 'Ready';
  const statusLabel = snapshot.endingCondition === 'stranded' ? 'Rover stranded' : needsRecovery ? 'Expedition time frozen'
    : snapshot.decisionPending && active ? 'Decision pending · Expedition time frozen'
      : { ready: 'Ready to explore', running: 'Expedition running', paused: 'Expedition paused', ended: 'Expedition complete' }[status];
  const currentActionLabel = snapshot.decisionPending && active ? 'Awaiting decision'
    : snapshot.usagePause && active ? 'Inference usage paused' : snapshot.decisionFailure && active ? 'Decision paused' : snapshot.heldDecisionId ? 'Choice held before execution' : describeAction(currentAction, status).label;
  const openRecord = (record: ExpeditionRecord) => { pauseForInspection(); setComparison(null); setSelectedRecord(record); setPanel('records'); };
  const compareRecords = (records: [ExpeditionRecord, ExpeditionRecord]) => { pauseForInspection(); setSelectedRecord(null); setComparison(records); setPanel('records'); };
  const returnToLive = () => { setComparison(null); setSelectedRecord(null); closePanel(); };
  const matchedResult = matchedSource && [...completedRecords].reverse().find(record => record.matchedFrom?.recordId === matchedSource.id);
  const runMatchedBaseline = (record: ExpeditionRecord) => {
    startMatchedBaseline(record);
    setMatchedSource(record);
    setPanel(null); setSelectedRecord(null); setComparison(null);
  };

  return <div className={`expedition-shell${panel ? ' panel-open' : ''}${panel === 'records' ? ' records-open' : ''}`} onKeyDown={event => {
    if (event.key === 'Escape' && panel) { event.preventDefault(); closePanel(); }
  }}>
    <header className="expedition-header">
      <div className="lab-brand"><h1>RoverLab</h1><span>PLANETARY DECISION LAB</span></div>
      <section className="live-telemetry" aria-label="Live expedition telemetry">
        <div><small>TIME LEFT</small><strong aria-label="Remaining expedition time">{formatTime(snapshot.remainingMs)}</strong><span>{formatTime(snapshot.elapsedMs)} elapsed</span></div>
        <div><small>BATTERY</small><strong aria-label="Battery charge">{snapshot.battery.toFixed(1)} / {snapshot.batteryCapacity}</strong><meter aria-label="Battery level" min={0} max={snapshot.batteryCapacity} value={snapshot.battery} /></div>
        <div><small>CARGO</small><strong aria-label="Cargo capacity">{snapshot.cargo.length} / {snapshot.cargoCapacity}</strong><span>samples aboard</span></div>
        <div><small>DELIVERED SCIENCE</small><strong aria-label="Science score">{snapshot.scienceScore}</strong><span>science points</span></div>
        <div className="live-usage"><small>LIVE PROVIDER ATTEMPTS</small><strong aria-label="Live provider attempts">{usage ? `${usage.providerAttempts}${usage.unconfirmedSubmissions ? ' confirmed · lower bound' : ''}` : 'Unavailable'}</strong><span>{usage?.unconfirmedSubmissions ? `${usage.unconfirmedSubmissions} unconfirmed` : 'This expedition'}</span></div>
        <div className="live-cost"><small>ESTIMATED INFERENCE COST</small><strong aria-label="Live estimated inference cost">{formatInferenceCost(usage?.estimatedCost)}{usage?.estimatedCost === null && ' · incomplete'}</strong><span>{usage?.estimatedCost === null ? `Known subtotal ${formatInferenceCost(usage.knownEstimatedCost)}` : 'Estimate, not verified charges'}</span></div>
      </section>
      <FullscreenButton />
    </header>
    <main className="expedition-stage" aria-label="Live expedition workspace">
      <ExpeditionScene snapshot={snapshot} getFullWorldView={getFullWorldView} decision={mapDecision} historical={!!selectedDecision} onInspect={inspectDecision} />
      <div className="live-status" aria-label="Live expedition status"><span>LIVE · {controllerLabels[snapshot.controller]}</span><strong aria-label="Decision phase">{decisionPhase}</strong><span>{statusLabel}</span>{needsRecovery && <button className="secondary" onClick={() => openPanel('usage')}>Review recovery</button>}</div>
      <nav className="panel-navigation" aria-label="Expedition panels">{(Object.entries(panels) as [Panel, string][]).filter(([name]) => name !== 'results' || status === 'ended').map(([name, title]) =>
        <button className="secondary" id={`panel-${name}-button`} key={name} aria-expanded={panel === name} aria-controls="expedition-panel" onClick={() => panel === name ? closePanel() : openPanel(name)}>{title}</button>
      )}</nav>
      <LatestDecision snapshot={snapshot} decisions={decisions} selectedDecision={selectedDecision} onInspect={inspectDecision} />
      <aside id="expedition-panel" className={`expedition-panel${panel === 'records' ? ' record-panel' : ''}`} aria-label="Expedition panel" hidden={!panel}>
        <div className="expedition-panel-heading"><h2>{panel ? panels[panel] : ''}</h2><button className="secondary" ref={closeButton} onClick={closePanel} aria-label="Close panel">Close</button></div>
        <div className="expedition-panel-body" ref={panelBody}>
          <div hidden={panel !== 'mission'}><MissionControl snapshot={snapshot} dispatch={dispatch} /></div>
          <div hidden={panel !== 'evidence'}>
            {selectedDecision && <button className="secondary" onClick={closePanel}>Return to live view</button>}
            <DecisionTimeline decisions={decisions} controllerHistory={snapshot.controllerHistory} selectedDecisionId={snapshot.inspectionDecisionId} onSelect={inspectDecision} />
            {!selectedDecision && <RoverEvidence snapshot={snapshot} />}
          </div>
          <div hidden={panel !== 'usage'}>
            <InferenceUsagePause snapshot={snapshot} decisions={decisions} dispatch={dispatch} />
            {snapshot.decisionFailure && !snapshot.usagePause && status === 'paused' && <section className="recovery-panel" aria-label="Inference recovery">
              <h3>Jev decision failed</h3><p role="status">{failureMessages[snapshot.decisionFailure]}</p>
              {snapshot.controller === 'typesafe' && <>
                <p>Expedition time and resources remain paused. Retry uses the current mission instructions and remaining inference budget. Continuing with baseline resumes this expedition and records the controller change.</p>
                <div className="recovery-actions">
                  <button className="primary" disabled={snapshot.decisionPending} onClick={() => dispatch({ type: 'retry-decision' })}>Retry</button>
                  <button className="secondary" disabled={snapshot.decisionPending} onClick={() => dispatch({ type: 'continue-with-baseline' })}>Continue with the baseline controller</button>
                </div>
              </>}
            </section>}
            <UsageSummary usage={usage} localSubmissions={snapshot.inferenceAttempts} waitMs={snapshot.inferenceLatencyMs} />
            <InferenceLimitSetup snapshot={snapshot} decisions={decisions} dispatch={dispatch} />
          </div>
          <div hidden={panel !== 'results'}>{status === 'ended' && <ExpeditionResults snapshot={snapshot} />}
            {matchedSource && matchedResult && <button className="primary" onClick={() => compareRecords([matchedSource, matchedResult])}>Compare with source expedition</button>}
            <button className="secondary" onClick={() => openPanel('records')}>Browse saved expeditions</button></div>
          <div hidden={panel !== 'records'}>
            {comparison ? <ExpeditionComparison records={comparison} onClose={returnToLive} onOpen={openRecord} />
              : selectedRecord ? <SavedExpeditionView key={selectedRecord.id} record={selectedRecord} onClose={returnToLive} onRunBaseline={runMatchedBaseline} active={active} /> : null}
            <SavedExpeditions refreshingUsage={refreshingUsage} usageRefreshMessage={usageRefreshMessage} refreshInferenceUsage={refreshInferenceUsage} completedRecords={completedRecords} onOpen={openRecord} onCompare={compareRecords} />
          </div>
        </div>
      </aside>
      <section className="control-bar live-controls" aria-label="Expedition controls">
        <div className="transport">
          {status === 'ready' && <button className="primary" onClick={() => { setPanel(null); dispatch({ type: 'start' }); }}>Start expedition</button>}
          {status === 'running' && <button className="primary" onClick={() => dispatch({ type: 'pause' })}>Pause expedition</button>}
          {status === 'paused' && (selectedDecision ? <button className="primary" onClick={closePanel}>Return to live view</button>
            : snapshot.teachingMode && snapshot.heldDecisionId ? <button className="primary" disabled={needsRecovery} onClick={() => dispatch({ type: 'continue-choice' })}>Continue selected action</button>
              : <button className="primary" disabled={needsRecovery} onClick={() => dispatch({ type: 'resume' })}>Resume expedition</button>)}
          {status === 'ended' && <span className="complete-label">Expedition complete</span>}
          <button className="secondary" aria-label="Stop expedition" disabled={!active} onClick={() => dispatch({ type: 'stop' })}>Stop</button>
          <button className="secondary" aria-label="Reset expedition" onClick={() => { setPanel(null); setSelectedRecord(null); setComparison(null); setMatchedSource(null); dispatch({ type: 'reset' }); }}>Reset</button>
        </div>
        <label className="teaching-control"><input type="checkbox" checked={!!snapshot.teachingMode} disabled={status === 'ended'} onChange={event => dispatch({ type: 'set-teaching-mode', enabled: event.target.checked })} />Teaching mode</label>
        <div className="execution-status"><small>CURRENT CODE ACTION</small><strong aria-label="Current action">{currentActionLabel}</strong></div>
        <div className="speed-control" role="group" aria-label="Playback speed"><span>Playback</span>{([1, 2, 4] as const).map(speed => <button key={speed} aria-pressed={snapshot.speed === speed} disabled={status === 'ended'} onClick={() => dispatch({ type: 'set-speed', speed })}>{speed}×</button>)}</div>
      </section>
    </main>
  </div>;
}
