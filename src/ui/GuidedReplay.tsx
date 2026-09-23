import { useEffect, useRef, useState } from 'react';
import { createReplay } from '../simulation/expedition';
import type { ExpeditionRecord } from '../simulation/types';
import { ExpeditionScene } from '../scene/ExpeditionScene';
import { useExpedition } from './useExpedition';
import { LatestDecision } from './LatestDecision';
import { DecisionTimeline, ObservationTable } from './DecisionTimeline';
import { DecisionComparison } from './DecisionComparison';
import { DecisionExecution } from './DecisionExecution';
import { UsageSummary, DecisionUsage, formatInferenceCost } from './InferenceUsage';
import { ExpeditionComparison } from './ExpeditionComparison';
import { SavedExpeditionView } from './SavedExpeditions';
import { FullscreenButton } from './FullscreenButton';
import { formatTime } from './formatTime';

const headings = ['What the rover knows', 'Jev chooses', 'A baseline alternative', 'Code executes the choice', 'Original cost and failure', 'Compare actual outcomes'];
type Panel = 'guide' | 'evidence' | 'usage' | 'results' | 'record';

export function GuidedReplay({ records, onClose }: { records: [ExpeditionRecord, ExpeditionRecord]; onClose: () => void }) {
  const [source, baseline] = records;
  const [session] = useState(() => {
    const replay = createReplay(source);
    replay.dispatch({ type: 'set-teaching-mode', enabled: true });
    replay.dispatch({ type: 'start' });
    replay.dispatch({ type: 'continue-choice' });
    replay.advanceWallTime(60_000);
    return replay;
  });
  const { snapshot, decisions, dispatch } = useExpedition(() => session);
  const [step, setStep] = useState(0);
  const [panel, setPanel] = useState<Panel>('guide');
  const [openedRecord, setOpenedRecord] = useState(source);
  const title = useRef<HTMLHeadingElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const selected = decisions.find(item => item.id === snapshot.inspectionDecisionId);
  const choice = source.decisions.find(item => item.id === 2)!;
  useEffect(() => { title.current?.focus(); body.current?.scrollTo({ top: 0 }); }, [panel, step]);
  function showPanel(next: Panel) {
    if (next === 'evidence') dispatch({ type: 'inspect-decision', decisionId: choice.id });
    else { dispatch({ type: 'pause' }); dispatch({ type: 'end-inspection' }); }
    setPanel(next);
  }
  function goTo(next: number) {
    dispatch({ type: 'end-inspection' });
    session.dispatch({ type: 'reset' });
    session.dispatch({ type: 'set-teaching-mode', enabled: next < 4 });
    session.dispatch({ type: 'start' });
    if (next < 4) {
      session.dispatch({ type: 'continue-choice' });
      session.advanceWallTime(60_000);
    } else session.advanceWallTime(source.results.durationMs);
    dispatch({ type: 'pause' });
    if (next === 3) {
      dispatch({ type: 'set-speed', speed: 4 });
      dispatch({ type: 'continue-choice' });
    }
    setStep(next); setPanel('guide');
  }
  const usage = source.results.usage;
  return <div className={`expedition-shell guided-shell panel-open${panel === 'results' || panel === 'record' ? ' records-open' : ''}`}
    onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); showPanel('guide'); title.current?.focus(); } }}>
    <header className="expedition-header">
      <div className="lab-brand"><h1>RoverLab</h1><span>GUIDED REPLAY</span></div>
      <section className="live-telemetry" aria-label="Recorded expedition telemetry">
        <div><small>RECORDED TIME</small><strong>{formatTime(snapshot.elapsedMs)}</strong><span>of an unfinished expedition</span></div>
        <div><small>BATTERY</small><strong>{snapshot.battery.toFixed(1)}</strong><span>energy units</span></div>
        <div><small>CARGO</small><strong>{snapshot.cargo.length}</strong><span>samples aboard</span></div>
        <div><small>DELIVERED SCIENCE</small><strong>{snapshot.scienceScore}</strong><span>science points</span></div>
        <div className="live-usage"><small>HISTORICAL ATTEMPTS</small><strong>{usage?.providerAttempts ?? 'Unavailable'}</strong><span>Original capture</span></div>
        <div className="live-cost"><small>HISTORICAL ESTIMATED COST</small><strong>{formatInferenceCost(usage?.estimatedCost)}</strong><span>{usage?.estimatedCost === null ? `Incomplete · known subtotal ${formatInferenceCost(usage.knownEstimatedCost)}` : 'Estimate, not verified charges'}</span></div>
      </section><FullscreenButton />
    </header>
    <main className="expedition-stage" aria-label="Guided replay workspace">
      <ExpeditionScene snapshot={snapshot} decision={selected ?? (step < 3 ? choice : decisions.filter(item => item.action).at(-1))} historical={!!selected || step < 3} onInspect={id => { dispatch({ type: 'inspect-decision', decisionId: id }); setPanel('evidence'); }} />
      <div className="live-status"><span>REPLAY · authentic Jev capture</span><strong aria-label="Replay provider activity">0 new provider attempts</strong><span>Historical usage only · No key needed</span></div>
      <nav className="panel-navigation" aria-label="Guided replay panels">
        {([['guide', 'Guide'], ['evidence', 'Evidence'], ['usage', 'Usage'], ['results', 'Matched results'], ['record', 'Record & replay']] as const).map(([id, label]) =>
          <button className="secondary" key={id} aria-expanded={panel === id} onClick={() => showPanel(id)}>{label}</button>)}
      </nav>
      <LatestDecision snapshot={snapshot} decisions={decisions} selectedDecision={selected ?? (step < 3 ? choice : undefined)} onInspect={id => { dispatch({ type: 'inspect-decision', decisionId: id ?? choice.id }); setPanel('evidence'); }} />
      <aside className={`expedition-panel${panel === 'results' || panel === 'record' ? ' record-panel' : ''}`} aria-label="Guide panel">
        <div className="expedition-panel-heading"><h2 ref={title} tabIndex={-1}>{panel === 'guide' ? `${step + 1}. ${headings[step]}` : { evidence: 'Recorded evidence', usage: 'Historical usage', results: 'Matched results', record: 'Original record' }[panel]}</h2>
          {panel !== 'guide' && <button className="secondary" onClick={() => showPanel('guide')}>Back to guide</button>}</div>
        <div className="expedition-panel-body" ref={body}>
          {panel === 'guide' && <div className="guide-copy">
            <p className="eyebrow">STEP {step + 1} OF {headings.length} · RECORDED PLAYBACK</p>
            {step === 0 && <><p>This rover knows only what its sensors have observed. Decision 2 starts at 00:12 with {choice.input.battery.toFixed(1)} battery units. The map shows that decision's observations and memory.</p><p>The original Evidence survey run stopped after an inference failure at 02:12. It did not finish its eighteen-minute expedition.</p><ObservationTable title="Observations at decision 2" observations={choice.input.observations} /></>}
            {step === 1 && <><p>Jev selected one of the available actions using the recorded mission, resources, observations, and memory.</p><p>Its selected action is <strong>explore to Frontier 16 / 27</strong>, with {(choice.probabilities![choice.selectedCandidateId!]! * 100).toFixed(2)}% returned probability. This is neither scientific value nor a guarantee of success. No internal reasoning transcript was returned.</p><DecisionExecution decision={choice} /></>}
            {step === 2 && <><p>The baseline received a detached copy of exactly the same decision input. Its suggestion was recorded without executing another rover here.</p><DecisionComparison decision={choice} /><p>A different choice alone cannot establish a better expedition outcome.</p></>}
            {step === 3 && <><p>Continue the recorded action to watch code follow the route. Playback runs at 4× and teaching mode holds the next choice at 00:36.</p><DecisionExecution decision={choice} /><p aria-label="Guide consequences">Recorded state now: {formatTime(snapshot.elapsedMs)}, battery {snapshot.battery.toFixed(1)}, distance {snapshot.rover.distance.toFixed(1)} cells, delivered science {snapshot.scienceScore}.</p><p>The completed movement uses 12 energy units. Exploration reveals terrain; it earns no delivered science.</p></>}
            {step === 4 && <><p>The original run made 11 confirmed provider attempts. Ten choices were applied, then the provider failed and usage was unavailable. Capture stopped at the uncertainty pause. No retry or acknowledgement bypassed it.</p><UsageSummary usage={usage} localSubmissions={source.results.inferenceAttempts} waitMs={source.results.inferenceLatencyMs} label="Guide historical usage" /><p>The known subtotal excludes the failed attempt's unavailable usage. Limits were 250 attempts and $0.10 estimated cost. This is a stopping rule, not a guaranteed billing cap. Open Usage for recorded tokens, latency, model, prompt, and pricing evidence.</p></>}
            {step === 5 && <><p>Guide complete. The original Jev expedition remains unfinished.</p><p>Jev delivered {source.results.scienceScore} science in {formatTime(source.results.elapsedMs)} before stopping. The matched baseline delivered {baseline.results.scienceScore} in {formatTime(baseline.results.elapsedMs)}. Both started from the same conditions and schedule; their observed durations and choices differ.</p><p>This first capture was selected for teaching regardless of score. It retains its failure and unknown cost. One run does not establish consistent advantage for either controller.</p><button className="secondary" onClick={() => showPanel('results')}>View actual matched results</button></>}
          </div>}
          {panel === 'evidence' && <DecisionTimeline decisions={decisions} controllerHistory={snapshot.controllerHistory} selectedDecisionId={selected?.id ?? choice.id} onSelect={id => dispatch({ type: 'inspect-decision', decisionId: id })} />}
          {panel === 'usage' && <><p>All calls, tokens, latency, and costs below belong to the original capture. Playback makes zero new inference calls.</p><UsageSummary usage={usage} localSubmissions={source.results.inferenceAttempts} waitMs={source.results.inferenceLatencyMs} label="Historical inference usage" />{source.decisions.map(decision => <details key={decision.id}><summary>Historical decision {decision.id} · {decision.status}</summary><DecisionUsage decision={decision} /></details>)}</>}
          {panel === 'results' && <ExpeditionComparison records={records} onClose={() => showPanel('guide')} onOpen={record => { setOpenedRecord(record); setPanel('record'); }} />}
          {panel === 'record' && <SavedExpeditionView key={openedRecord.id} record={openedRecord} onClose={() => showPanel('guide')} active={false} closeLabel="Back to guide" />}
        </div>
      </aside>
      <section className="control-bar live-controls guide-controls" aria-label="Guide controls">
        <button className="secondary" onClick={onClose}>Exit guided replay</button>
        <div className="transport"><button className="secondary" disabled={step === 0} onClick={() => goTo(step - 1)}>Previous guide step</button>
          {step < headings.length - 1 ? <button className="primary" disabled={step === 3 && snapshot.elapsedMs < 36_000} onClick={() => goTo(step + 1)}>Next guide step</button> : <button className="primary" onClick={onClose}>Finish guide</button>}</div>
        {step === 3 && snapshot.elapsedMs < 36_000 && <button className="secondary" onClick={() => dispatch({ type: snapshot.status === 'running' ? 'pause' : snapshot.heldDecisionId ? 'continue-choice' : 'resume' })}>{snapshot.status === 'running' ? 'Pause recorded action' : 'Continue recorded action'}</button>}
      </section>
    </main>
  </div>;
}
