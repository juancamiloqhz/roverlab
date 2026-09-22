import { APIConnectionError, APIError, choice, TypeSafeClient, type Fetch } from '@typesafe-ai/sdk';
import { DECISION_DEADLINE_MS, requestSchema, validChoice, wallClock, type DecisionClock, type DecisionResponse } from '../shared/decisions';
import { attemptIdentitySchema, type AttemptEvidence } from '../shared/inference';
import { PROMPT_VERSION, REQUESTED_MODEL, responseMetadata } from './inference';

// One local request issues at most one SDK attempt. The browser coordinates the
// complete operation so its deadline includes both local transport and retries.
export function createDecisionHandler(options: { apiKey?: string; fetch?: Fetch; clock?: DecisionClock } = {}) {
  const clock = options.clock ?? wallClock;
  const credential = options.apiKey?.trim();
  return async (request: Request): Promise<Response> => {
    let evidence: AttemptEvidence | null = null;
    const respond = (body: Omit<Extract<DecisionResponse, { ok: true }>, 'evidence'> | Omit<Extract<DecisionResponse, { ok: false }>, 'evidence'>) =>
      Response.json({ ...body, evidence }, { headers: { 'Cache-Control': 'no-store' } });
    if (new URL(request.url).pathname !== '/api/decision' || request.method !== 'POST') return new Response(null, { status: 404 });
    const origin = request.headers.get('origin');
    // Vite is configured to preserve the browser's Host header.
    if (origin && origin !== new URL(request.url).origin) return new Response(null, { status: 403 });
    let body: unknown;
    try { body = await request.json(); } catch { return respond({ ok: false, failure: 'invalid-request', retryable: false }); }
    const identity = attemptIdentitySchema.safeParse(body && typeof body === 'object' && 'identity' in body ? body.identity : null);
    if (identity.success) evidence = { identity: identity.data, dispatch: 'not-dispatched', requestedModel: REQUESTED_MODEL,
      promptVersion: PROMPT_VERSION, resolvedModel: null, providerRequestId: null, inputTokens: null, outputTokens: null,
      pricing: null, startedAtMs: null, latencyMs: null };
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) return respond({ ok: false, failure: 'invalid-request', retryable: false });
    if (!credential) return respond({ ok: false, failure: 'configuration', retryable: false });
    const { input, expiresAt } = parsed.data;
    const remaining = Math.min(DECISION_DEADLINE_MS, expiresAt - clock.now());
    if (remaining <= 0) return respond({ ok: false, failure: 'deadline', retryable: false });
    const abort = new AbortController();
    const cancel = () => abort.abort();
    request.signal.addEventListener('abort', cancel, { once: true });
    if (request.signal.aborted) cancel();
    const clearDeadline = clock.after(remaining, cancel);
    const client = new TypeSafeClient({ apiKey: credential, baseURL: 'https://api.typesafe.ai',
      defaultModel: REQUESTED_MODEL, logLevel: 'off', retry: { maxRetries: 0 }, timeout: DECISION_DEADLINE_MS,
      fetch: (url, init) => {
        // This is the actual outbound boundary, after SDK request preparation.
        evidence!.dispatch = 'dispatched';
        evidence!.startedAtMs = clock.now();
        return (options.fetch ?? fetch)(url, init);
      } });
    const finishTiming = () => {
      if (evidence!.startedAtMs !== null) evidence!.latencyMs = Math.max(0, clock.now() - evidence!.startedAtMs);
    };
    try {
      abort.signal.throwIfAborted();
      const { data: result, requestId } = await client.systemOne({
        state: input,
        questions: { action: choice(
          'Choose the complete available action that best pursues `objective` under the current `instructions`, known observations and memory, time, battery and cargo. Only delivered samples earn science credit. Properties are unknown until inspection. Explore to discover more, inspect to learn, collect to carry, return to deliver, recharge at base, or wait. Known dust storms disclose their expiry and effects. Route estimates assume immediate departure; avoid-storm candidates take a longer known route around the region, and waiting consumes expedition time. Choose exactly one supplied candidate; do not infer hidden terrain or properties.',
          Object.fromEntries(input.candidates.map(candidate => [candidate.id, candidate])),
        ) },
      }, { signal: abort.signal, timeout: remaining, retry: { maxRetries: 0 } }).withResponse();
      finishTiming();
      Object.assign(evidence!, responseMetadata(result, requestId, clock.now(), credential));
      if (abort.signal.aborted || clock.now() >= expiresAt) return respond({ ok: false, failure: 'deadline', retryable: false });
      const selected = validChoice(result?.answers?.action, input);
      return selected ? respond({ ok: true, choice: selected }) : respond({ ok: false, failure: 'invalid-output', retryable: false });
    } catch (error) {
      finishTiming();
      if (abort.signal.aborted) return respond({ ok: false, failure: request.signal.aborted ? 'cancelled' : 'deadline', retryable: false });
      if (error instanceof APIError && [401, 403].includes(error.status)) return respond({ ok: false, failure: 'configuration', retryable: false });
      const retryable = error instanceof APIConnectionError || (error instanceof APIError && (error.status === 408 || error.status === 429 || error.status >= 500));
      return respond({ ok: false, failure: 'unavailable', retryable });
    } finally {
      clearDeadline();
      request.signal.removeEventListener('abort', cancel);
    }
  };
}
