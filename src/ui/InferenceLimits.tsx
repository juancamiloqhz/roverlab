import { useState } from 'react';
import { inferenceLimitsSchema, reservedProviderAttempts, type InferenceLimits } from '../../shared/limits';
import type { Decision, ExpeditionCommand, ExpeditionRecord, ExpeditionSnapshot } from '../simulation/types';
import { formatInferenceCost } from './InferenceUsage';
import { formatTime } from './formatTime';

export function InferenceAllowances({ snapshot }: { snapshot: ExpeditionSnapshot }) {
  if (!snapshot.inferenceLimits) return <p>Historical inference allowances: Unavailable.</p>;
  return <div aria-label="Inference allowances" className="inference-usage">
    <p>Provider-attempt allowance: {snapshot.inferenceLimits.providerAttempts}</p>
    <p>Estimated-cost stopping threshold: {formatInferenceCost(snapshot.inferenceLimits.estimatedCost)}</p>
    <p>Acknowledged attempts: {snapshot.acknowledgedAttemptIds!.length}. Missing usage remains incomplete after acknowledgement.</p>
  </div>;
}

function LimitsForm({ limits, canSetAttempts, canSetCost, raising, dispatch }: {
  limits: InferenceLimits; canSetAttempts: boolean; canSetCost: boolean; raising: boolean; dispatch: (command: ExpeditionCommand) => void;
}) {
  const [attempts, setAttempts] = useState(String(limits.providerAttempts));
  const [cost, setCost] = useState(String(limits.estimatedCost));
  const [error, setError] = useState('');
  return <form className="inference-limits" onSubmit={event => {
    event.preventDefault();
    const parsed = inferenceLimitsSchema.safeParse({ providerAttempts: Number(attempts), estimatedCost: Number(cost) });
    if (!attempts.trim() || !cost.trim() || !parsed.success) {
      setError('Use a nonnegative whole number of attempts and a finite nonnegative dollar amount.');
      return;
    }
    if (raising && (parsed.data.providerAttempts < limits.providerAttempts || parsed.data.estimatedCost < limits.estimatedCost)) {
      setError('During a usage pause, raise allowances without lowering either limit.');
      return;
    }
    dispatch({ type: 'set-inference-limits', limits: parsed.data });
    setError('');
  }}>
    <label>Provider-attempt limit<input type="number" min={raising ? limits.providerAttempts : 0} step="1" required disabled={!canSetAttempts} value={attempts} onChange={event => setAttempts(event.target.value)} /></label>
    <label>Estimated-cost limit in USD<input type="number" min={raising ? limits.estimatedCost : 0} step="any" required disabled={!canSetCost} value={cost} onChange={event => setCost(event.target.value)} /></label>
    <button className="secondary" disabled={!canSetAttempts && !canSetCost}>Apply inference limits</button>
    {error && <p role="alert">{error}</p>}
  </form>;
}

export function InferenceLimitSetup({ snapshot, decisions, dispatch }: {
  snapshot: ExpeditionSnapshot; decisions: Decision[]; dispatch: (command: ExpeditionCommand) => void;
}) {
  const limits = snapshot.inferenceLimits;
  if (!limits) return null;
  const editable = !snapshot.decisionPending && snapshot.status !== 'ended';
  return <section className="objective-block" aria-label="Inference limits">
    <InferenceAllowances snapshot={snapshot} />
    <p className="memory-note">Used or reserved provider slots: {reservedProviderAttempts(decisions, snapshot.acknowledgedAttemptIds!)} / {limits.providerAttempts}. Unconfirmed submissions reserve possible activity until resolved or acknowledged.</p>
    <LimitsForm key={`${limits.providerAttempts}:${limits.estimatedCost}:${snapshot.status}`} limits={limits} dispatch={dispatch} raising={snapshot.status !== 'ready'}
      canSetAttempts={editable && (snapshot.status === 'ready' || !!snapshot.usagePause?.reasons.includes('attempt-limit'))}
      canSetCost={editable && (snapshot.status === 'ready' || !!snapshot.usagePause?.reasons.includes('cost-limit'))} />
    <p className="memory-note">The dollar limit is an estimated-cost stopping rule. A completed response may cross this threshold. Unresolved usage prevents a verified billing total.</p>
  </section>;
}

export function InferenceUsagePause({ snapshot, decisions, dispatch }: {
  snapshot: ExpeditionSnapshot; decisions: Decision[]; dispatch: (command: ExpeditionCommand) => void;
}) {
  const pause = snapshot.usagePause;
  if (!pause || snapshot.status !== 'paused') return null;
  const affected = decisions.flatMap(decision => decision.accounting?.attempts ?? []).filter(({ submission, evidence }) =>
    pause.reasons.includes('uncertainty') ? pause.attemptIds.includes(submission.identity.attemptId) : evidence?.dispatch !== 'not-dispatched');
  return <section className="recovery-panel" aria-label="Inference usage pause">
    <h3>Inference usage paused</h3>
    <p>Expedition time and modeled evolution are frozen. Camera and interface controls remain available.</p>
    <p>Baseline continuation resumes the current action to its next safe interruption point before choosing a new action.</p>
    {pause.reasons.includes('uncertainty') && <p role="status">Usage or pricing is unknown for the listed attempts. Acknowledge them explicitly before further Jev requests.</p>}
    {pause.reasons.includes('attempt-limit') && <p role="status">Provider-attempt limit reached. Raise the provider-attempt allowance in Inference limits to request more decisions.</p>}
    {pause.reasons.includes('cost-limit') && <p role="status">Estimated-cost threshold reached. Raise the estimated-cost allowance in Inference limits to request more decisions. A completed response may cross this threshold; it is not an exact billed-spending cap.</p>}
    {!pause.reasons.length && <p role="status">The usage guards are satisfied. Continue Jev inference when ready.</p>}
    {affected.length > 0 && <details><summary>Affected attempts</summary><ul>{affected.map(({ submission }) => <li key={submission.identity.attemptId}>
      Decision {submission.identity.decisionId} · Attempt {submission.identity.attemptId}
    </li>)}</ul></details>}
    <div className="recovery-actions">
      {pause.reasons.includes('uncertainty') && <button className="primary" disabled={snapshot.decisionPending}
        onClick={() => dispatch({ type: 'acknowledge-usage', attemptIds: pause.attemptIds })}>Acknowledge listed uncertainty and continue</button>}
      {!pause.reasons.includes('uncertainty') && <button className="primary" disabled={snapshot.decisionPending || pause.reasons.length > 0}
        onClick={() => dispatch({ type: 'continue-inference' })}>Continue Jev inference</button>}
      <button className="secondary" disabled={snapshot.decisionPending} onClick={() => dispatch({ type: 'continue-with-baseline' })}>Continue with the baseline controller</button>
      <button className="secondary" onClick={() => dispatch({ type: 'stop' })}>Stop at usage pause</button>
    </div>
    {pause.reasons.includes('uncertainty') && <p>Acknowledgement retains missing usage and its estimate as incomplete. Other reached limits still apply.</p>}
  </section>;
}

export function InferenceLimitHistory({ record }: { record: ExpeditionRecord }) {
  if (!record.startingConditions.inferenceLimits) return null;
  const initial = record.startingConditions.inferenceLimits;
  return <section aria-label="Inference limit history" className="inference-limit-history">
    <h3>Inference limit history</h3>
    <p>Expedition {record.id}. Initial allowances: {initial.providerAttempts} provider attempts and {formatInferenceCost(initial.estimatedCost)} estimated cost.</p>
    <ul>{record.events.map(event => {
      const description = event.type === 'inference-limits-changed'
        ? `Inference limit changed: ${event.limits.providerAttempts} provider attempts; ${formatInferenceCost(event.limits.estimatedCost)} estimated cost.`
        : event.type === 'usage-acknowledged' ? `Uncertainty acknowledged for attempts: ${event.attemptIds.join(', ')}.`
          : event.type === 'usage-paused' ? `Usage pause: ${event.pause.reasons.join(', ') || 'guards satisfied; waiting for explicit continuation'}.`
            : event.type === 'inference-continued' ? 'Mission control continued Jev inference.' : null;
      return description && <li key={event.sequence}>{formatTime(event.atMs)} · {description}</li>;
    })}</ul>
  </section>;
}
