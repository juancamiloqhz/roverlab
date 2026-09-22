import { APIConnectionError, APIError, choice, TypeSafeClient, type Fetch } from '@typesafe-ai/sdk';
import { DECISION_DEADLINE_MS, requestSchema, validChoice, wallClock, type DecisionClock, type DecisionResponse } from '../shared/decisions';
import { attemptIdentitySchema, usageRequestSchema, sameAttempt } from '../shared/inference';
import { createAttemptAccounting } from './attempts';
import { REQUESTED_MODEL } from './inference';

// The ledger survives local connection loss, but not a backend restart. Missing
// entries mean unknown, never zero usage. It retains the latest 1,000 submissions.
export function createDecisionHandler(options: { apiKey?: string; fetch?: Fetch; clock?: DecisionClock } = {}) {
  const clock = options.clock ?? wallClock;
  const credential = options.apiKey?.trim();
  const ledger = new Map<string, { accounting: ReturnType<typeof createAttemptAccounting>; response: Promise<Response> }>();
  const json = (body: unknown) => Response.json(body, { headers: { 'Cache-Control': 'no-store' } });

  async function decide(request: Request, body: unknown, accounting: ReturnType<typeof createAttemptAccounting> | null) {
    const respond = (body: Omit<Extract<DecisionResponse, { ok: true }>, 'evidence'> | Omit<Extract<DecisionResponse, { ok: false }>, 'evidence'>) => {
      accounting?.publish();
      return json({ ...body, evidence: accounting?.get() ?? null });
    };
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
    const cancelled = new Promise<Response>(resolve => {
      const settle = () => {
        const failure = clock.now() >= expiresAt ? 'deadline' : 'cancelled';
        accounting!.finish(failure);
        resolve(respond({ ok: false, failure, retryable: false }));
      };
      abort.signal.addEventListener('abort', settle, { once: true });
      if (abort.signal.aborted) settle();
    });
    const client = new TypeSafeClient({ apiKey: credential, baseURL: 'https://api.typesafe.ai',
      defaultModel: REQUESTED_MODEL, logLevel: 'off', retry: { maxRetries: 0 }, timeout: DECISION_DEADLINE_MS,
      fetch: async (url, init) => {
        accounting!.dispatch();
        const response = await (options.fetch ?? fetch)(url, init);
        // Observe a separate body so even a response arriving after SDK abort can
        // contribute accounting. This reads existing traffic, never retries it.
        accounting!.observe(response, credential);
        return response;
      } });
    const run = async () => {
      try {
        abort.signal.throwIfAborted();
        const { data: result, requestId, response } = await client.systemOne({
          state: input,
          questions: { action: choice(
            'Choose the complete available action that best pursues `objective` under the current `instructions`, known observations and memory, time, battery and cargo. Only delivered samples earn science credit. Properties are unknown until inspection. Explore to discover more, inspect to learn, collect to carry, return to deliver, recharge at base, or wait. Known dust storms disclose their expiry and effects. Route estimates assume immediate departure; avoid-storm candidates take a longer known route around the region, and waiting consumes expedition time. Choose exactly one supplied candidate; do not infer hidden terrain or properties.',
            Object.fromEntries(input.candidates.map(candidate => [candidate.id, candidate])),
          ) },
        }, { signal: abort.signal, timeout: remaining, retry: { maxRetries: 0 } }).withResponse();
        accounting!.receive(result, requestId, response.status, credential);
        if (abort.signal.aborted || clock.now() >= expiresAt) return respond({ ok: false, failure: 'deadline', retryable: false });
        const selected = validChoice(result?.answers?.action, input);
        return selected ? respond({ ok: true, choice: selected }) : respond({ ok: false, failure: 'invalid-output', retryable: false });
      } catch (error) {
        if (error instanceof APIError) accounting!.receive(error.body, error.requestId, error.status, credential);
        else accounting!.finish(abort.signal.aborted ? clock.now() >= expiresAt ? 'deadline' : 'cancelled' : 'transport-error');
        if (abort.signal.aborted) return respond({ ok: false, failure: clock.now() >= expiresAt ? 'deadline' : 'cancelled', retryable: false });
        if (error instanceof APIError && [401, 403].includes(error.status)) return respond({ ok: false, failure: 'configuration', retryable: false });
        const retryable = error instanceof APIConnectionError || (error instanceof APIError && (error.status === 408 || error.status === 429 || error.status >= 500));
        return respond({ ok: false, failure: 'unavailable', retryable });
      }
    };
    try { return await Promise.race([run(), cancelled]); }
    finally { clearDeadline(); request.signal.removeEventListener('abort', cancel); }
  }

  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    if (!['/api/decision', '/api/decision/usage'].includes(url.pathname) || request.method !== 'POST') return new Response(null, { status: 404 });
    const origin = request.headers.get('origin');
    if (origin && origin !== url.origin) return new Response(null, { status: 403 });
    let body: unknown;
    try { body = await request.json(); } catch { return json({ ok: false, failure: 'invalid-request', retryable: false, evidence: null }); }
    if (url.pathname === '/api/decision/usage') {
      const parsed = usageRequestSchema.safeParse(body);
      const entry = parsed.success ? ledger.get(parsed.data.identity.attemptId) : undefined;
      const evidence = entry?.accounting.get() ?? null;
      return json({ evidence: evidence && parsed.success && sameAttempt(evidence.identity, parsed.data.identity) ? evidence : null });
    }
    const identity = attemptIdentitySchema.safeParse(body && typeof body === 'object' && 'identity' in body ? body.identity : null);
    if (!identity.success) return decide(request, body, null);
    const existing = ledger.get(identity.data.attemptId);
    if (existing) {
      if (!sameAttempt(existing.accounting.identity, identity.data)) return json({ ok: false, failure: 'invalid-request', retryable: false, evidence: null });
      return (await existing.response).clone();
    }
    const accounting = createAttemptAccounting(identity.data, clock);
    const response = decide(request, body, accounting);
    ledger.set(identity.data.attemptId, { accounting, response });
    if (ledger.size > 1_000) ledger.delete(ledger.keys().next().value!);
    return (await response).clone();
  };
}
