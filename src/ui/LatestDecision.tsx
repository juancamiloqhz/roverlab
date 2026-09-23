import type { Decision, ExpeditionSnapshot } from '../simulation/types';
import { summarizeUsage } from '../../shared/inference';
import { controllerLabels } from './controllerLabels';
import { decisionTriggers } from './DecisionTimeline';
import { describeAction } from './describeAction';
import { formatInferenceCost } from './InferenceUsage';
import { formatTime } from './formatTime';
import { DecisionExecution } from './DecisionExecution';

export function LatestDecision({ snapshot, decisions, selectedDecision, onInspect }: {
  snapshot: ExpeditionSnapshot; decisions: Decision[]; selectedDecision?: Decision; onInspect: (id?: number) => void;
}) {
  const latest = selectedDecision ?? [...decisions].reverse().find(decision => decision.status === 'applied' && decision.action);
  const pending = [...decisions].reverse().find(decision => decision.status === 'pending');
  const probability = latest?.selectedCandidateId ? latest.probabilities?.[latest.selectedCandidateId] : undefined;
  const usage = latest?.accounting ? summarizeUsage([latest]) : undefined;
  const action = describeAction(latest?.action ?? null, snapshot.status);
  return <div className="decision-overlay">
    <section className="latest-decision" aria-label="Latest decision">
      <div className="decision-caption"><span>{selectedDecision ? 'Historical decision selected' : pending || snapshot.decisionFailure || snapshot.usagePause ? 'Previous completed choice · History' : 'Latest completed choice'}</span><span>{latest ? `#${latest.id} · ${formatTime(latest.input.atMs)}` : 'No choice yet'}</span></div>
      {pending && <p className="pending-choice">{controllerLabels[pending.controller]} choosing · Decision {pending.id}. No new answer yet.</p>}
      {latest ? <>
        <h2>{latest.action ? action.label : latest.status === 'pending' ? 'Awaiting decision' : 'No executable choice'}</h2>
        <p>{controllerLabels[latest.controller]} · {latest.action ? 'Chose this action' : latest.status}.</p>
        <p className="choice-trigger">Trigger: {decisionTriggers(latest)}</p>
        <p>{probability === undefined ? 'Choice probability unavailable' : `${(probability * 100).toFixed(2)}% returned choice probability`}. Not science value or a guarantee of correctness.</p>
        <DecisionExecution decision={latest} />
        <div className="decision-metrics"><span>Latency: {latest.latencyMs === undefined ? 'Unavailable' : `${latest.latencyMs.toFixed(1)} ms wall time`}</span><span>Estimated inference cost: {latest.controller !== 'typesafe' ? 'No inference' : formatInferenceCost(usage?.estimatedCost)}{usage?.estimatedCost === null && ` · incomplete, known subtotal ${formatInferenceCost(usage.knownEstimatedCost)}`}</span></div>
      </> : <><h2>{snapshot.decisionPending ? 'Awaiting decision' : action.label}</h2><p>The controller chooses an action. Code handles routes, movement, resources, and delivered science.</p></>}
      <button className="secondary" onClick={() => onInspect(latest?.id)}>Inspect decisions</button>
    </section>
    <section className="compact-timeline" aria-label="Recent decisions">
      {decisions.length ? <ol>{decisions.slice(-3).map(decision => <li key={decision.id}>
        <button aria-label={`Inspect decision ${decision.id} at ${formatTime(decision.input.atMs)}`} aria-pressed={selectedDecision?.id === decision.id} onClick={() => onInspect(decision.id)}><span>#{decision.id} · {formatTime(decision.input.atMs)} · {decision.status}</span>
        <strong>{decisionTriggers(decision)}</strong></button>
      </li>)}</ol> : <p>Decisions will appear here when the expedition starts.</p>}
    </section>
  </div>;
}
