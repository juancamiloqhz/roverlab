import { estimatedCost, summarizeUsage, type InferenceUsage } from '../../shared/inference';
import type { Decision } from '../simulation/types';

export function formatInferenceCost(value: number | null | undefined): string {
  if (value == null) return 'Unavailable';
  return `$${value > 0 && value < 0.00000001 ? value.toPrecision(3) : value.toFixed(8)} USD`;
}
const available = (value: number | null) => value ?? 'Unavailable';

export function UsageSummary({ usage, localSubmissions, waitMs, limit, label = 'Inference usage' }: {
  usage?: InferenceUsage; localSubmissions: number; waitMs?: number; limit?: number; label?: string;
}) {
  return <div className="inference-usage" aria-label={label}>
    {usage ? <>
      <p>Controller decisions: {usage.controllerDecisions} · Jev decisions: {usage.jevDecisions}</p>
      <p>Local submissions: {localSubmissions}{limit !== undefined && ` / ${limit}`}</p>
      <p>Confirmed provider attempts: {usage.providerAttempts} · Provider retries: {usage.retries}</p>
      <p>Unconfirmed submissions: {usage.unconfirmedSubmissions}</p>
      <p>Input tokens: {available(usage.inputTokens)} · Output tokens: {available(usage.outputTokens)}</p>
      <p>Estimated inference cost: {formatInferenceCost(usage.estimatedCost)}{usage.estimatedCost === null && ' · incomplete'}</p>
      {usage.estimatedCost === null && <p>Known estimated inference cost subtotal: {formatInferenceCost(usage.knownEstimatedCost)}. Missing usage or pricing is excluded.</p>}
    </> : <>
      <p>Legacy local submissions: {localSubmissions}. Provider attempts, retries, and token usage are unavailable.</p>
      <p>Estimated inference cost: Unavailable. Historical local submissions do not confirm provider access.</p>
    </>}
    {waitMs !== undefined && <p>Cumulative inference wait (wall time): {waitMs.toFixed(1)} ms</p>}
  </div>;
}

export function DecisionUsage({ decision }: { decision: Decision }) {
  if (decision.controller !== 'typesafe') return null;
  const usage = decision.accounting ? summarizeUsage([decision]) : undefined;
  return <section className="decision-usage" aria-label="Decision usage">
    <h4>Jev usage</h4>
    <UsageSummary usage={usage} localSubmissions={decision.inferenceAttempts} label="Decision usage totals" />
    {!decision.accounting && <p>Model and token metadata were not recorded for this legacy decision.</p>}
    {decision.accounting?.attempts.map(({ submission, evidence }, index) => <div className="attempt-evidence" key={submission.identity.attemptId}>
      <h5>Submission {index + 1}{submission.retryIndex === 1 && ' · Retry'}</h5>
      <p>Expedition: {submission.identity.expeditionId} · Decision: {submission.identity.decisionId}</p>
      <p>Attempt identity: {submission.identity.attemptId}</p>
      <p>Submitted at: {new Date(submission.submittedAtMs).toISOString()}</p>
      <p>Provider dispatch: {evidence?.dispatch === 'dispatched' ? 'Confirmed' : evidence ? 'Not dispatched' : 'Unconfirmed'}</p>
      <p>Requested model: {evidence?.requestedModel ?? 'Unavailable'} · Resolved model: {evidence?.resolvedModel ?? 'Unavailable'}</p>
      <p>Prompt version: {evidence?.promptVersion ?? 'Unavailable'} · Provider request identity: {evidence?.providerRequestId ?? 'Unavailable'}</p>
      <p>Input tokens: {evidence?.inputTokens ?? 'Unavailable'} · Output tokens: {evidence?.outputTokens ?? 'Unavailable'}</p>
      <p>Provider attempt started at: {evidence?.startedAtMs == null ? 'Unavailable' : new Date(evidence.startedAtMs).toISOString()}</p>
      <p>Provider attempt duration (wall time): {evidence?.latencyMs == null ? 'Unavailable' : `${evidence.latencyMs.toFixed(1)} ms`}</p>
      {evidence?.pricing ? <>
        <p>Input rate: ${evidence.pricing.inputPerMillion} per million tokens · Output rate: ${evidence.pricing.outputPerMillion} per million tokens</p>
        <p>Pricing model: {evidence.pricing.model} · Currency: {evidence.pricing.currency}</p>
        <p>Pricing captured at: {evidence.pricing.capturedAt} · Verified: {evidence.pricing.verifiedAt} · <a href={evidence.pricing.source} target="_blank" rel="noreferrer">Official pricing source</a></p>
      </> : <p>Pricing basis: Unavailable{evidence?.dispatch === 'not-dispatched' ? ' · no provider dispatch' : ''}</p>}
      <p>Estimated inference cost: {formatInferenceCost(estimatedCost(evidence))}</p>
    </div>)}
    <p className="memory-note">Estimates use recorded token usage and rates. They are not verified charges. Attempt durations are part of the decision wait and are not added to it.</p>
  </section>;
}
