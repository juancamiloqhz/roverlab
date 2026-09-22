import { metadataIdSchema, type AttemptEvidence, type InferencePricing } from '../shared/inference';

export const REQUESTED_MODEL = 'jev-latest';
export const PROMPT_VERSION = 'rover-action-v2';

// Official model reference verified on 2026-09-22. A new resolved model needs a
// separately verified entry; the floating alias is never a pricing key.
function pricingFor(model: string | null, capturedAtMs: number): InferencePricing | null {
  return model === 'jev-1.13.0' ? { model, inputPerMillion: 0.042, outputPerMillion: 0, currency: 'USD',
    capturedAt: new Date(capturedAtMs).toISOString(), verifiedAt: '2026-09-22', source: 'https://docs.typesafe.ai/models' } : null;
}

export function responseMetadata(value: unknown,
  requestId: unknown, capturedAtMs: number, credential: string): Pick<AttemptEvidence, 'resolvedModel' | 'providerRequestId' | 'inputTokens' | 'outputTokens' | 'pricing'> {
  const result = value && typeof value === 'object' ? value as Record<string, unknown> : null;
  const usage = result?.usage && typeof result.usage === 'object' ? result.usage as Record<string, unknown> : null;
  const safeId = (value: unknown) => metadataIdSchema.safeParse(value).success && !(value as string).includes(credential) ? value as string : null;
  const tokenCount = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
  const model = safeId(result?.model);
  const resolvedModel = model === 'jev-latest' || model === 'jev-preview' ? null : model;
  return { resolvedModel, providerRequestId: safeId(requestId), inputTokens: tokenCount(usage?.input_tokens),
    outputTokens: tokenCount(usage?.output_tokens), pricing: pricingFor(resolvedModel, capturedAtMs) };
}
