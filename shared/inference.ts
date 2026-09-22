import { z } from 'zod';

const number = z.number().finite().nonnegative();
const timestamp = number.max(253_402_300_799_999);
const tokens = number.int().max(Number.MAX_SAFE_INTEGER);
export const metadataIdSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/);
export const attemptIdentitySchema = z.strictObject({ expeditionId: z.uuid(), decisionId: number.int().positive(), attemptId: z.uuid() });
export type AttemptIdentity = z.infer<typeof attemptIdentitySchema>;
export const submissionSchema = z.strictObject({ identity: attemptIdentitySchema, retryIndex: z.union([z.literal(0), z.literal(1)]), submittedAtMs: timestamp });
export type InferenceSubmission = z.infer<typeof submissionSchema>;
export const pricingSchema = z.strictObject({
  model: metadataIdSchema, inputPerMillion: number, outputPerMillion: number, currency: z.literal('USD'),
  capturedAt: z.iso.datetime(), verifiedAt: z.iso.date(), source: z.literal('https://docs.typesafe.ai/models'),
});
export type InferencePricing = z.infer<typeof pricingSchema>;
export const attemptEvidenceSchema = z.strictObject({
  identity: attemptIdentitySchema, dispatch: z.enum(['not-dispatched', 'dispatched']),
  requestedModel: metadataIdSchema, promptVersion: metadataIdSchema,
  resolvedModel: metadataIdSchema.nullable(), providerRequestId: metadataIdSchema.nullable(),
  inputTokens: tokens.nullable(), outputTokens: tokens.nullable(), pricing: pricingSchema.nullable(),
  startedAtMs: timestamp.nullable(), latencyMs: number.nullable(),
}).refine(value => {
  if (value.dispatch === 'not-dispatched') return value.startedAtMs === null && value.latencyMs === null
    && value.resolvedModel === null && value.providerRequestId === null && value.inputTokens === null
    && value.outputTokens === null && value.pricing === null;
  return value.startedAtMs !== null && value.latencyMs !== null
    && value.resolvedModel !== 'jev-latest' && value.resolvedModel !== 'jev-preview'
    && (!value.pricing || value.pricing.model === value.resolvedModel);
});
export type AttemptEvidence = z.infer<typeof attemptEvidenceSchema>;
export const accountingSchema = z.strictObject({ expeditionId: z.uuid(), attempts: z.array(z.strictObject({
  submission: submissionSchema, evidence: attemptEvidenceSchema.nullable(),
})).max(100) });
export type DecisionAccounting = z.infer<typeof accountingSchema>;
export const inferenceUsageSchema = z.strictObject({
  controllerDecisions: tokens, jevDecisions: tokens, localSubmissions: tokens, providerAttempts: tokens,
  retries: tokens, unconfirmedSubmissions: tokens, inputTokens: tokens.nullable(), outputTokens: tokens.nullable(),
  knownEstimatedCost: number, estimatedCost: number.nullable(),
});
export type InferenceUsage = z.infer<typeof inferenceUsageSchema>;

export function sameAttempt(left: AttemptIdentity, right: AttemptIdentity): boolean {
  return left.expeditionId === right.expeditionId && left.decisionId === right.decisionId && left.attemptId === right.attemptId;
}

export function estimatedCost(evidence: AttemptEvidence | null): number | null {
  if (!evidence) return null;
  if (evidence.dispatch === 'not-dispatched') return 0;
  const { inputTokens, outputTokens, pricing } = evidence;
  if (inputTokens === null || outputTokens === null || !pricing) return null;
  return (inputTokens * pricing.inputPerMillion + outputTokens * pricing.outputPerMillion) / 1_000_000;
}

// Both live summaries and imported-record validation use recorded rates only.
export function summarizeUsage(decisions: readonly { controller: string; inferenceAttempts: number; accounting?: DecisionAccounting }[]): InferenceUsage {
  const usage: InferenceUsage = { controllerDecisions: decisions.length,
    jevDecisions: decisions.filter(item => item.controller === 'typesafe').length,
    localSubmissions: 0, providerAttempts: 0, retries: 0, unconfirmedSubmissions: 0,
    inputTokens: 0, outputTokens: 0, knownEstimatedCost: 0, estimatedCost: 0 };
  for (const decision of decisions) {
    usage.localSubmissions += decision.inferenceAttempts;
    for (const { submission, evidence } of decision.accounting?.attempts ?? []) {
      if (!evidence) usage.unconfirmedSubmissions++;
      if (evidence?.dispatch === 'dispatched') {
        usage.providerAttempts++;
        usage.retries += submission.retryIndex;
      }
      if (evidence?.dispatch === 'not-dispatched') continue;
      usage.inputTokens = usage.inputTokens === null || evidence?.inputTokens == null ? null : usage.inputTokens + evidence.inputTokens;
      usage.outputTokens = usage.outputTokens === null || evidence?.outputTokens == null ? null : usage.outputTokens + evidence.outputTokens;
      const cost = estimatedCost(evidence);
      if (cost === null) usage.estimatedCost = null;
      else usage.knownEstimatedCost += cost;
    }
  }
  if (usage.estimatedCost !== null) usage.estimatedCost = usage.knownEstimatedCost;
  return usage;
}
