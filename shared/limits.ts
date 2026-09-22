import { z } from 'zod';
import { estimatedCost, summarizeUsage, type DecisionAccounting } from './inference';

export const inferenceLimitsSchema = z.strictObject({
  providerAttempts: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  estimatedCost: z.number().finite().nonnegative(),
});
export type InferenceLimits = z.infer<typeof inferenceLimitsSchema>;
export const defaultInferenceLimits: InferenceLimits = { providerAttempts: 250, estimatedCost: 0.10 };
export const usagePauseSchema = z.strictObject({
  reasons: z.array(z.enum(['uncertainty', 'attempt-limit', 'cost-limit'])).max(3),
  attemptIds: z.array(z.uuid()).max(20_000),
});
export type UsagePause = z.infer<typeof usagePauseSchema>;
type AccountedDecision = { controller: string; inferenceAttempts: number; accounting?: DecisionAccounting };

// An unconfirmed submission holds a possible provider slot until evidence rules
// out dispatch or mission control explicitly acknowledges that submission.
export function reservedProviderAttempts(decisions: readonly AccountedDecision[], acknowledged: readonly string[]): number {
  return decisions.flatMap(decision => decision.accounting?.attempts ?? []).filter(({ submission, evidence }) =>
    evidence?.dispatch === 'dispatched' || (!evidence && !acknowledged.includes(submission.identity.attemptId))).length;
}

export function inferenceGuard(decisions: readonly AccountedDecision[], limits: InferenceLimits, acknowledged: readonly string[]): UsagePause {
  const attemptIds = decisions.flatMap(decision => decision.accounting?.attempts ?? [])
    .filter(({ submission, evidence }) => estimatedCost(evidence) === null && !acknowledged.includes(submission.identity.attemptId))
    .map(({ submission }) => submission.identity.attemptId);
  const reasons: UsagePause['reasons'] = [];
  if (attemptIds.length) reasons.push('uncertainty');
  if (reservedProviderAttempts(decisions, acknowledged) >= limits.providerAttempts) reasons.push('attempt-limit');
  if (summarizeUsage(decisions).knownEstimatedCost >= limits.estimatedCost) reasons.push('cost-limit');
  return { reasons, attemptIds };
}
